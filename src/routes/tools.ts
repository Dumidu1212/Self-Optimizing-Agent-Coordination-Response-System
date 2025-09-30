import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { validator } from '../registry/validator';
import type { IRegistryService } from '../registry/service';
import type { Tool } from '../registry/model';

type ValidateToolRequest = FastifyRequest<{ Body: Tool }>;

export async function toolsRoutes(
  app: FastifyInstance,
  deps: { registry: IRegistryService }
): Promise<void> {
  app.post(
    '/tools/validate',
    {
      schema: {
        description: 'Validate a single tool definition',
        body: { $ref: 'Tool#' },
        response: {
          200: {
            type: 'object',
            properties: {
              valid: { type: 'boolean' },
              errors: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    },
    async (req: ValidateToolRequest, reply) => {
      const result = validator.validateTool(req.body);
      return reply.code(200).send(result);
    }
  );

  app.get(
    '/tools',
    {
      schema: {
        description: 'List registered tools',
        response: { 200: { type: 'array', items: { $ref: 'Tool#' } } }
      }
    },
    async (_req, reply) => {
      const tools = deps.registry.list();
      return reply.code(200).send(tools);
    }
  );
}
