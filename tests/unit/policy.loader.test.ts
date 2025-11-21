import { FilePolicyLoader } from '../../src/policy/loader.file';
import fs from 'node:fs/promises';
import path from 'node:path';

test('loads valid policy yaml', async () => {
  const p = path.join(process.cwd(), 'src/policy', 'policy.yaml');
  const exists = await fs.readFile(p, 'utf8');
  expect(exists.length).toBeGreaterThan(0);

  const loader = new FilePolicyLoader(p);
  const doc = await loader.load();
  expect(doc.schemaVersion).toBe('1.0');
});
