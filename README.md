# Coordinator Core — Self‑Optimizing Agent Coordination & Response System

The Coordinator Core is an agentic middleware service that discovers, validates, and exposes callable capabilities (“tools”) and provides the foundation for capability‑based routing, policy‑driven selection, and execution tracing across the Self‑Optimizing Agent Coordination & Response System.

---

## Highlights

- **Schema‑validated Tool Registry** with hot‑reload (YAML/JSON → JSON Schema via Ajv)
- **Capability Discovery API**: list routable tools and validate new tool definitions
- **Production‑grade foundations**: Fastify + TypeScript (strict), structured logging (pino), Prometheus metrics
- **Clean architecture**: SOLID, DRY, Separation of Concerns, Dependency Inversion
- **Ready for integration** with Policy Engine, Memory/Vector Store, Safety/Governance, Telemetry/A/B, and Adapters

---

## How it fits in the complete system

The Coordinator Core is the contract and catalog for everything downstream:

```
[Registry Files (YAML/JSON)] ─► [Loader + Validator] ─► [In‑Memory Registry]
                                         │
                                         ├─► Planner/Router  (select tools; S002+)
                                         ├─► Policy Engine   (weights/constraints adjust selection)
                                         ├─► Memory Store    (reward priors; cold‑start reduction)
                                         ├─► Safety Layer    (precondition & allow/deny filters)
                                         ├─► Adapters        (HTTP/RPA execution configured by tool metadata)
                                         └─► Telemetry/A‑B   (availability, error rates, win‑rates, cost)
```

- **Planner/Router (S002+)** queries the registry for candidates that implement the requested capability, applies Contract‑Net–style scoring, and selects the best tool.
- **Policy Engine** modifies selection behavior (e.g., exploration/exploitation, SLA/cost weighting) without changing the Coordinator Core.
- **Memory/Vector Store** contributes reward priors and similar‑episode hints to improve early performance.
- **Safety/Governance** filters candidates using preconditions/allowlists and records high‑risk actions.
- **Adapters** (HTTP/RPA) are configured by the tool metadata (endpoint, timeouts) exposed by this service.
- **Telemetry & A/B** consumes the Coordinator’s metrics to visualize availability, selection frequency, p95 latency, and uplift.

This separation ensures that new backends or governance rules can be introduced without modifying the Coordinator’s public API or its consumers.

---

## Concepts

### Tools
A **tool** is a versioned, callable capability adapter with a strict contract: identity, capabilities (inputs/outputs), endpoint (HTTP or RPA), SLA targets, cost estimate, and preconditions.

Example:
```yaml
id: "http-search-patient"
name: "Patient Search API"
version: "1.0.0"
capabilities:
  - name: "patient.search"
    inputs:  { mrn: "string", name: "string" }
    outputs: { patientId: "string", demographic: "object" }
cost_estimate: 0.01
sla: { p95_ms: 1500, success_rate_min: 0.98 }
preconditions: { requiresNetwork: true, env: { HIS_API_KEY: "string" } }
endpoint: { type: "http", url: "https://legacy-his/api/patient/search", timeout_ms: 3000 }
```

### Registry
- Authored as YAML/JSON files under `registry/`
- Hot‑reloaded and validated at runtime
- Exposed to consumers through a stable service interface

---

## API

- `POST /tools/validate` — Validate a single tool definition against the schema. Always returns `200` with `{ valid: boolean, errors?: string[] }`.
- `GET /tools` — List the currently loaded, routable tools.
- `GET /metrics` — Prometheus endpoint (OpenMetrics) for SRE dashboards.

OpenAPI/Swagger UI is available at `GET /docs` in development.

### Examples

Validate a tool:
```bash
curl -s http://localhost:8080/tools/validate \
  -H "content-type: application/json" \
  -d '{"id":"x","name":"X","version":"1.0.0","capabilities":[{"name":"cap","inputs":{},"outputs":{}}]}'
# -> {"valid":true}
```

List tools:
```bash
curl -s http://localhost:8080/tools | jq .
```

Metrics:
```bash
curl -s http://localhost:8080/metrics | grep tools_
# tools_loaded 2
# tool_load_errors 0
```

---

## Architecture & Code Organization

- **Fastify app** with JSON Schema validation and OpenAPI docs
- **Registry Loader** (file‑based, chokidar) + **Validator** (Ajv) → **Registry Service** (DIP)
- **Routes**: `/tools`, `/tools/validate`, `/metrics` (planner/trace endpoints stubbed for later stories)
- **Metrics**: `tools_loaded` (Gauge), `tool_load_errors` (Counter), plus default Node process metrics

```
src/
  app.ts                    # Fastify wiring (schemas, routes, docs)
  server.ts                 # composition root (env, DI, start)
  config/
    env.ts                  # typed env loader
  registry/
    model.ts                # Tool/Registry types + JSON Schemas
    validator.ts            # Ajv validator
    fileRegistryLoader.ts   # YAML/JSON loader + hot‑reload
    service.ts              # IRegistryService abstraction
  routes/
    tools.ts                # /tools, /tools/validate
    plan.ts                 # (S002+)
    trace.ts                # (S003+)
  metrics/
    metrics.ts              # Prometheus metrics
tests/
  unit/                     # validator/loader tests
  e2e/                      # HTTP tests for endpoints
registry/
  tools.sample.yaml         # examples for local runs
```

Design choices align with SOLID/DRY/SoC: services encapsulate behavior, routes depend on interfaces, and schemas are reused across validation layers.

---

## Getting Started

```bash
cp .env.example .env
npm ci
npm run dev
# optional: load sample registry
cp registry/tools.sample.yaml registry/tools.yaml
# open: /docs, /tools, /metrics
```

Default configuration:
- `PORT=8080`
- `REGISTRY_DIR=./registry`

---

## Observability

- **Logs**: structured (pino) via Fastify logger
- **Metrics**: Prometheus at `/metrics`
  - `tools_loaded` — current number of tools
  - `tool_load_errors` — cumulative validation/load errors
- **Tracing**: OpenTelemetry exporter can be enabled via env (wired in future stories)

---

## Integration Contracts

Stable interfaces keep consumers decoupled from implementation details:

- `IRegistryService` — capability discovery for Planner/Router, Policy, Safety, and Adapters
- `IScorer` / `IBidder` — selection strategy (introduced in Planner for S002+)
- `IToolExecutor` — HTTP/RPA execution adapters configured by tool metadata
- `TraceStore` — records planner inputs, bids, selections, and outcomes (S003+)

These contracts allow introducing databases, new endpoint types (e.g., gRPC), or stricter governance without changing consumer code.

---

## Roadmap (Coordinator Core)

- **S001 (complete)**: Tool registry model, validation, loader, `/tools`, `/tools/validate`, `/metrics`
- **S002**: Contract‑Net scoring and `/plan` with fallback behavior
- **S003**: Execution trace store and `/trace/:id` with planner/execution events
- **Safety hooks**: enforce preconditions and allow/deny policies before routing
- **Policy integration**: contextual bandits/Bayesian optimization for selection weights
- **Persistence options**: optional database/config‑service backed registry

---

## Quality & Standards

- TypeScript **strict** mode; ESLint + Prettier
- Unit and end‑to‑end tests (Jest + supertest)
- GitHub Actions CI (lint, test, build)
- Dockerfile for reproducible builds
- Principles: **SOLID**, **DRY**, **Separation of Concerns**, **Dependency Inversion**, **encapsulation/abstraction**

---

## Security Notes

- Validate all external inputs (enforced via JSON Schema)
- Store secrets in environment variables or a secret manager
- Add authentication (mTLS/JWT) before exposure beyond trusted environments
- RPA tools should be sandboxed with strict timeouts and allowlists
