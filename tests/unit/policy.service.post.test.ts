import { PolicyService } from '../../src/policy/service';
import type { PolicyDoc } from '../../src/policy/model';

const doc: PolicyDoc = {
  schemaVersion: '1.0',
  default: {
    postSchemas: {
      'patient.search': {
        type: 'object',
        required: ['id', 'name'],
        properties: { id: { type: 'string' }, name: { type: 'string' } },
        additionalProperties: true
      }
    }
  }
};

describe('PolicyService post', () => {
  it('passes when output satisfies schema', () => {
    const svc = new PolicyService(doc);
    const ok = svc.postCheck({ capability: 'patient.search', output: { id: 'p1', name: 'Alice' } });
    expect(ok.pass).toBe(true);
  });

  it('fails when output violates schema', () => {
    const svc = new PolicyService(doc);
    const bad = svc.postCheck({ capability: 'patient.search', output: { id: 'p1' } });
    expect(bad.pass).toBe(false);
  });
});
