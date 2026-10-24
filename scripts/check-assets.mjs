import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
const root = resolve(import.meta.dirname, '..'),
  base = resolve(root, 'public');
const models = JSON.parse(await readFile(resolve(root, 'src/data/models.json'), 'utf8'));
let failed = false;
for (const [id, model] of Object.entries(models)) {
  try {
    if (!model.path) throw Error('no local file');
    const path = resolve(base, model.path);
    const rel = relative(base, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw Error('path escapes public/');
    const b = await readFile(path);
    if (b.toString('ascii', 0, 4) !== 'glTF') throw Error('invalid GLB');
    if (createHash('sha256').update(b).digest('hex') !== model.sha256) throw Error('hash mismatch');
    console.log(`OK ${id}: ${(b.length / 1024 / 1024).toFixed(1)} MB`);
  } catch (error) {
    failed = true;
    console.error(`${id}: ${error.message}`);
  }
}
if (failed) process.exitCode = 1;
