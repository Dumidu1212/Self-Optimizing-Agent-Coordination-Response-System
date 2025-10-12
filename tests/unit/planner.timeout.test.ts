// tests/unit/planner.timeout.test.ts
import { Planner } from '../../src/planner/planner';
import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { IRegistryService } from '../../src/registry/service';
import type { Tool } from '../../src/registry/model';
import type { IToolExecutor, ExecutionResult, JsonRecord } from '../../src/planner/contracts';
import { TraceStore } from '../../src/tracing/traceStore';

const t: Tool = {
  id: 'slow', name: 'Slow', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://slow', timeout_ms: 10 }
};

class HangingExec implements IToolExecutor {
  async execute(_tool: Tool, _input: JsonRecord, overallAbort: AbortSignal): Promise<ExecutionResult> {
    // Wait until planner’s overall timeout aborts, then return a timeout result (no rejection).
    await new Promise<void>((resolve) => {
      if (overallAbort.aborted) return resolve();
      overallAbort.addEventListener('abort', () => resolve(), { once: true });
    });
    return { status: 'timeout', error: 'overall-timeout' };
   }
 }

test('planner surfaces overall timeout', async () => {
  const registry: IRegistryService = {
    list: () => [t],
    getRegistry: () => ({ tools: [t], updatedAt: new Date().toISOString() })
  };
  const planner = new Planner(registry, new SimpleScorer(), new HangingExec(), new TraceStore());
  const res = await planner.plan({ capability: 'patient.search', input: {}, execute: true, timeout_ms: 5 });
  expect(res.execution?.status).toBe('timeout');
});
