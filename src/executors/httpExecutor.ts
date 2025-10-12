/**
 * HTTP Tool Executor using global fetch (Node 20+).
 * Respects per-tool timeout and overall planner AbortSignal (fallback on timeout).
 */
import type { IToolExecutor, ExecutionResult, JsonRecord } from '../planner/contracts';
import type { Tool } from '../registry/model';

export class HttpExecutor implements IToolExecutor {
  async execute(tool: Tool, input: JsonRecord, overallAbort: AbortSignal): Promise<ExecutionResult> {
    if (tool.endpoint?.type !== 'http' || !tool.endpoint.url) {
      return { status: 'failure', error: 'ENDPOINT_UNSUPPORTED' };
    }

    const timeoutMs = tool.endpoint.timeout_ms ?? 3000;

    // Per-call timeout layered on top of overallAbort
    const controller = new AbortController();
    const timeout = setTimeout((): void => controller.abort('tool-timeout'), timeoutMs);

    const composite = new AbortController();
    const onOverallAbort = (): void => composite.abort('overall-timeout');
    overallAbort.addEventListener('abort', onOverallAbort, { once: true });

    // When either aborts, composite aborts (simplified fan-in)
    controller.signal.addEventListener('abort', (): void => {
      composite.abort((controller.signal as unknown as { reason?: unknown }).reason);
    }, { once: true });

    const started = Date.now();
    try {
      const res = await fetch(tool.endpoint.url, {
        method: 'POST', // Use POST for general tool invocation (idempotency can be handled per capability later)
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input ?? {}),
        signal: composite.signal
      });

      const latency_ms = Date.now() - started;
      clearTimeout(timeout);
      overallAbort.removeEventListener('abort', onOverallAbort);

      if (!res.ok) {
        return { status: 'failure', latency_ms, error: `HTTP_${res.status}` };
      }
      const output = (await res.json().catch(() => ({}))) as JsonRecord;
      return { status: 'success', latency_ms, output };
    } catch (err) {
      const latency_ms = Date.now() - started;
      clearTimeout(timeout);
      overallAbort.removeEventListener('abort', onOverallAbort);

      if ((err as Error).name === 'AbortError') {
        const reason = String((err as Error & { cause?: unknown }).message ?? 'aborted');
        const status: ExecutionResult['status'] = reason.includes('overall') ? 'timeout' : 'timeout';
        return { status, latency_ms, error: reason };
      }
      return { status: 'failure', latency_ms, error: (err as Error).message };
    }
  }
}
