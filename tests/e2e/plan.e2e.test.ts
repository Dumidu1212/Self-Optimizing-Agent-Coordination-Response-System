import request from 'supertest';
import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import type { Tool } from '../../src/registry/model';
import { Planner } from '../../src/planner/planner';
import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { IToolExecutor, ExecutionResult } from '../../src/planner/contracts';
import { TraceStore } from '../../src/tracing/traceStore';
import type { JsonRecord } from '../../src/planner/contracts';

const tFast: Tool = {
  id: 'fast', name: 'Fast', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://fast', timeout_ms: 100 },
  sla: { p95_ms: 200, success_rate_min: 0.99 }, cost_estimate: 0.1
};
const tSlow: Tool = {
  id: 'slow', name: 'Slow', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://slow', timeout_ms: 100 },
  sla: { p95_ms: 2000, success_rate_min: 0.97 }, cost_estimate: 0.2
};

class StubExec implements IToolExecutor {
  async execute(
    tool: Tool,
    _input: JsonRecord,
    _overallAbort: AbortSignal
  ): Promise<ExecutionResult> {
     // Pretend both succeed; latencies differ by name
     const latency = tool.id === 'fast' ? 10 : 50;
     return { status: 'success', latency_ms: latency, output: { id: tool.id } };
   }
 }

describe('/plan e2e', () => {
  let app: ReturnType<typeof buildApp>;
  let traces: TraceStore;

  beforeAll(async () => {
    traces = new TraceStore();
    const registry: IRegistryService = {
      list: () => [tFast, tSlow],
      getRegistry: () => ({ tools: [tFast, tSlow], updatedAt: new Date().toISOString() })
    };
    const planner = new Planner(registry, new SimpleScorer(), new StubExec(), new TraceStore());
    app = buildApp({ registry, planner, traces });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('selects and executes the best candidate', async () => {
    const res = await request(app.server)
      .post('/plan')
      .send({ capability: 'patient.search', input: { mrn: '123' }, execute: true });

    expect(res.status).toBe(200);
    expect(res.body.capability).toBe('patient.search');
    expect(res.body.candidates.length).toBe(2);
    expect(res.body.selected.toolId).toBe('fast');
    expect(res.body.execution.status).toBe('success');
  });
});
