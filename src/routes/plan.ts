/**
 * /plan endpoint: selects (and optionally executes) the best tool for a capability.
 * Runs policy pre-conditions before invoking the planner.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { IPlanner, PlanContext } from '../planner/contracts';
import type { IPolicyService } from '../policy/model';

/**
 * Register /plan routes on the Fastify app.
 *
 * @param app  Fastify instance to decorate.
 * @param deps Dependencies: planner + policy service.
 */
export async function planRoutes(
  app: FastifyInstance,
  deps: { planner: IPlanner; policy: IPolicyService },
): Promise<void> {
  app.post(
    '/plan',
    {
      schema: {
        description:
          'Select (and optionally execute) the best tool for a requested capability',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            tenant: { type: 'string' },
            capability: { type: 'string' },
            text: { type: 'string' }, // optional free-text context (not required by planner)
            input: { type: 'object' },
            context: { type: 'object' }, // optional extra context envelope
            timeout_ms: { type: 'integer', minimum: 1 },
            execute: { type: 'boolean' },
          },
          // capability is required for meaningful planning
          required: ['capability'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              traceId: { type: 'string' },
              capability: { type: 'string' },
              candidates: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    toolId: { type: 'string' },
                    score: { type: 'number' },
                  },
                  required: ['toolId', 'score'],
                },
              },
              selected: {
                type: 'object',
                properties: { toolId: { type: 'string' } },
                required: ['toolId'],
              },
              execution: {
                type: 'object',
                properties: {
                  status: { enum: ['success', 'failure', 'timeout'] },
                  latency_ms: { type: 'number' },
                  error: { type: 'string' },
                  output: { type: 'object' },
                },
              },
            },
            required: ['traceId', 'capability', 'candidates'],
          },
          403: {
            type: 'object',
            properties: {
              traceId: { type: ['string', 'null'] },
              capability: { type: 'string' },
              candidates: { type: 'array', items: { type: 'object' } },
              execution: {
                type: 'object',
                properties: {
                  status: { const: 'failure' },
                  error: { const: 'POLICY_DENIED' },
                  detail: { type: 'string' },
                },
                required: ['status', 'error'],
              },
            },
            required: ['capability', 'execution'],
          },
        },
      },
    },
    async (
      req: FastifyRequest<{
        // JSON schema guarantees capability is present, so we override it to be required here.
        Body: PlanContext & { capability: string };
      }>,
      reply,
    ) => {
      const { tenant, capability, input, execute, timeout_ms } = req.body;

      // ----------------- Policy pre-check (deny early with 403) -----------------

      // Build the pre-check context in a way that respects exactOptionalPropertyTypes:
      // - Only set `tenant` if it is actually defined.
      const preCtx: Parameters<IPolicyService['preCheck']>[0] = {
        capability,
        input,
      };
      if (tenant !== undefined) {
        preCtx.tenant = tenant;
      }

      const pre = deps.policy.preCheck(preCtx);

      if (!pre.allow) {
        return reply.code(403).send({
          traceId: null,
          capability,
          candidates: [],
          execution: {
            status: 'failure',
            error: 'POLICY_DENIED',
            // You can choose pre.code or pre.detail depending on what you want exposed
            detail: pre.code ?? 'POLICY_DENIED',
          },
        });
      }

      // ----------------- Delegate to planner -----------------

      // Build the planner context explicitly to avoid T | undefined issues:
      const plannerCtx: PlanContext = {
        // capability is required (string) here because of the FastifyRequest override
        capability,
        input: input ?? {},
        execute: execute !== false, // default: execute = true
      };

      // Only set optional properties when they are defined.
      if (tenant !== undefined) {
        plannerCtx.tenant = tenant;
      }
      if (timeout_ms !== undefined) {
        plannerCtx.timeout_ms = timeout_ms;
      }

      const res = await deps.planner.plan(plannerCtx);

      return reply.code(200).send(res);
    },
  );
}
