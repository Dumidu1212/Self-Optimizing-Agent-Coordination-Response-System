import request from 'supertest';
import { Planner } from '../../src/planner/planner';
import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { IRegistryService } from '../../src/registry/service';
import type { Tool } from '../../src/registry/model';
import type { IToolExecutor, ExecutionResult, JsonRecord } from '../../src/planner/contracts';
import { TraceStore } from '../../src/tracing/traceStore';
import { PolicyService } from '../../src/policy/service';
import type { PolicyDoc } from '../../src/policy/model';
import { buildApp } from '../../src/app';

jest.setTimeout(15000); // optional

const t1: Tool = {
  id: 'bad', name: 'Bad', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://bad', timeout_ms: 50 },
};
const t2: Tool = {
  id: 'good', name: 'Good', version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://good', timeout_ms: 50 },
};

class Exec implements IToolExecutor {
  async execute(tool: Tool, _input: JsonRecord): Promise<ExecutionResult> {
    if (tool.id === 'bad') return { status: 'success', latency_ms: 5, output: { id: 'x' } }; // missing name
    return { status: 'success', latency_ms: 5, output: { id: 'y', name: 'Alice' } };
  }
}

const doc: PolicyDoc = {
  schemaVersion: '1.0',
  default: {
    postSchemas: {
      'patient.search': {
        type: 'object',
        required: ['id', 'name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
      },
    },
  },
};

describe('policy post-check fallback', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    const policy = new PolicyService(doc);
    const registry: IRegistryService = {
      list: () => [t1, t2],
      getRegistry: () => ({ tools: [t1, t2], updatedAt: new Date().toISOString() }),
    };
    const planner = new Planner(registry, new SimpleScorer(), new Exec(), new TraceStore(), policy);

    app = buildApp({
      registry,
      planner,
      traces: new TraceStore(),
      policy,
    });
    await app.ready();         // <<< IMPORTANT
  });

  afterAll(async () => {
    await app.close();         // <<< IMPORTANT
  });

  it('falls back to good tool when bad output violates post-schema', async () => {
    const res = await request(app.server)
      .post('/plan')
      .send({ capability: 'patient.search', input: { mrn: '123' }, execute: true });

    expect(res.status).toBe(200);
    expect(res.body.selected?.toolId).toBe('good');
    expect(res.body.execution?.status).toBe('success');
  });
});
