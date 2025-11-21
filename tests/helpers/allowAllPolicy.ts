import type { IPolicyService, PreDecision, PostDecision } from '../../src/policy/model';

export const allowAllPolicy: IPolicyService = {
  preCheck(_input: { tenant?: string; capability: string; input: unknown; now?: Date }): PreDecision {
    return { allow: true };
  },
  postCheck(_input: { tenant?: string; capability: string; output: unknown }): PostDecision {
    // NOTE: PostDecision uses `pass: true|false`, not `allow`
    return { pass: true };
  },
};
