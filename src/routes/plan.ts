/**
 * /plan endpoint: selects (and optionally executes) the best tool for a capability.
 * Request body schema is permissive; planner enforces behavior.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { IPlanner } from '../planner/contracts';
import type { PlanContext } from '../planner/contracts';

export async function planRoutes(app: FastifyInstance, deps: { planner: IPlanner }): Promise<void> {
  app.post(
    '/plan',
    {
      schema: {
        description: 'Select (and optionally execute) the best tool for a requested capability',
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            capability: { type: 'string' },
            text: { type: 'string' },
            input: { type: 'object' },
            context: { type: 'object' },
            timeout_ms: { type: 'integer', minimum: 1 },
            execute: { type: 'boolean' }
          }
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
                    score: { type: 'number' }
                  },
                  required: ['toolId', 'score']
                }
              },
              selected: {
                type: 'object',
                properties: { toolId: { type: 'string' } },
                required: ['toolId']
              },
              execution: {
                type: 'object',
                properties: {
                  status: { enum: ['success', 'failure', 'timeout'] },
                  latency_ms: { type: 'number' },
                  error: { type: 'string' },
                  output: { type: 'object' }
                }
              }
            },
            required: ['traceId', 'capability', 'candidates']
          }
        }
      }
    },
    async (req: FastifyRequest<{ Body: PlanContext }>, reply) => {
      const res = await deps.planner.plan(req.body);
      return reply.code(200).send(res);
    }
  );
}
