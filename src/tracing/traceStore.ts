/**
 * Minimal trace store to issue IDs now (S002) and attach data in S003.
 * Using in-memory map; can be swapped for a DB later (DIP).
 */
export interface TraceEvent {
  ts: number;
  type: string;
  data: unknown;
}

export interface Trace {
  id: string;
  events: TraceEvent[];
}

export class TraceStore {
  private traces = new Map<string, Trace>();

  create(): string {
    const id = `tr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    this.traces.set(id, { id, events: [] });
    return id;
  }

  record(id: string, type: string, data: unknown): void {
    const t = this.traces.get(id);
    if (!t) return;
    t.events.push({ ts: Date.now(), type, data });
  }

  get(id: string): Trace | undefined {
    return this.traces.get(id);
  }
}
