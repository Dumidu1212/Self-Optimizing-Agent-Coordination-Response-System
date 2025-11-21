import request from 'supertest';
import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import { TraceStore } from '../../src/tracing/traceStore';
import type { IPlanner, PlanContext, PlanResult } from '../../src/planner/contracts';
import { PolicyService } from '../../src/policy/service';
import type { PolicyDoc } from '../../src/policy/model';

jest.setTimeout(15000); // optional but helpful

class NoopPlanner implements IPlanner {
  async plan(ctx: PlanContext): Promise<PlanResult> {
    return { traceId: 'test-trace', capability: ctx.capability ?? '', candidates: [] };
  }
}

const denyBilling: PolicyDoc = {
  schemaVersion: '1.0',
  default: {
    allowCapabilities: ['patient.search'],
    denyCapabilities: ['billing.charge'],
    preSchemas: {},
    postSchemas: {},
  },
};

describe('policy pre-deny', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const policy = new PolicyService(denyBilling);
    const registry: IRegistryService = {
      list: () => [],
      getRegistry: () => ({ tools: [], updatedAt: new Date().toISOString() }),
    };
    app = buildApp({
      registry,
      planner: new NoopPlanner(),
      traces: new TraceStore(),
      policy,
    });
    await app.ready();         // <<< IMPORTANT
  });

  afterAll(async () => {
    await app.close();         // <<< IMPORTANT
  });

  it('returns 403 on denied capability', async () => {
    const res = await request(app.server)
      .post('/plan')
      .send({ capability: 'billing.charge', input: {}, tenant: 't' });

    expect(res.status).toBe(403);
    expect(res.body.execution?.error).toBe('POLICY_DENIED');
  });
});
