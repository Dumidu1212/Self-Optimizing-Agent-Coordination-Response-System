// src/app.ts
import Fastify, { type FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { toolSchema, registrySchema } from './registry/model';
import { toolsRoutes } from './routes/tools';
import { metricsRoutes } from './metrics/metrics';
import { planRoutes } from './routes/plan';
import { traceRoutes } from './routes/trace';
import type { IRegistryService } from './registry/service';
import type { IPlanner } from './planner/contracts';
import type { TraceStore } from './tracing/traceStore';
import type { IPolicyService } from './policy/model';

/** Build the Fastify application with schemas, routes, Swagger UI, and policy wiring. */
export function buildApp(deps: {
  registry: IRegistryService;
  planner: IPlanner;
  traces: TraceStore;
  policy: IPolicyService;
}): FastifyInstance {
  const app = Fastify({ logger: true });

  // JSON Schemas used by routes (for swagger & validation reuse)
  app.addSchema({ $id: 'Tool', ...toolSchema });
  app.addSchema({ $id: 'ToolRegistry', ...registrySchema });

  // OpenAPI / Swagger UI
  app.register(swagger, { openapi: { info: { title: 'Agentic Orchestrator', version: '0.3.0' } } });
  app.register(swaggerUI, { routePrefix: '/docs' });

  // Routes: keep registration order deterministic
  app.register(async (instance) => {
    // Tool registry endpoints
    await toolsRoutes(instance, { registry: deps.registry });

    // Planning endpoint (uses policy pre-checks)
    await planRoutes(instance, { planner: deps.planner, policy: deps.policy });

    // Tracing and metrics
    await traceRoutes(instance, { traces: deps.traces });
    await metricsRoutes(instance);
  });

  return app;
}
