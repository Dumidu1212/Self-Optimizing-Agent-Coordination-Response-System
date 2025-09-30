import 'dotenv/config';

export type AppConfig = {
  port: number;
  registryDir: string;
  otlpEndpoint?: string; // optional: present only when defined
};

export function loadConfig(): AppConfig {
  const port = Number(process.env.PORT ?? 8080);
  const registryDir = process.env.REGISTRY_DIR ?? './registry';
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  // Omit the property when it's undefined (required by exactOptionalPropertyTypes)
  return {
    port,
    registryDir,
    ...(otlpEndpoint !== undefined ? { otlpEndpoint } : {})
  };
}
