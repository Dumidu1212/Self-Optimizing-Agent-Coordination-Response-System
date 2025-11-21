/**
 * Policy model for pre/post-conditions.
 * - Pre: filter/deny requests before planning begins.
 * - Post: validate tool outputs; failure triggers planner fallback.
 */
export type CapabilityName = string;
export type JSONSchema = Record<string, unknown>;

export type PolicyDoc = {
  schemaVersion: '1.0';
  tenants?: Record<string, TenantPolicy>;
  default?: TenantPolicy;
};

export type TenantPolicy = {
  allowCapabilities?: CapabilityName[]; // allowlist; if present, only these pass
  denyCapabilities?: CapabilityName[];  // explicit deny
  timeWindows?: {
    tz?: string;       // e.g., "Asia/Colombo"
    allow?: string[];  // e.g., ["Mon-Fri 08:00-20:00", "Sat 09:00-12:00"]
  };
  preSchemas?: Record<CapabilityName, JSONSchema>;   // input schema by capability
  postSchemas?: Record<CapabilityName, JSONSchema>;  // output schema by capability
};

export type PreDecision =
  | { allow: true }
  | { allow: false; code: 'TENANT_DENIED' | 'CAPABILITY_DENIED' | 'TIME_DENIED' | 'INPUT_INVALID'; detail?: string };

export type PostDecision =
  | { pass: true }
  | { pass: false; code: 'POST_CONDITION_FAILED'; detail?: string };

export interface IPolicyService {
  preCheck(ctx: { tenant?: string; capability: string; input: unknown; now?: Date }): PreDecision;
  postCheck(args: { tenant?: string; capability: string; output: unknown }): PostDecision;
}
