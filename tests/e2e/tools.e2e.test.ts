import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import request from 'supertest';

const fake: IRegistryService = {
  list: () => [
    { id: 't1', name: 'T1', version: '1.0.0', capabilities: [{ name: 'cap', inputs: {}, outputs: {} }] }
  ],
  getRegistry: () => ({ tools: [], updatedAt: new Date().toISOString() })
};

describe('tools routes', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    app = buildApp({ registry: fake });
    await app.ready();                 // ← ensure routes/plugins are initialized
  });

  afterAll(async () => {
    await app.close();                 // ← prevents “Jest did not exit…” open handles
  });

  it('validates a tool', async () => {
    const res = await request(app.server)
      .post('/tools/validate')
      .send({ id: 'x', name: 'X', version: '1.0.0', capabilities: [{ name: 'c', inputs: {}, outputs: {} }] });

    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('lists tools', async () => {
    const res = await request(app.server).get('/tools');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].id).toBe('t1');
  });
});
