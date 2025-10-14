import request from 'supertest';
import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import type { Tool } from '../../src/registry/model';
import { Planner } from '../../src/planner/planner';
import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { IToolExecutor, ExecutionResult, JsonRecord } from '../../src/planner/contracts';
import { TraceStore } from '../../src/tracing/traceStore';

const tool: Tool = {
  id: 'demo', name: 'Demo', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://fake', timeout_ms: 50 },
  sla: { p95_ms: 200, success_rate_min: 0.99 },
  cost_estimate: 0.1
};

class StubExec implements IToolExecutor {
  async execute(_tool: Tool, _input: JsonRecord): Promise<ExecutionResult> {
    return { status: 'success', latency_ms: 12, output: { ok: true } };
  }
}

describe('/trace/:id e2e', () => {
  let app: ReturnType<typeof buildApp>;
  let traces: TraceStore;

  beforeAll(async () => {
    traces = new TraceStore({ ttlMs: 60_000 });
    const registry: IRegistryService = {
      list: () => [tool],
      getRegistry: () => ({ tools: [tool], updatedAt: new Date().toISOString() })
    };
    const planner = new Planner(registry, new SimpleScorer(), new StubExec(), traces);
    app = buildApp({ registry, planner, traces });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns a full trace after /plan', async () => {
    const planRes = await request(app.server)
      .post('/plan')
      .send({ capability: 'patient.search', input: { mrn: 'X' }, execute: true });

    expect(planRes.status).toBe(200);
    const traceId = planRes.body.traceId as string;

    const traceRes = await request(app.server).get(`/trace/${traceId}`);
    expect(traceRes.status).toBe(200);
    expect(traceRes.body.id).toBe(traceId);
    expect(Array.isArray(traceRes.body.events)).toBe(true);
    // Should include at least: request, scores, attempt, success
    const types = (traceRes.body.events as Array<{ type: string }>).map(e => e.type);
    expect(types).toEqual(expect.arrayContaining(['request', 'scores', 'attempt', 'success']));
  });
});
