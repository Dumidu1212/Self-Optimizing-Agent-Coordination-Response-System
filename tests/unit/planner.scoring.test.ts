import { SimpleScorer } from '../../src/planner/scoring.simple';
import type { Tool } from '../../src/registry/model';

const baseTool: Tool = {
  id: 't',
  name: 'T',
  version: '1.0.0',
  capabilities: [{ name: 'patient.search', inputs: {}, outputs: {} }],
  endpoint: { type: 'http', url: 'http://example', timeout_ms: 1000 },
  sla: { p95_ms: 500, success_rate_min: 0.98 },
  cost_estimate: 0.1
};

describe('SimpleScorer', () => {
  it('gives higher score to better SLA and lower cost', () => {
    const scorer = new SimpleScorer();
    const ctx = { capability: 'patient.search', input: {} };

    const fastCheap: Tool = { ...baseTool, id: 'fastCheap', sla: { p95_ms: 200, success_rate_min: 0.99 }, cost_estimate: 0.05 };
    const slowExpensive: Tool = { ...baseTool, id: 'slowExp', sla: { p95_ms: 3000, success_rate_min: 0.97 }, cost_estimate: 0.8 };

    const s1 = scorer.score(fastCheap, ctx);
    const s2 = scorer.score(slowExpensive, ctx);

    expect(s1).toBeGreaterThan(s2);
  });
});
