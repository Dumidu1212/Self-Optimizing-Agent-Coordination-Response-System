import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { toolSchema, registrySchema } from './registry/model';
import { toolsRoutes } from './routes/tools';
import { metricsRoutes } from './metrics/metrics';
import { planRoutes } from './routes/plan';
import type { IRegistryService } from './registry/service';
import type { IPlanner } from './planner/contracts';

/**
 * Build the Fastify application with schemas, routes, and Swagger UI.
 */
export function buildApp(deps: { registry: IRegistryService; planner: IPlanner }): FastifyInstance {
  const app = Fastify({ logger: true });

  app.addSchema({ $id: 'Tool', ...toolSchema });
  app.addSchema({ $id: 'ToolRegistry', ...registrySchema });

  app.register(swagger, { openapi: { info: { title: 'Agentic Orchestrator', version: '0.2.0' } } });
  app.register(swaggerUI, { routePrefix: '/docs' });

  app.register(async (instance) => {
    await toolsRoutes(instance, { registry: deps.registry });
    await planRoutes(instance, { planner: deps.planner });
    await metricsRoutes(instance);
  });

  return app;
}
