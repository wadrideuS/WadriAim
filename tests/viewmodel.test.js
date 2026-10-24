import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { buildFpsRigArms } from '../src/renderer/FpsRigArms.js';
import { fitWeaponModel } from '../src/renderer/WeaponViewmodel.js';
import { VIEWMODEL_REST_OFFSET } from '../src/renderer/viewmodelRest.js';

const manifest = JSON.parse(fs.readFileSync(new URL('../src/data/models.json', import.meta.url)));
globalThis.self = globalThis;
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} });
const parse = async (id) => {
  const b = fs.readFileSync(new URL('../public/' + manifest[id].path, import.meta.url));
  return new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), '');
};
const hands = await parse('fpshands');
/** ArenaRenderer's viewmodel camera on 16:9 (92° horizontal). */
const ASPECT = 16 / 9;
const verticalFov = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(92) / 2) / ASPECT));
const viewCamera = new THREE.PerspectiveCamera(verticalFov, ASPECT, 0.01, 10);
viewCamera.updateMatrixWorld();
/** The index knuckle rests beside the grip, not inside it. */
const MAX_GRIP_GAP = 0.04;
/** Palm-to-barrel-line distance when wrapped around the handguard. */
const MAX_HANDGUARD_GAP = 0.06;

/** Builds the viewmodel the way ArenaRenderer.equip does, inside an already moved viewmodel group. */
async function equipVandal(viewmodelTransform = () => {}) {
  const viewmodel = new THREE.Group();
  viewmodelTransform(viewmodel);
  viewmodel.updateMatrixWorld(true);
  const weapon = fitWeaponModel((await parse('vandal')).scene, manifest.vandal, 'vandal');
  const arms = buildFpsRigArms(hands);
  viewmodel.add(weapon, arms);
  arms.userData.fitToWeapon(weapon, 'vandal');
  viewmodel.position.copy(VIEWMODEL_REST_OFFSET);
  viewmodel.scale.set(1, 1, 1);
  viewmodel.updateMatrixWorld(true);
  return { weapon, arms };
}
const socket = (weapon, pattern) => {
  let node;
  weapon.traverse((n) => (node ||= pattern.test(n.name) ? n : null));
  return node.getWorldPosition(new THREE.Vector3());
};
/** Hand bone of the animated hold, in the same camera space the arms are baked in. */
function holdBone(name) {
  const scene = clone(hands.scene);
  const mixer = new THREE.AnimationMixer(scene);
  mixer.clipAction(hands.animations.find((c) => c.name === 'Fire')).play();
  mixer.setTime(0);
  scene.updateMatrixWorld(true);
  const camera = scene.getObjectByName('FPS_Camera_j_01');
  return scene
    .getObjectByName(name)
    .getWorldPosition(new THREE.Vector3())
    .applyMatrix4(camera.matrixWorld.clone().invert())
    .multiplyScalar(camera.getWorldScale(new THREE.Vector3()).x);
}

test('right fist closes on the Vandal grip and left palm on its handguard', async () => {
  const { weapon, arms } = await equipVandal();
  const grip = socket(weapon, /^Root_\d+$/);
  const muzzle = socket(weapon, /^Muzzle_\d+$/);
  const knuckle = holdBone('RightHandIndex1_010').applyMatrix4(arms.matrixWorld);
  const palm = holdBone('LeftHandIndex1_033').lerp(holdBone('LeftHand_028'), 0.5).applyMatrix4(arms.matrixWorld);
  assert(grip.distanceTo(knuckle) < MAX_GRIP_GAP, 'grip socket must sit at the index knuckle');
  const barrel = new THREE.Line3(grip, muzzle);
  const along = barrel.closestPointToPointParameter(palm, false);
  assert(along > 0.2 && along < 0.9, 'left palm sits on the handguard, between grip and muzzle');
  assert(barrel.closestPointToPoint(palm, false, new THREE.Vector3()).distanceTo(palm) < MAX_HANDGUARD_GAP, 'left palm touches the handguard');
});

test('fit does not depend on where the viewmodel was when the weapon is equipped', async () => {
  const still = await equipVandal();
  const moved = await equipVandal((vm) => vm.position.set(0.015, -0.035, -0.18));
  const mirrored = await equipVandal((vm) => vm.scale.set(-1, 1, 1));
  const grip = socket(still.weapon, /^Root_\d+$/);
  assert(socket(moved.weapon, /^Root_\d+$/).distanceTo(grip) < 1e-6);
  assert(socket(mirrored.weapon, /^Root_\d+$/).distanceTo(grip) < 1e-6);
});

test('arms and rifle are framed as one rigid piece', async () => {
  const { weapon, arms } = await equipVandal();
  const bore = new THREE.Vector3(0, 0, -1).applyQuaternion(weapon.getWorldQuaternion(new THREE.Quaternion()));
  const rigForward = new THREE.Vector3(0, 0, -1).applyQuaternion(arms.getWorldQuaternion(new THREE.Quaternion()));
  assert(bore.angleTo(rigForward) < THREE.MathUtils.degToRad(0.5));
});

test('Vandal frames bottom-right, inside the screen and clear of the crosshair', async () => {
  const { weapon } = await equipVandal();
  const grip = socket(weapon, /^Root_\d+$/).project(viewCamera);
  const muzzle = socket(weapon, /^Muzzle_\d+$/).project(viewCamera);
  for (const p of [grip, muzzle])
    assert(Math.abs(p.x) < 1 && Math.abs(p.y) < 1, `on screen: ${p.x.toFixed(2)}, ${p.y.toFixed(2)}`);
  assert(grip.x > 0.3 && grip.y < -0.4, 'grip sits in the lower-right quarter');
  assert(muzzle.x > 0.08 && muzzle.y < -0.12, 'muzzle stays off the crosshair');
  assert(muzzle.x < grip.x, 'barrel points toward the centre');
});
