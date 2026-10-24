import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { findGripSockets } from './WeaponViewmodel.js';

/**
 * First-person arms from the M4 FPS animation pack, kept in the pose the animator
 * made (both hands really wrapped around a rifle). Instead of bending the arms to
 * each gun, the Valorant weapon is moved INTO the hands: its grip socket goes where
 * the M4's pistol grip was and its bore follows the M4's bore. Arms and rifle are
 * then framed together as one rigid piece, so the grip never drifts. Pistols bring
 * the arms out to their own grip point.
 *
 * Everything is baked in camera space (metres, camera looking down -Z), which is
 * exactly the viewmodel space used by ArenaRenderer.
 */
const PISTOL_GRIP = new THREE.Vector3(0.18, -0.195, -0.38);
// barrel pointing forward, slightly inward and level (not up at the camera)
const PISTOL_BARREL = new THREE.Vector3(-0.3, 0.05, -1).normalize();
/** Top of the M4's pistol grip (where Valorant rifles put their Root socket), from the M4 centre. */
const RIFLE_GRIP_FROM_M4_CENTER = new THREE.Vector3(0, -0.03, 0.13);
/**
 * VALORANT-style rifle framing, pivoting on the grip: the animator's pose holds the
 * rail at eye height, so the rig is lowered, pushed right and away, and the barrel
 * is yawed toward the crosshair.
 */
const RIFLE_FRAME = {
  offset: new THREE.Vector3(0.18, -0.075, -0.2),
  // slight nose-up pitch, ~12° yaw toward the centre, a touch of cant
  rotation: new THREE.Euler(0.05, 0.21, 0.02, 'YXZ'),
};
/** Socket-less rifles: grip sits this fraction of the gun length behind its centre. */
const FALLBACK_GRIP_BACK = { rifle: 0.18, pistol: 0.05 };
/** Pistol sockets sit on the slide: lift the gun so the fist closes on the grip. */
const PISTOL_FIST_OFFSET = {
  ghost: new THREE.Vector3(0.004, 0.05, 0.006),
  sheriff: new THREE.Vector3(0.004, 0.045, 0.006),
};

export function buildFpsRigArms(gltf) {
  const scene = clone(gltf.scene);
  // the pack has no idle clip: the first frame of Fire is the settled two-hand hold
  const pose = gltf.animations.find((c) => c.name === 'Fire') || gltf.animations.find((c) => c.name === 'Draw');
  if (pose) {
    const mixer = new THREE.AnimationMixer(scene);
    mixer.clipAction(pose).play();
    mixer.setTime(pose.name === 'Fire' ? 0 : Math.max(0, pose.duration - 0.03));
  }
  scene.updateMatrixWorld(true);
  const camera = scene.getObjectByName('FPS_Camera_j_01') || scene.getObjectByName('FPS_Camera');
  if (!camera) throw new Error('El paquete de manos no contiene la cámara FPS');
  const toCamera = camera.matrixWorld.clone().invert();
  // camera local units are centimetres (the joint is scaled 0.01)
  const unit = camera.getWorldScale(new THREE.Vector3()).x;
  const toView = (v) => v.applyMatrix4(toCamera).multiplyScalar(unit);
  const boneAt = (name) => {
    const node = scene.getObjectByName(name);
    if (!node) throw new Error(`El paquete de manos no contiene ${name}`);
    return toView(node.getWorldPosition(new THREE.Vector3()));
  };

  // M4 frame: it was modelled axis-aligned, muzzle toward local +Z
  const m4 = scene.getObjectByName('Main_M4_D_0');
  if (!m4) throw new Error('El paquete de manos no contiene el M4 de referencia');
  m4.geometry.computeBoundingBox();
  const m4ToView = new THREE.Matrix4().multiplyMatrices(toCamera, m4.matrixWorld);
  const barrel = new THREE.Vector3(0, 0, 1).transformDirection(m4ToView);
  const rifleGrip = toView(m4.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(m4.matrixWorld)).add(
    RIFLE_GRIP_FROM_M4_CENTER,
  );
  const rightHand = boneAt('RightHand_05');

  // bake hands/gloves, split into right and left arm
  const group = new THREE.Group();
  group.name = 'FPS rig arms';
  const sides = { Right: new THREE.Group(), Left: new THREE.Group() };
  group.add(sides.Right, sides.Left);
  scene.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return; // only the hands/gloves are skinned; the M4 rides on bones
    const source = mesh.geometry;
    const positions = source.getAttribute('position');
    const skinIndex = source.getAttribute('skinIndex'), skinWeight = source.getAttribute('skinWeight');
    const baked = new Float32Array(positions.count * 3);
    const leftWeight = new Float32Array(positions.count);
    const v = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i);
      mesh.applyBoneTransform(i, v);
      toView(v.applyMatrix4(mesh.matrixWorld)).toArray(baked, i * 3);
      for (let j = 0; j < 4; j++)
        if (/^Left/.test(mesh.skeleton.bones[skinIndex.getComponent(i, j)]?.name || ''))
          leftWeight[i] += skinWeight.getComponent(i, j);
    }
    const index = source.index;
    const count = index ? index.count : positions.count;
    for (const side of ['Right', 'Left']) {
      const keep = [];
      for (let n = 0; n < count; n += 3) {
        const a = index ? index.getX(n) : n, b = index ? index.getX(n + 1) : n + 1, c = index ? index.getX(n + 2) : n + 2;
        const left = (leftWeight[a] + leftWeight[b] + leftWeight[c]) / 3 > 0.5;
        if (left === (side === 'Left')) keep.push(a, b, c);
      }
      if (!keep.length) continue;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(baked.slice(), 3));
      for (const name of ['uv', 'normal']) if (source.getAttribute(name)) geometry.setAttribute(name, source.getAttribute(name).clone());
      geometry.setIndex(keep);
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const part = new THREE.Mesh(geometry, mesh.material);
      part.frustumCulled = false;
      sides[side].add(part);
    }
  });
  if (!sides.Right.children.length) throw new Error('No se encontraron las manos del paquete FPS');

  // pistol grip point = a bit in front of / below the right wrist
  const pistolHandGrip = rightHand.clone().add(new THREE.Vector3(-0.012, -0.02, -0.035));
  group.userData.fitToWeapon = (weapon, id) => {
    const pistol = ['ghost', 'sheriff'].includes(id);
    group.position.set(0, 0, 0);
    group.quaternion.identity();
    sides.Left.visible = sides.Right.visible = id !== 'karambit';
    if (id === 'karambit') return;
    // the weapon may already sit inside a moved/mirrored viewmodel: work in its parent's space
    const gripOf = () => {
      weapon.updateWorldMatrix(true, true);
      const world = findGripSockets(weapon).right;
      return world && (weapon.parent ? weapon.parent.worldToLocal(world) : world);
    };
    // weapon barrel is -Z in its container; turn it onto the hands' barrel
    const aim = pistol ? PISTOL_BARREL : barrel;
    const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), aim);
    weapon.quaternion.premultiply(turn);
    weapon.position.applyQuaternion(turn);
    const weaponGrip = gripOf() || fallbackGrip(weapon, aim, pistol);
    const shift = pistol ? PISTOL_GRIP.clone().sub(pistolHandGrip) : new THREE.Vector3();
    sides.Right.position.copy(shift);
    sides.Left.position.copy(shift);
    const target = pistol ? pistolHandGrip.clone().add(shift) : rifleGrip;
    weapon.position.add(target.clone().sub(weaponGrip));
    if (pistol) {
      weapon.position.add(PISTOL_FIST_OFFSET[id]);
      // the rifle support pose does not fit a pistol: shoot with the strong hand
      sides.Left.visible = false;
    } else {
      frameRifle(group, weapon, rifleGrip);
    }
    weapon.updateMatrixWorld(true);
    group.userData.grips = { weapon: id };
  };
  return group;
}

/** Moves arms and rifle together, pivoting on the grip so the hands keep their hold. */
function frameRifle(arms, weapon, pivot) {
  const frame = new THREE.Matrix4()
    .makeTranslation(pivot.x + RIFLE_FRAME.offset.x, pivot.y + RIFLE_FRAME.offset.y, pivot.z + RIFLE_FRAME.offset.z)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(RIFLE_FRAME.rotation))
    .multiply(new THREE.Matrix4().makeTranslation(-pivot.x, -pivot.y, -pivot.z));
  frame.decompose(arms.position, arms.quaternion, new THREE.Vector3());
  weapon.applyMatrix4(frame);
}

/** Grip estimate for guns without a Root socket, in the weapon's parent space. */
function fallbackGrip(weapon, aim, pistol) {
  weapon.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(weapon);
  if (weapon.parent) box.applyMatrix4(weapon.parent.matrixWorld.clone().invert());
  const size = box.getSize(new THREE.Vector3());
  return box
    .getCenter(new THREE.Vector3())
    .addScaledVector(aim, -size.length() * (pistol ? FALLBACK_GRIP_BACK.pistol : FALLBACK_GRIP_BACK.rifle))
    .add(new THREE.Vector3(0, -size.y * 0.3, 0));
}
