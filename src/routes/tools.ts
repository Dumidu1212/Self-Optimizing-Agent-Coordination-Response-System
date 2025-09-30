import { FastifyInstance } from 'fastify';
import { validator } from '../registry/validator';
import type { IRegistryService } from '../registry/service';

export async function toolsRoutes(app: FastifyInstance, deps: { registry: IRegistryService }) {
  app.post('/tools/validate', {
    schema: {
      description: 'Validate a single tool definition',
      body: { $ref: 'Tool#' },
      response: { 200: { type: 'object', properties: { valid: { type: 'boolean' }, errors: { type: 'array', items: { type: 'string' } } } } }
    }
  }, async (req, reply) => {
    const res = validator.validateTool((req as any).body);
    return reply.code(200).send(res);
  });

  app.get('/tools', {
    schema: { description: 'List registered tools', response: { 200: { type: 'array', items: { $ref: 'Tool#' } } } }
  }, async (_req, reply) => {
    return reply.code(200).send(deps.registry.list());
  });
}
