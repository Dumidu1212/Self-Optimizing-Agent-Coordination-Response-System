/**
 * Planner/Router
 *  - Filters candidate tools by capability + preconditions
 *  - Scores candidates (Contract-Net style) → ranks
 *  - Executes best-first with fallback on *failure* (timeout is terminal)
 *  - Enforces an overall deadline (AbortController)
 *  - Emits Prometheus metrics + detailed trace events (S003 exposes /trace/:id)
 *
 * Design notes:
 *  - SOLID/DIP: IPlanner depends on IRegistryService, IScorer, IToolExecutor, TraceStore
 *  - Deterministic behavior: executor-reported 'timeout' returns immediately
 *  - Observability: metrics + trace events at each decision point
 */

import type {
  IPlanner,
  PlanContext,
  PlanResult,
  IToolExecutor,
  IScorer,
  JsonRecord,
  ExecutionResult,
} from './contracts';
import type { Tool } from '../registry/model';
import type { IRegistryService } from '../registry/service';
import {
  plannerBidsTotal,
  plannerSelectionTotal,
  plannerFallbacksTotal,
  plannerExecutionLatencyMs,
  traceCreatedTotal,
  traceEventsTotal,
} from '../metrics/metrics';
import { TraceStore } from '../tracing/traceStore';

/** Capability gate: true if tool declares the required capability. */
function supportsCapability(t: Tool, capability: string): boolean {
  return (t.capabilities ?? []).some((c) => c.name === capability);
}

/** Preconditions gate: checks env/network prerequisites before offering a tool. */
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

  /**
   * Plan & optionally execute.
   * Execution policy:
   *  - success  → return immediately
   *  - failure  → fallback to next candidate
   *  - timeout  → return immediately (terminal)
   * Overall deadline: AbortController that cancels outstanding work and returns 'timeout'.
   */
  async plan(ctx: PlanContext): Promise<PlanResult> {
    const execute = ctx.execute !== false; // default true

    // Create trace immediately (even on early returns) so clients can fetch explainability.
    const traceId = this.traces.create();
    traceCreatedTotal.inc();
    this.rec(traceId, 'request', ctx);

    const capability = ctx.capability ?? '';
    if (!capability) {
      const execution: ExecutionResult = { status: 'failure', error: 'INPUT_INVALID' } as const;
      this.rec(traceId, 'failure', execution);
      return { traceId, capability: '', candidates: [], execution };
    }

    // 1) Candidate discovery
    const tools = this.registry.list();
    const candidates = tools.filter(
      (t) => supportsCapability(t, capability) && preconditionsOk(t)
    );

    if (candidates.length === 0) {
      const execution: ExecutionResult = { status: 'failure', error: 'NO_CANDIDATES' } as const;
      this.rec(traceId, 'no_candidates', { capability });
      this.rec(traceId, 'failure', execution);
      return { traceId, capability, candidates: [], execution };
    }

    // 2) Scoring (Contract-Net baseline) and ranking
    const input: JsonRecord = ctx.input ?? {};
    const scored = candidates
      .map((t) => {
        const score = this.scorer.score(t, { capability, input });
        plannerBidsTotal.labels({ capability, tool: t.id }).inc();
        return { toolId: t.id, score, tool: t };
      })
      .sort((a, b) => b.score - a.score);

    this.rec(
      traceId,
      'scores',
      scored.map(({ toolId, score }) => ({ toolId, score }))
    );

    // Result skeleton (always return candidates for transparency)
    const result: PlanResult = {
      traceId,
      capability,
      candidates: scored.map((s) => ({ toolId: s.toolId, score: s.score })),
    };

    // Decision-only mode: pick the top candidate and return plan (no execution)
    if (!execute) {
      const selected = scored[0];
      if (selected) {
        result.selected = { toolId: selected.toolId };
        plannerSelectionTotal.labels({ capability, tool: selected.toolId }).inc();
        this.rec(traceId, 'selected', { toolId: selected.toolId, score: selected.score });
      }
      return result;
    }

    // 3) Execution with fallback + overall deadline
    const overallController = new AbortController();
    let overallTimeout: ReturnType<typeof setTimeout> | undefined;
    if (ctx.timeout_ms && ctx.timeout_ms > 0) {
      overallTimeout = setTimeout(
        (): void => overallController.abort('overall-timeout'),
        ctx.timeout_ms
      );
      // Avoid keeping the event loop alive in tests/short-lived runs
      if (typeof overallTimeout.unref === 'function') overallTimeout.unref();
    }

    let rank = 0;
    for (const cand of scored) {
      rank++;
      const tool = cand.tool;
      this.rec(traceId, 'attempt', { toolId: tool.id, rank });

      // Execute with robust error normalization: thrown -> timeout/failure
      let execRes: ExecutionResult;
      try {
        execRes = await this.httpExecutor.execute(tool, input, overallController.signal);
      } catch (err) {
        execRes = overallController.signal.aborted
          ? ({ status: 'timeout', error: (err as Error).message } as const)
          : ({ status: 'failure', error: (err as Error).message } as const);
      }

      // 3a) Success → record, observe latency, return
      if (execRes.status === 'success') {
        if (overallTimeout) clearTimeout(overallTimeout);
        plannerSelectionTotal.labels({ capability, tool: tool.id }).inc();
        if (typeof execRes.latency_ms === 'number') {
          plannerExecutionLatencyMs.labels({ tool: tool.id }).observe(execRes.latency_ms);
        }
        result.selected = { toolId: tool.id };
        result.execution = execRes;
        this.rec(traceId, 'selected', { toolId: tool.id, score: cand.score });
        this.rec(traceId, 'success', { toolId: tool.id, latency_ms: execRes.latency_ms });
        return result;
      }

      // 3b) Tool-level timeout → terminal timeout (deterministic)
      if (execRes.status === 'timeout') {
        if (overallTimeout) clearTimeout(overallTimeout);
        result.execution = execRes;
        this.rec(traceId, 'timeout', { toolId: tool.id, reason: execRes.error });
        return result;
      }

      // 3c) Failure → fallback to next best candidate
      plannerFallbacksTotal.labels({ capability }).inc();
      this.rec(traceId, 'fallback', {
        toolId: tool.id,
        error: execRes.error,
        status: execRes.status,
      });

      // If the overall deadline elapsed while failing, surface timeout now
      if (overallController.signal.aborted) {
        if (overallTimeout) clearTimeout(overallTimeout);
        const reason = String(
          (overallController.signal as unknown as { reason?: unknown }).reason ?? 'overall-timeout'
        );
        const terminal: ExecutionResult = { status: 'timeout', error: reason } as const;
        this.rec(traceId, 'timeout', { reason });
        result.execution = terminal;
        return result;
      }
    }

    // 4) All candidates failed (before deadline)
    if (overallTimeout) clearTimeout(overallTimeout);
    const terminal: ExecutionResult = { status: 'failure', error: 'ALL_CANDIDATES_FAILED' } as const;
    this.rec(traceId, 'failure', terminal);
    result.execution = terminal;
    return result;
  }

  /** Record a trace event and increment the trace event counter. */
  private rec(traceId: string, type: string, data: unknown): void {
    this.traces.record(traceId, type, data);
    traceEventsTotal.inc();
  }
}
