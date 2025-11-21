import { TraceStore } from '../../src/tracing/traceStore';
import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import type { IPlanner, PlanContext, PlanResult } from '../../src/planner/contracts';
import request from 'supertest';
import type { IPolicyService } from '../../src/policy/model';

class PlannerStub implements IPlanner {
  async plan(_ctx: PlanContext): Promise<PlanResult> {
    return {
      traceId: 'tr_test',
      capability: _ctx.capability ?? '',
      candidates: []
    };
  }
}

const fake: IRegistryService = {
  list: () => [
    { id: 't1', name: 'T1', version: '1.0.0', capabilities: [{ name: 'cap', inputs: {}, outputs: {} }] }
  ],
  getRegistry: () => ({ tools: [], updatedAt: new Date().toISOString() })
};

const allowAllPolicy: IPolicyService = {
  preCheck() { return { allow: true }; },
  postCheck() { return { pass: true }; },
};

describe('tools routes', () => {
  let app: ReturnType<typeof buildApp>;
  let traces: TraceStore;

  beforeAll(async () => {
    traces = new TraceStore();
    const planner = new PlannerStub();
    app = buildApp({ registry: fake, planner, traces, policy: allowAllPolicy });
    await app.ready();                // ← ensure routes/plugins are initialized
  });

  afterAll(async () => {
    await app.close();                 // ← prevents “Jest did not exit…” open handles
  });

  it('validates a tool', async () => {
    const res = await request(app.server)
      .post('/tools/validate')
      .send({ id: 'x', name: 'X', version: '1.0.0', capabilities: [{ name: 'c', inputs: {}, outputs: {} }] });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('lists tools', async () => {
    const res = await request(app.server).get('/tools');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('t1');
  });
});
