import { TraceStore } from '../../src/tracing/traceStore';

describe('TraceStore', () => {
  it('creates, records, and fetches traces', () => {
    const store = new TraceStore({ maxTraces: 2, ttlMs: 60_000 });
    const id = store.create();
    store.record(id, 'request', { a: 1 });
    const t = store.get(id);
    expect(t?.id).toBe(id);
    expect(t?.events.length).toBe(1);
  });

  it('evicts by capacity', () => {
    const store = new TraceStore({ maxTraces: 2, ttlMs: 60_000 });
    const a = store.create();
    const b = store.create();
    const c = store.create(); // should evict the oldest (a)
    expect(store.get(a)).toBeUndefined();
    expect(store.get(b)).toBeDefined();
    expect(store.get(c)).toBeDefined();
  });

  it('expires by ttl', async () => {
    const store = new TraceStore({ maxTraces: 10, ttlMs: 10 });
    const id = store.create();
    store.record(id, 'request', {});
    await new Promise((r) => setTimeout(r, 15));
    expect(store.get(id)).toBeUndefined();
  });
});
