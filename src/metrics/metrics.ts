import { type FastifyInstance } from 'fastify';
import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

/** Gauge: number of tools currently loaded into the registry. */
export const toolsLoaded = new client.Gauge({ name: 'tools_loaded', help: 'Number of tools loaded' });

/** Counter: number of registry load/validation errors observed since process start. */
export const toolLoadErrors = new client.Counter({ name: 'tool_load_errors', help: 'Registry load errors' });

/** Counter: how many scoring bids the planner made per capability/tool. */
export const plannerBidsTotal = new client.Counter({
  name: 'planner_bids_total',
  help: 'Number of planner bids (candidate scores) made',
  labelNames: ['capability', 'tool'] as const
});

/** Counter: selections made by the planner per capability/tool. */
export const plannerSelectionTotal = new client.Counter({
  name: 'planner_selection_total',
  help: 'Number of selections made by the planner',
  labelNames: ['capability', 'tool'] as const
});

/** Counter: fallbacks performed by the planner per capability. */
export const plannerFallbacksTotal = new client.Counter({
  name: 'planner_fallbacks_total',
  help: 'Number of planner fallbacks after a candidate failure/timeout',
  labelNames: ['capability'] as const
});

/** Histogram: time to run the selected tool (can be extended). */
export const plannerExecutionLatencyMs = new client.Histogram({
  name: 'planner_execution_latency_ms',
  help: 'Latency for executing selected tool',
  buckets: [50, 100, 200, 400, 800, 1600, 3200, 6400],
  labelNames: ['tool'] as const
});

register.registerMetric(toolsLoaded);
register.registerMetric(toolLoadErrors);
register.registerMetric(plannerBidsTotal);
register.registerMetric(plannerSelectionTotal);
register.registerMetric(plannerFallbacksTotal);
register.registerMetric(plannerExecutionLatencyMs);

/**
 * Register the Prometheus /metrics endpoint.
 * @param {FastifyInstance} app - Fastify instance to register the route on.
 */
export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/metrics', async (_req, reply) => {
    reply.header('Content-Type', register.contentType);
    return reply.send(await register.metrics());
  });
}
