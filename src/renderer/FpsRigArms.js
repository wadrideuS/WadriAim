import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { findGripSockets } from './WeaponViewmodel.js';

/**
 * First-person arms from the M4 FPS animation pack, kept in the pose the animator
 * made (both hands really wrapped around a rifle). Instead of bending the arms to
 * each gun, the Valorant weapon is moved INTO the hands: its grip goes where the
 * M4 grip was, aligned with the M4 barrel. Pistols bring the support hand back
 * under the shooting hand.
 *
 * Everything is baked in camera space (metres, camera looking down -Z), which is
 * exactly the viewmodel space used by ArenaRenderer.
 */
const PISTOL_GRIP = new THREE.Vector3(0.16, -0.15, -0.38);
// barrel pointing forward, slightly inward and level (not up at the camera)
const PISTOL_BARREL = new THREE.Vector3(-0.3, 0.05, -1).normalize();
export function buildFpsRigArms(gltf) {
  const scene = clone(gltf.scene);
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
    return node ? toView(node.getWorldPosition(new THREE.Vector3())) : null;
  };

  // M4 frame: barrel direction (principal axis) and grip point
  const m4 = scene.getObjectByName('Main_M4_D_0');
  const m4Points = [];
  if (m4) {
    const p = m4.geometry.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 5) {
      v.fromBufferAttribute(p, i);
      if (m4.isSkinnedMesh) m4.applyBoneTransform(i, v);
      m4Points.push(toView(v.applyMatrix4(m4.matrixWorld)));
    }
  }
  let barrel = new THREE.Vector3(0, 0, -1);
  if (m4Points.length) {
    // the 5 % of points furthest forward vs the 5 % furthest back
    const sorted = m4Points.slice().sort((a, b) => a.z - b.z);
    const n = Math.max(1, Math.floor(sorted.length * 0.05));
    const avg = (list) => list.reduce((s, x) => s.add(x), new THREE.Vector3()).divideScalar(list.length);
    barrel = avg(sorted.slice(0, n)).sub(avg(sorted.slice(-n))).normalize();
  }
  const rightHand = boneAt('RightHand_05') || new THREE.Vector3(0.1, -0.167, -0.025);
  const leftHand = boneAt('LeftHand_028') || new THREE.Vector3(0.003, -0.13, -0.357);

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

  // grip point = a bit in front of / below the right wrist, where the M4 grip sits
  const grip = rightHand.clone().add(new THREE.Vector3(-0.012, -0.02, -0.035));
  group.userData.fitToWeapon = (weapon, id) => {
    const pistol = ['ghost', 'sheriff'].includes(id);
    // rifles sit low on the right; pistols are pushed out at arm's length
    // pistols: grip out at arm's length, low on the right, like the in-game viewmodel
    const shift = pistol ? PISTOL_GRIP.clone().sub(grip) : new THREE.Vector3(0.05, -0.012, -0.06);
    sides.Right.position.copy(shift);
    sides.Left.position.copy(shift);
    sides.Left.visible = id !== 'karambit';
    sides.Right.visible = id !== 'karambit';
    if (id === 'karambit') return;
    weapon.updateMatrixWorld(true);
    const sockets = findGripSockets(weapon);
    // weapon barrel is -Z in its container; turn it onto the M4 barrel
    const aim = pistol ? PISTOL_BARREL : barrel;
    const turn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), aim);
    weapon.quaternion.premultiply(turn);
    weapon.position.applyQuaternion(turn);
    weapon.updateMatrixWorld(true);
    const after = findGripSockets(weapon);
    // fallback grip: 30 % of the gun length behind its centre, slightly below
    const box = new THREE.Box3().setFromObject(weapon);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const weaponGrip = after.right || center.clone().addScaledVector(barrel, -size.length() * (pistol ? 0.05 : 0.18)).add(new THREE.Vector3(0, -size.y * 0.3, 0));
    weapon.position.add(grip.clone().add(shift).sub(weaponGrip));
    // pistols: sink the grip into the closed fist
    // the socket sits on the slide: lift the gun so the fist closes on the grip
    if (pistol) weapon.position.add(new THREE.Vector3(0.004, id === 'ghost' ? 0.05 : 0.045, 0.006));
    weapon.updateMatrixWorld(true);
    if (pistol) {
      // the rifle support pose does not fit a pistol: shoot with the strong hand
      sides.Left.visible = false;
    } else if (sockets.left) {
      // slide the support hand along to the gun's own handguard socket
      const target = findGripSockets(weapon).left.add(new THREE.Vector3(0, -0.035, 0));
      const delta = target.sub(leftHand);
      if (delta.clone().sub(shift).length() < 0.2) sides.Left.position.copy(delta);
    }
    group.userData.grips = { weapon: id };
  };
  return group;
}
