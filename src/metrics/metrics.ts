import { type FastifyInstance } from 'fastify';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const toolsLoaded = new client.Gauge({ name: 'tools_loaded', help: 'Number of tools loaded' });
export const toolLoadErrors = new client.Counter({ name: 'tool_load_errors', help: 'Registry load errors' });

register.registerMetric(toolsLoaded);
register.registerMetric(toolLoadErrors);

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });
}
