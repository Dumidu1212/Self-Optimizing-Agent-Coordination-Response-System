import { buildApp } from './app';
import { loadConfig } from './config/env';
import { FileRegistryLoader } from './registry/fileRegistryLoader';
import { RegistryService } from './registry/service';
import { toolsLoaded, toolLoadErrors } from './metrics/metrics';

async function main() {
  const cfg = loadConfig();
  const loader = new FileRegistryLoader(cfg.registryDir);
  try {
    await loader.start();
    toolsLoaded.set(loader.getRegistry().tools.length);
  } catch (e) {
    toolLoadErrors.inc();
    console.error('Failed to start registry loader', e);
  }
  const registry = new RegistryService(loader);
  const app = buildApp({ registry });
  app.listen({ port: cfg.port, host: '0.0.0.0' }).catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}
main();
