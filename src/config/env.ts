import 'dotenv/config';

/**
 * Application configuration shape.
 *
 * Values are loaded from environment variables with sensible defaults.
 * Optional fields are only present if the corresponding env var is set.
 */
export type AppConfig = {
  /** Port that the HTTP server listens on (e.g. 8080). */
  port: number;

  /** Directory where tool/agent registry definitions are stored. */
  registryDir: string;

  /**
   * OpenTelemetry OTLP endpoint for tracing/metrics export.
   * Example: "http://localhost:4318"
   * Optional: if unset, telemetry can be considered disabled.
   */
  otlpEndpoint?: string;

  /** Path to the policy file (YAML/JSON) loaded by the policy loader. */
  policyPath: string;

  /**
   * Execution mode for the coordinator.
   * - "local"        → execute tools directly inside this process.
   * - "orchestrator" → delegate execution to an external orchestrator service.
   */
  executionMode: 'local' | 'orchestrator';

  /**
   * Base URL for the orchestrator when executionMode = "orchestrator".
   * Example: "http://orchestrator:3000"
   */
  orchestratorUrl?: string;

  /**
   * Timeout (in milliseconds) when calling the orchestrator.
   * Used only when executionMode = "orchestrator".
   */
  orchestratorTimeoutMs: number;
};

/**
 * Load application configuration from environment variables.
 *
 * Environment variables used:
 *  - PORT                      → AppConfig.port (default: 8080)
 *  - REGISTRY_DIR              → AppConfig.registryDir (default: "./registry")
 *  - OTEL_EXPORTER_OTLP_ENDPOINT → AppConfig.otlpEndpoint (optional)
 *  - POLICY_PATH               → AppConfig.policyPath (default: "./policy/policy.yaml")
 *  - EXECUTION_MODE            → AppConfig.executionMode ("local" | "orchestrator", default: "local")
 *  - ORCH_URL                  → AppConfig.orchestratorUrl (optional)
 *  - ORCH_TIMEOUT_MS           → AppConfig.orchestratorTimeoutMs (default: 2000)
 *
 * @returns Fully constructed AppConfig object.
 */
export function loadConfig(): AppConfig {
  // Parse port from env or use default 8080
  const port = Number(process.env.PORT ?? 8080);

  // Directory where registry files (tools/agents) live
  const registryDir = process.env.REGISTRY_DIR ?? './registry';

  // Optional OpenTelemetry OTLP endpoint (if unset, feature can be disabled downstream)
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

  // Policy file path (YAML/JSON) used by the policy loader
  const policyPath = process.env.POLICY_PATH ?? './policy/policy.yaml';

  // Execution mode: "local" or "orchestrator" (default: "local")
  const executionMode =
    (process.env.EXECUTION_MODE as 'local' | 'orchestrator') ?? 'local';

  // Optional orchestrator base URL (only meaningful when executionMode = "orchestrator")
  const orchestratorUrl = process.env.ORCH_URL;

  // Timeout for orchestrator calls in milliseconds (default: 2000ms)
  const orchestratorTimeoutMs = Number(process.env.ORCH_TIMEOUT_MS ?? 2000);

  // Base config with required properties only
  const config: AppConfig = {
    port,
    registryDir,
    policyPath,
    executionMode,
    orchestratorTimeoutMs,
  };

  // Conditionally add optional properties only when they are defined.
  // This matches `exactOptionalPropertyTypes` semantics: if present → must be a string.
  if (otlpEndpoint !== undefined) {
    config.otlpEndpoint = otlpEndpoint;
  }

  if (orchestratorUrl !== undefined) {
    config.orchestratorUrl = orchestratorUrl;
  }

  return config;
}
