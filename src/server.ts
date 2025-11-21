// src/server.ts
import { buildApp } from './app';
import { loadConfig } from './config/env';
import { FileRegistryLoader } from './registry/fileRegistryLoader';
import { RegistryService } from './registry/service';
import { toolsLoaded, toolLoadErrors } from './metrics/metrics';
import { SimpleScorer } from './planner/scoring.simple';
import { Planner } from './planner/planner';
import { HttpExecutor } from './executors/httpExecutor';
import { TraceStore } from './tracing/traceStore';

// Policy & guardrails (used by /plan route for pre-checks)
import { FilePolicyLoader } from './policy/loader.file';
import { PolicyService } from './policy/service';

async function main(): Promise<void> {
  const cfg = loadConfig();

  // --- Registry bootstrap ---
  const loader = new FileRegistryLoader(cfg.registryDir);
  try {
    await loader.start();
    toolsLoaded.set(loader.getRegistry().tools.length);
  } catch (e) {
    toolLoadErrors.inc();
    // eslint-disable-next-line no-console
    console.error('Failed to start registry loader', e);
  }

  // --- Core singletons ---
  const registry = new RegistryService(loader);
  const scorer = new SimpleScorer();
  const executor = new HttpExecutor();
  const traces = new TraceStore({ maxTraces: 2000, ttlMs: 15 * 60_000 }); // 15 minutes

  // --- Policy & Guardrails (used by routes, not by Planner) ---
  const policyDoc = await new FilePolicyLoader(cfg.policyPath).load();
  const policy = new PolicyService(policyDoc);

  // Keep Planner signature as-is: (registry, scorer, executor, traces)
  const planner = new Planner(registry, scorer, executor, traces);

  // App composition: pass policy to routes (for pre-checks), not to Planner
  const app = buildApp({ registry, planner, traces, policy });

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

void main();
