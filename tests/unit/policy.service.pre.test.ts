import { PolicyService } from '../../src/policy/service';
import type { PolicyDoc } from '../../src/policy/model';

const doc: PolicyDoc = {
  schemaVersion: '1.0',
  default: {
    allowCapabilities: ['patient.search', 'billing.charge'],
    denyCapabilities: ['admin.delete'],
    timeWindows: { tz: 'UTC', allow: ['Mon-Fri 00:00-23:59'] },
    preSchemas: {
      'patient.search': {
        type: 'object',
        required: ['mrn'],
        properties: { mrn: { type: 'string', minLength: 3 } },
        additionalProperties: false
      }
    },
    postSchemas: {}
  }
};

describe('PolicyService pre', () => {
  it('denies capability not in allow list', () => {
    const svc = new PolicyService(doc);
    const res = svc.preCheck({ capability: 'unknown.cap', input: {} });
    expect(res.allow).toBe(false);
  });

  it('denies on pre-schema invalid', () => {
    const svc = new PolicyService(doc);
    const res = svc.preCheck({ capability: 'patient.search', input: {} });
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.code).toBe('INPUT_INVALID');
  });

  it('allows valid inputs within time window', () => {
    const svc = new PolicyService(doc);
    const res = svc.preCheck({ capability: 'patient.search', input: { mrn: '12345' } });
    expect(res.allow).toBe(true);
  });
});
