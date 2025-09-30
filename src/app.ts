import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { toolSchema, registrySchema } from './registry/model';
import { toolsRoutes } from './routes/tools';
import { metricsRoutes } from './metrics/metrics';
import type { IRegistryService } from './registry/service';

export function buildApp(deps: { registry: IRegistryService }): FastifyInstance {
  const app = Fastify({ logger: true });

  app.addSchema({ $id: 'Tool', ...toolSchema });
  app.addSchema({ $id: 'ToolRegistry', ...registrySchema });

  app.register(swagger, { openapi: { info: { title: 'Agentic Orchestrator', version: '0.1.0' } } });
  app.register(swaggerUI, { routePrefix: '/docs' });

  app.register(async (instance) => {
    await toolsRoutes(instance, deps);
    await metricsRoutes(instance);
  });

  return app;
}
