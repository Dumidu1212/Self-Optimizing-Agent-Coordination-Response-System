import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { DateTime } from 'luxon';
import type {
  IPolicyService,
  PolicyDoc,
  TenantPolicy,
  PreDecision,
  PostDecision,
  JSONSchema,
} from './model';

/**
 * Cache container for compiled Ajv validators.
 *
 * - `pre`  holds validators for pre-execution (input) schemas.
 * - `post` holds validators for post-execution (output) schemas.
 *
 * The key is the capability string (e.g. "patient.search").
 */
type Compiled = {
  pre: Map<string, (data: unknown) => boolean>;
  post: Map<string, (data: unknown) => boolean>;
};

/**
 * PolicyService
 *
 * Responsibilities:
 *  - Select the relevant policy rules for a tenant + capability.
 *  - Enforce capability-based allow/deny rules.
 *  - Enforce optional time-window restrictions.
 *  - Validate inputs and outputs against JSON Schemas using Ajv.
 *
 * This service is the runtime policy engine that operates on a `PolicyDoc`.
 */
export class PolicyService implements IPolicyService {
  /**
   * Shared Ajv instance used to compile and run JSON schema validations.
   * Configured with:
   *  - `strict: true` for stricter JSON Schema adherence.
   *  - `allErrors: true` to collect all validation errors (if needed).
   */
  private readonly ajv = new Ajv({ strict: true, allErrors: true });

  /**
   * In-memory cache of compiled schemas per capability.
   * Avoids recompiling the same schema on every request.
   */
  private readonly compiled: Compiled = { pre: new Map(), post: new Map() };

  /**
   * @param doc The in-memory policy document loaded from file (YAML/JSON)
   *            and expected to conform to PolicyDoc.
   */
  constructor(private readonly doc: PolicyDoc) {
    // Add built-in format validators (e.g. "email", "uri") if used in schemas.
    addFormats(this.ajv);
  }

  /**
   * Perform pre-execution checks for a capability invocation.
   *
   * Steps:
   *  1. Fetch tenant-specific or default rules.
   *  2. Enforce allow/deny capability lists.
   *  3. Enforce time window restrictions (if configured).
   *  4. Validate the input payload against the pre-schema (if any).
   *
   * @param ctx Context including tenant, capability, input, and optional "now".
   * @returns A PreDecision indicating whether to allow or reject.
   */
  preCheck(ctx: { tenant?: string; capability: string; input: unknown; now?: Date }): PreDecision {
    const rules = this.rulesFor(ctx.tenant);
    const cap = ctx.capability;

    // 1) Capability allow-list: if defined, capability must be present in allowCapabilities
    if (rules.allowCapabilities && !rules.allowCapabilities.includes(cap)) {
      return { allow: false, code: 'CAPABILITY_DENIED', detail: 'Not in allowCapabilities' };
    }

    // 2) Capability deny-list: if defined and capability is present, reject
    if (rules.denyCapabilities && rules.denyCapabilities.includes(cap)) {
      return { allow: false, code: 'CAPABILITY_DENIED', detail: 'Listed in denyCapabilities' };
    }

    // 3) Time-window enforcement (if defined for this tenant)
    if (rules.timeWindows?.allow && rules.timeWindows.allow.length > 0) {
      const tz = rules.timeWindows.tz ?? 'UTC';
      // Use provided "now" if present (good for tests), else system time
      const now = DateTime.fromJSDate(ctx.now ?? new Date(), { zone: tz });

      if (!this.inAnyWindow(now, rules.timeWindows.allow)) {
        return { allow: false, code: 'TIME_DENIED', detail: `Outside allowed windows (${tz})` };
      }
    }

    // 4) Input validation against pre-schema
    const schema = rules.preSchemas?.[cap];
    if (schema) {
      const ok = this.compile('pre', cap, schema)(ctx.input);
      if (!ok) {
        return {
          allow: false,
          code: 'INPUT_INVALID',
          detail: 'Pre-schema validation failed',
        };
      }
    }

    // All checks passed
    return { allow: true };
  }

  /**
   * Perform post-execution checks for a capability invocation.
   *
   * Steps:
   *  1. Fetch tenant-specific or default rules.
   *  2. If a post-schema exists for this capability, validate the output.
   *
   * @param args Context including tenant, capability, and operation output.
   * @returns A PostDecision indicating whether the result is acceptable.
   */
  postCheck(args: { tenant?: string; capability: string; output: unknown }): PostDecision {
    const rules = this.rulesFor(args.tenant);

    // Post-condition schema for this capability, if any
    const schema = rules.postSchemas?.[args.capability];
    if (!schema) return { pass: true }; // No post-schema => no extra checks

    const ok = this.compile('post', args.capability, schema)(args.output);
    if (!ok) {
      return {
        pass: false,
        code: 'POST_CONDITION_FAILED',
        detail: 'Post-schema validation failed',
      };
    }

    return { pass: true };
  }

  // ---------------------------------------------------------------------------
  //                             Helper methods
  // ---------------------------------------------------------------------------

  /**
   * Resolve policy rules for a given tenant.
   *
   * Precedence:
   *  1. If tenant is provided and `doc.tenants[tenant]` exists, use that.
   *  2. Otherwise, fall back to `doc.default` (global default rules).
   */
  private rulesFor(tenant?: string): TenantPolicy {
    if (tenant && this.doc.tenants && this.doc.tenants[tenant]) {
      // Non-null assertion is safe because we just checked existence
      return this.doc.tenants[tenant]!;
    }
    return this.doc.default ?? {};
  }

  /**
   * Get or compile an Ajv validator for a given capability and schema.
   *
   * - Uses separate caches for pre and post validators.
   * - Returns a simple `(data: unknown) => boolean` wrapper.
   *
   * @param kind "pre" for input validation, "post" for output validation.
   * @param capability Capability key used as cache key.
   * @param schema JSON schema describing expected data shape.
   */
  private compile(
    kind: 'pre' | 'post',
    capability: string,
    schema: JSONSchema,
  ): (data: unknown) => boolean {
    const cache = kind === 'pre' ? this.compiled.pre : this.compiled.post;

    // Return cached validator if already compiled
    const cached = cache.get(capability);
    if (cached) return cached;

    // Compile new Ajv validator
    const fn = this.ajv.compile(schema);

    // Wrap Ajv's function to normalize return type to boolean
    const validator = (data: unknown): boolean => fn(data) === true;

    // Cache it for future use
    cache.set(capability, validator);
    return validator;
  }

  /**
   * Check if the current time is within any of the allowed time windows.
   *
   * @param now A Luxon DateTime in the relevant timezone.
   * @param windows Array of window specs, e.g. ["Mon-Fri 09:00-17:00", "Sat 10:00-14:00"]
   */
  private inAnyWindow(now: DateTime, windows: string[]): boolean {
    return windows.some((w) => this.inWindow(now, w));
  }

  /**
   * Check if the current time is within a single time window specification.
   *
   * Window format:
   *  - "Mon-Fri 09:00-17:00"
   *  - "Sat 10:00-14:00"
   *  - "Sun"  (no hours => any time on that day)
   *
   * @param now Luxon DateTime in the correct timezone.
   * @param window Window spec string.
   */
  private inWindow(now: DateTime, window: string): boolean {
    // Split into two parts: days part and hours part (if any)
    const [daysPartRaw, hoursPartRaw] = window.split(' ').map((s) => s.trim());
    const daysPart = daysPartRaw ?? '';
    const hoursPart = hoursPartRaw ?? '';

    const weekday = now.weekday; // 1..7 (Mon..Sun according to Luxon)

    // Check if today matches the day spec
    const okDay = this.matchDay(weekday, daysPart);
    if (!okDay) return false;

    // If there is no hours part, then any time on this day is allowed
    if (hoursPart.length === 0) return true;

    // Parse hours spec: "HH:MM-HH:MM"
    const [startRaw, endRaw] = hoursPart.split('-').map((s) => s.trim());

    // With noUncheckedIndexedAccess, these are string | undefined
    if (!startRaw || !endRaw) {
      // Invalid time window spec → safest is to treat as not matching
      return false;
    }

    const startMin = this.hmToMinutes(startRaw);
    const endMin = this.hmToMinutes(endRaw);
    const nowMin = now.hour * 60 + now.minute;

    return nowMin >= startMin && nowMin <= endMin;
  }

  /**
   * Match a weekday against a day specification.
   *
   * Day spec formats:
   *  - Single day: "Mon", "Tue", ..., "Sun"
   *  - Range: "Mon-Fri", "Sat-Sun"
   *
   * @param weekday Numeric weekday (1=Mon, ..., 7=Sun) from Luxon.
   * @param spec    Day spec string, e.g. "Mon-Fri" or "Sun".
   */
  private matchDay(weekday: number, spec: string): boolean {
    const map: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };

    // Range form: "Mon-Fri"
    if (spec.includes('-')) {
      const parts = spec.split('-').map((s) => s.trim());
      const a = parts[0];
      const b = parts[1];

      // With noUncheckedIndexedAccess, a/b are string | undefined
      if (!a || !b) return false; // invalid range spec

      const start = map[a];
      const end = map[b];

      if (!start || !end) return false; // unknown day label

      return weekday >= start && weekday <= end;
    }

    // Single day form: "Mon"
    const one = map[spec];
    return !!one && weekday === one;
  }

  /**
   * Convert "HH:MM" time string into minutes since midnight.
   *
   * Example:
   *  - "09:30" → 9 * 60 + 30 = 570
   *  - "00:00" → 0
   *
   * @param hhmm Time string in "HH:MM" format.
   */
  private hmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  }
}
