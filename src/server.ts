import { buildApp } from './app';
import { loadConfig } from './config/env';
import { FileRegistryLoader } from './registry/fileRegistryLoader';
import { RegistryService } from './registry/service';
import { toolsLoaded, toolLoadErrors } from './metrics/metrics';

async function main(): Promise<void> {
  const cfg = loadConfig();
  const loader = new FileRegistryLoader(cfg.registryDir);

  try {
    await loader.start();
    toolsLoaded.set(loader.getRegistry().tools.length);
  } catch (e) {
    toolLoadErrors.inc();
    // eslint-disable-next-line no-console
    console.error('Failed to start registry loader', e);
  }

  const registry = new RegistryService(loader);
  const app = buildApp({ registry });

  await app.listen({ port: cfg.port, host: '0.0.0.0' });
}

void main();
