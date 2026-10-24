import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
const [id, input] = process.argv.slice(2),
  root = resolve(import.meta.dirname, '..'),
  manifestPath = resolve(root, 'src/data/models.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (!id || !input || !Object.hasOwn(manifest, id)) {
  console.error(
    'Uso: npm run assets:import -- vandal C:/ruta/modelo.glb (IDs: ' +
      Object.keys(manifest).join(', ') +
      ')',
  );
  process.exit(1);
}
const source = resolve(input),
  bytes = await readFile(source);
if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2)
  throw Error('Solo se aceptan archivos GLB 2.0');
const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
if (json.extensionsRequired?.includes('KHR_draco_mesh_compression'))
  throw Error('Exporta el GLB sin compresión Draco para este proyecto');
for (const resource of [...(json.buffers || []), ...(json.images || [])])
  if (resource.uri && !resource.uri.startsWith('data:'))
    throw Error('Exporta un GLB con texturas y buffers incrustados');
const dest = resolve(root, 'public/models', id);
await mkdir(dest, { recursive: true });
await copyFile(source, resolve(dest, 'model.glb'));
Object.assign(manifest[id], {
  path: `models/${id}/model.glb`,
  status: 'imported',
  originalFile: basename(source),
  sha256: createHash('sha256').update(bytes).digest('hex'),
});
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(
  'Importado ' +
    id +
    '. Ajusta la posición en src/data/models.json y ejecuta npm run assets:check.',
);
