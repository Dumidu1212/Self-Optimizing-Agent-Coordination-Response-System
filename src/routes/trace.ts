import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { TraceStore } from '../tracing/traceStore';

type Params = { id: string };

export async function traceRoutes(app: FastifyInstance, deps: { traces: TraceStore }): Promise<void> {
  app.get(
    '/trace/:id',
    {
      schema: {
        description: 'Fetch a full decision/execution trace by ID',
        params: {
          type: 'object',
          required: ['id'],
          properties: { id: { type: 'string' } }
        },
        response: {
          200: {
            type: 'object',
            required: ['id', 'createdAt', 'events'],
            properties: {
              id: { type: 'string' },
              createdAt: { type: 'number' },
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['ts', 'type'],
                  properties: {
                    ts: { type: 'number' },
                    type: { type: 'string' },
                    data: { type: 'object' }
                  },
                  additionalProperties: false
                }
              }
            },
            additionalProperties: false
          },
          404: {
            type: 'object',
            required: ['message'],
            properties: { message: { type: 'string' } },
            additionalProperties: false
          }
        }
      }
    },
    async (req: FastifyRequest<{ Params: Params }>, reply) => {
      const t = deps.traces.get(req.params.id);
      if (!t) return reply.code(404).send({ message: 'Trace not found or expired' });
      return reply.code(200).send(t);
    }
  );
}
