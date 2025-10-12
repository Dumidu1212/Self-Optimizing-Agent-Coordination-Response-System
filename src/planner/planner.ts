/**
 * Planner/Router: filters candidates from the registry, scores, selects, executes, and falls back.
 * Emits metrics and trace events (traceId used now; S003 will expose /trace/:id).
 */
import type { IPlanner, PlanContext, PlanResult, IToolExecutor, IScorer, JsonRecord } from './contracts';
import type { Tool } from '../registry/model';
import type { IRegistryService } from '../registry/service';
import { plannerBidsTotal, plannerSelectionTotal, plannerFallbacksTotal } from '../metrics/metrics';
import { TraceStore } from '../tracing/traceStore';

function supportsCapability(t: Tool, capability: string): boolean {
  return (t.capabilities ?? []).some(c => c.name === capability);
}

function preconditionsOk(t: Tool): boolean {
  const pre = t.preconditions ?? {};
  if (pre.requiresNetwork && typeof process.env.OFFLINE !== 'undefined') return false;
  if (pre.env) {
    for (const k of Object.keys(pre.env)) {
      if (!process.env[k]) return false;
    }
  }
  return true;
}

export class Planner implements IPlanner {
  constructor(
    private readonly registry: IRegistryService,
    private readonly scorer: IScorer,
    private readonly httpExecutor: IToolExecutor,
    private readonly traces: TraceStore
  ) {}

  async plan(ctx: PlanContext): Promise<PlanResult> {
    const execute = ctx.execute !== false; // default true
    const capability = ctx.capability ?? '';
    if (!capability) {
      return { traceId: this.traces.create(), capability: '', candidates: [], execution: { status: 'failure', error: 'INPUT_INVALID' } };
    }

    const traceId = this.traces.create();
    this.traces.record(traceId, 'request', ctx);

    // Generate candidates (filter by capability & preconditions)
    const tools = this.registry.list();
    const candidates = tools.filter(t => supportsCapability(t, capability) && preconditionsOk(t));

    if (candidates.length === 0) {
      this.traces.record(traceId, 'no_candidates', { capability });
      return { traceId, capability, candidates: [], execution: { status: 'failure', error: 'NO_CANDIDATES' } };
    }

    // Score candidates
    const input: JsonRecord = ctx.input ?? {};
    const scored = candidates
      .map(t => {
        const score = this.scorer.score(t, { capability, input });
        plannerBidsTotal.labels({ capability, tool: t.id }).inc();
        return { toolId: t.id, score, tool: t };
      })
      .sort((a, b) => b.score - a.score);

    this.traces.record(traceId, 'scores', scored.map(({ toolId, score }) => ({ toolId, score })));

    const result: PlanResult = {
      traceId,
      capability,
      candidates: scored.map(s => ({ toolId: s.toolId, score: s.score }))
    };

    if (!execute) {
      // Decision-only mode
      const selected = scored[0];
      if (selected) {
        result.selected = { toolId: selected.toolId };
        plannerSelectionTotal.labels({ capability, tool: selected.toolId }).inc();
      }
      return result;
    }

    // Execution with fallback
    const overallController = new AbortController();
    let overallTimeout: ReturnType<typeof setTimeout> | undefined;
    if (ctx.timeout_ms && ctx.timeout_ms > 0) {
      overallTimeout = setTimeout((): void => overallController.abort('overall-timeout'), ctx.timeout_ms);
      // Prevent the timer from keeping the event loop alive (important for tests)
      if (typeof overallTimeout.unref === 'function') overallTimeout.unref();
    }

    let rank = 0;
    for (const cand of scored) {
      rank++;
      const tool = cand.tool;

      this.traces.record(traceId, 'attempt', { toolId: tool.id, rank });

      const execRes = await this.httpExecutor.execute(tool, input, overallController.signal);

      if (execRes.status === 'success') {
        if (overallTimeout) clearTimeout(overallTimeout);
        plannerSelectionTotal.labels({ capability, tool: tool.id }).inc();
        result.selected = { toolId: tool.id };
        result.execution = execRes;
        this.traces.record(traceId, 'success', { toolId: tool.id, latency_ms: execRes.latency_ms });
        return result;
      }

      // If the executor reports a timeout, surface it deterministically.
      if (execRes.status === 'timeout') {
        if (overallTimeout) clearTimeout(overallTimeout);
        result.execution = execRes;
        this.traces.record(traceId, 'timeout', { toolId: tool.id, reason: execRes.error });
        return result;
      }

      // Failed → record + try next candidate
      plannerFallbacksTotal.labels({ capability }).inc();
      this.traces.record(traceId, 'fallback', { toolId: tool.id, error: execRes.error, status: execRes.status });
      // If overall deadline elapsed, break early
    if (overallController.signal.aborted) {
      if (overallTimeout) clearTimeout(overallTimeout);
      break;
    }
   }

    // No candidate succeeded
    if (overallTimeout) clearTimeout(overallTimeout);
    result.execution = { status: 'failure', error: 'ALL_CANDIDATES_FAILED' };
    this.traces.record(traceId, 'failure', result.execution);
    return result;
  }
}
