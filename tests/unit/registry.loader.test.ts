import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileRegistryLoader } from '../../src/registry/fileRegistryLoader';

const td = () => mkdtempSync(join(tmpdir(), 'reg-'));

describe('FileRegistryLoader', () => {
  it('aggregates tools from yaml/json', async () => {
    const dir = td();
    writeFileSync(join(dir, 't1.yaml'), `
id: t1
name: T1
version: "1.0.0"
capabilities: [{ name: cap1, inputs: {}, outputs: {} }]
`);
    writeFileSync(join(dir, 'r.json'), JSON.stringify({
      updatedAt: new Date().toISOString(),
      tools: [{ id: 't2', name: 'T2', version: '1.0.0', capabilities: [{ name: 'cap2', inputs: {}, outputs: {} }] }]
    }));
    const loader = new FileRegistryLoader(dir);
    await loader.start();
    expect(loader.getRegistry().tools.length).toBe(2);
    await loader.stop();
  });
});
