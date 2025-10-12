import { Planner } from '../../src/planner/planner';
import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { IRegistryService } from '../../src/registry/service';
import type { Tool } from '../../src/registry/model';
import type { IToolExecutor, ExecutionResult } from '../../src/planner/contracts';
import { TraceStore } from '../../src/tracing/traceStore';

const t1: Tool = {
  id: 't1', name: 'T1', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://tool-1', timeout_ms: 100 },
  sla: { p95_ms: 400, success_rate_min: 0.98 }, cost_estimate: 0.2
};

const t2: Tool = {
  id: 't2', name: 'T2', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://tool-2', timeout_ms: 100 },
  sla: { p95_ms: 500, success_rate_min: 0.97 }, cost_estimate: 0.1
};

class FailingExec implements IToolExecutor {
  // fail once (non-timeout), then succeed
  private count = 0;
  async execute(
    _tool: Tool,
    _input: Record<string, unknown>,
    _abort: AbortSignal
  ): Promise<ExecutionResult> {
    this.count++;
    if (this.count === 1) {
      // Non-timeout failure → triggers fallback to next candidate
      return { status: 'failure', error: 'HTTP_500' };
    }
    return { status: 'success', latency_ms: 12, output: { ok: true } };
  }
}

describe('Planner fallback', () => {
  it('falls back when the top candidate fails', async () => {
    const registry: IRegistryService = { list: () => [t1, t2], getRegistry: () => ({ tools: [t1, t2], updatedAt: new Date().toISOString() }) };
    const scorer = new SimpleScorer();
    const exec = new FailingExec();
    const traces = new TraceStore();

    const planner = new Planner(registry, scorer, exec, traces);

    const res = await planner.plan({ capability: 'patient.search', input: {}, execute: true, timeout_ms: 500 });
    expect(res.execution?.status).toBe('success');
    expect(res.selected?.toolId).toBeDefined();
  });
});
