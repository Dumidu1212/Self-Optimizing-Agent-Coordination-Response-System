import { FastifyInstance } from 'fastify';
import client from 'prom-client';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const toolsLoaded = new client.Gauge({ name: 'tools_loaded', help: 'Number of tools loaded' });
export const toolLoadErrors = new client.Counter({ name: 'tool_load_errors', help: 'Registry load errors' });

registry.registerMetric(toolsLoaded);
registry.registerMetric(toolLoadErrors);

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', registry.contentType);
    return reply.send(await registry.metrics());
  });
}
