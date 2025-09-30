import 'dotenv/config';

export type AppConfig = {
  port: number;
  registryDir: string;
  otlpEndpoint?: string;
};

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 8080);
  const registryDir = process.env.REGISTRY_DIR ?? './registry';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  return {
    port,
    registryDir,
    ...(otlpEndpoint !== undefined ? { otlpEndpoint } : {})
  };
}
