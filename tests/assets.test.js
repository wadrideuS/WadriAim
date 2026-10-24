import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { buildChamberViewmodel } from '../src/renderer/ChamberArms.js';
const manifest = JSON.parse(fs.readFileSync(new URL('../src/data/models.json', import.meta.url)));
test('all six provided GLBs are present, embedded and match their hashes', () => {
  for (const [id, m] of Object.entries(manifest)) {
    assert(m.path, id);
    const b = fs.readFileSync(new URL('../public/' + m.path, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'glTF');
    assert.equal(b.readUInt32LE(4), 2);
    assert.equal(createHash('sha256').update(b).digest('hex'), m.sha256);
    const json = JSON.parse(b.toString('utf8', 20, 20 + b.readUInt32LE(12)));
    for (const resource of [...(json.buffers || []), ...(json.images || [])])
      assert(
        !resource.uri || resource.uri.startsWith('data:'),
        'asset must not depend on a remote URL',
      );
  }
});
test('Chamber viewmodel uses original textured geometry and finite camera-space vertices', async () => {
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
  const b = fs.readFileSync(new URL('../public/models/chamber/model.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    '',
  );
  const arms = buildChamberViewmodel(scene);
  arms.updateMatrixWorld(true);
  assert.equal(arms.children.length, 2);
  let triangles = 0,
    textures = 0;
  const point = new THREE.Vector3();
  const bounds = new THREE.Box3();
  arms.traverse((mesh) => {
    if (!mesh.isMesh) return;
    triangles += mesh.geometry.index.count / 3;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    textures += materials.filter((m) => m.map).length;
    const positions = mesh.geometry.getAttribute('position');
    for (const i of new Set(mesh.geometry.index.array)) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert(point.toArray().every(Number.isFinite));
      bounds.expandByPoint(point);
    }
  });
  assert(triangles > 100);
  assert(textures > 0);
  // Archived Chamber extraction remains valid geometry; it is no longer the active viewmodel.
  assert(bounds.getSize(new THREE.Vector3()).length() < 1.5, 'hands must not become camera-sized');
});

test('custom gloves fit all four playable weapons with finite sleeves extending below view', async () => {
  const { buildCustomArms } = await import('../src/renderer/CustomArms.js');
  const { fitWeaponModel } = await import('../src/renderer/WeaponViewmodel.js');
  globalThis.self = globalThis;
  globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
  for (const id of ['ghost', 'sheriff', 'phantom', 'vandal']) {
    const entry = manifest[id];
    const b = fs.readFileSync(new URL('../public/' + entry.path, import.meta.url));
    const { scene } = await new GLTFLoader().parseAsync(
      b.buffer.slice(b.byteOffset, b.byteOffset + b.length),
      '',
    );
    const weapon = fitWeaponModel(scene, entry, id);
    const arms = buildCustomArms();
    arms.userData.fitToWeapon(weapon, id);
    arms.updateMatrixWorld(true);
    assert.equal(arms.userData.grips.weapon, id);
    let meshes = 0;
    arms.traverse((n) => {
      if (n.isMesh) meshes++;
    });
    assert(meshes > 20);
    const bounds = new THREE.Box3().setFromObject(arms);
    assert(bounds.min.y < -0.8, 'sleeves must reach past the bottom edge');
    assert(bounds.max.z < -0.1, 'gloves must stay in front of camera');
    arms.traverse((n) => {
      if (!n.isMesh) return;
      assert(n.geometry.attributes.position.array.every(Number.isFinite));
    });
  }
});
