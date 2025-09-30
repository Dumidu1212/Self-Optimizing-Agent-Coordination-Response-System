import { buildApp } from '../../src/app';
import type { IRegistryService } from '../../src/registry/service';
import request from 'supertest';

const fake: IRegistryService = {
  list: () => [{ id: 't1', name: 'T1', version: '1.0.0', capabilities: [{ name: 'cap', inputs: {}, outputs: {} }] }],
  getRegistry: () => ({ tools: [], updatedAt: new Date().toISOString() })
};

describe('tools routes', () => {
  it('validates a tool', async () => {
    const app = buildApp({ registry: fake });
    const res = await request(app.server).post('/tools/validate').send({ id:'x', name:'X', version:'1.0.0', capabilities:[{name:'c',inputs:{},outputs:{}}] });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });
  it('lists tools', async () => {
    const app = buildApp({ registry: fake });
    const res = await request(app.server).get('/tools');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});
