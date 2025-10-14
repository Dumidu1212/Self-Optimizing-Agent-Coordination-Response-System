/**
 * Trace store with TTL and max-size bound.
 * Keeps decision/execution events per plan for explainability (S003).
 */
export interface TraceEvent {
  ts: number;          // epoch ms
  type: string;        // e.g., 'request' | 'scores' | 'attempt' | 'success' | 'fallback' | 'timeout' | 'failure'
  data: unknown;       // event payload
}

export interface Trace {
  id: string;
  createdAt: number;
  events: TraceEvent[];
}

export interface TraceStoreOptions {
  /** Maximum traces to keep in memory (least-recently-created evicted first). */
  maxTraces?: number;
  /** Time-to-live in ms for a trace (default 15 minutes). */
  ttlMs?: number;
}

export class TraceStore {
  private traces = new Map<string, Trace>();
  private order: string[] = [];
  private readonly maxTraces: number;
  private readonly ttlMs: number;

  constructor(opts?: TraceStoreOptions) {
    // Allow tests and small instances to use tiny caps/TTLs; guard only against 0/negative.
    this.maxTraces = Math.max(1, opts?.maxTraces ?? 1000);
    this.ttlMs = Math.max(1, opts?.ttlMs ?? 15 * 60_000);
  }

  create(): string {
    const id = `tr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const t: Trace = { id, createdAt: Date.now(), events: [] };
    this.traces.set(id, t);
    this.order.push(id);
    this.prune();
    return id;
  }

  record(id: string, type: string, data: unknown): void {
    const t = this.traces.get(id);
    if (!t) return;
    t.events.push({ ts: Date.now(), type, data });
  }

  get(id: string): Trace | undefined {
    const t = this.traces.get(id);
    if (!t) return undefined;
    if (this.isExpired(t)) {
      this.delete(id);
      return undefined;
    }
    return t;
  }

  size(): number {
    return this.traces.size;
  }

  /** Remove expired and overflow traces. */
  prune(): void {
    // TTL prune
    for (const id of [...this.order]) {
      const t = this.traces.get(id);
      if (!t) continue;
      if (this.isExpired(t)) this.delete(id);
    }
    // Capacity prune (remove oldest)
    while (this.order.length > this.maxTraces) {
      const oldest = this.order.shift();
      if (oldest) this.traces.delete(oldest);
    }
  }

  private delete(id: string): void {
    this.traces.delete(id);
    const idx = this.order.indexOf(id);
    if (idx >= 0) this.order.splice(idx, 1);
  }

  private isExpired(t: Trace): boolean {
    return Date.now() - t.createdAt > this.ttlMs;
  }
}

// Anchor to keep the file as a module in all bundlers.
export const __traceStoreModule = true;
