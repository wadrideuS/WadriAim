import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const inert = new Proxy(function () {}, { get: () => inert, apply: () => inert });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => inert }) };
const { createTargetOrb, targetOrbRadius, ORB_CENTER_Y } = await import('../src/renderer/targetOrb.js');

function shootAt(orb, sideOffset) {
  orb.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(sideOffset, ORB_CENTER_Y, 5),
    new THREE.Vector3(0, 0, -1),
  );
  return raycaster.intersectObject(orb, true);
}

test('a shot just inside the orb radius counts as a head hit', () => {
  const radius = targetOrbRadius(0);
  const hits = shootAt(createTargetOrb(radius), radius * 0.97);
  assert.equal(hits.length > 0, true);
  assert.equal(hits[0].object.userData.part, 'head');
});

test('the halo and rays never extend the hitbox beyond the sphere', () => {
  const radius = targetOrbRadius(2);
  assert.equal(shootAt(createTargetOrb(radius), radius * 1.04).length, 0);
});

test('keeps the original hitbox radius of every head-only mode', () => {
  assert.deepEqual([0, 2, 6].map(targetOrbRadius), [0.17, 0.25, 0.14]);
});

test('every orb reuses the same geometry and materials', () => {
  const meshes = [createTargetOrb(0.17), createTargetOrb(0.25)].map((orb) =>
    orb.children.map((child) => [child.geometry, child.material]),
  );
  assert.deepEqual(meshes[0], meshes[1]);
});
