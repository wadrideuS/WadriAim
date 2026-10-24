import * as THREE from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { buildRig, findBone, worldOf } from './agent-rig.js';

/**
 * Full-body agent models for the arena bots.
 *
 * - Enemies use the duelist model and wear a screen-space silhouette like the
 *   in-game enemy highlight (red / yellow / purple).
 * - Allies use another agent with no outline.
 * - The textured mesh never receives shots: hits are resolved against simple
 *   invisible hitboxes (head + body), so headshot rules stay predictable.
 */

export const enemyAgentId = 'agent_reyna';
export const allyAgentId = 'agent_sage';
export const HEAD_HEIGHT = 1.65;

export const outlineColors = {
  rojo: { label: 'ROJO', hex: '#ff3346' },
  amarillo: { label: 'AMARILLO', hex: '#f4f142' },
  morado: { label: 'MORADO', hex: '#c13dff' },
};
export const outlineOrder = Object.keys(outlineColors);

const STENCIL_ENEMY = 1;
const outlineUniforms = {
  outlineColor: { value: new THREE.Color(outlineColors.rojo.hex) },
  outlineWidth: { value: 2.5 },
  outlineResolution: { value: new THREE.Vector2(1280, 720) },
};

export function setOutlineColor(key) {
  outlineUniforms.outlineColor.value.set((outlineColors[key] || outlineColors.rojo).hex);
}
export function setOutlineResolution(width, height) {
  outlineUniforms.outlineResolution.value.set(width, height);
}

/**
 * Silhouette pass: the agent is redrawn flat-coloured, shifted a few pixels in
 * eight screen directions, only where the agent itself is NOT (stencil != 1).
 * That is a screen-space dilation of the silhouette, so the ring has the same
 * thickness at any distance and walls in front still hide it.
 */
function createOutlineMaterial(angle) {
  const outline = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: false,
    transparent: true,
    depthWrite: false,
    stencilWrite: true,
    stencilRef: STENCIL_ENEMY,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.KeepStencilOp,
    stencilZFail: THREE.KeepStencilOp,
    stencilZPass: THREE.KeepStencilOp,
  });
  outline.name = 'enemy-outline';
  outline.userData.keepColors = true;
  const direction = { value: new THREE.Vector2(Math.cos(angle), Math.sin(angle)) };
  outline.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, outlineUniforms, { outlineDir: direction });
    shader.vertexShader = shader.vertexShader
      .replace(
        'void main() {',
        'uniform float outlineWidth;\nuniform vec2 outlineResolution;\nuniform vec2 outlineDir;\nvoid main() {',
      )
      .replace(
        '#include <fog_vertex>',
        `#include <fog_vertex>
        gl_Position.xy += outlineDir * outlineWidth * 2.0 * gl_Position.w / outlineResolution;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform vec3 outlineColor;\nvoid main() {')
      .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = outlineColor;');
  };
  outline.customProgramCacheKey = () => 'enemy-outline-v2';
  return outline;
}
const outlinePasses = Array.from({ length: 8 }, (_, i) => createOutlineMaterial((i * Math.PI) / 4));

/**
 * The ripped agent meshes weight the fingers ~50 % to the skirt bone (they
 * rest on the hip in the A-pose). As soon as the arms move, that stretches the
 * hands into a fan. Arm/hand vertices keep only arm/hand influences.
 */
function fixArmWeights(scene) {
  const arm = /^(L|R)_(Clavicle|Shoulder|Elbow|Hand|Thumb|Index|Middle|Ring|Pinky)/;
  scene.traverse((mesh) => {
    if (!mesh.isSkinnedMesh) return;
    const geometry = mesh.geometry.clone(); // the cached original stays untouched
    const index = geometry.getAttribute('skinIndex'), weight = geometry.getAttribute('skinWeight');
    const names = mesh.skeleton.bones.map((b) => b.name);
    // fingertips weighted only to the skirt: hand them to the closest finger
    // bone. Distances are measured in bind space (vertex × bindMatrix vs the
    // inverse of each bone's inverse-bind), relative to the size of the hand.
    const bindPos = mesh.skeleton.boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
    const handBones = names
      .map((name, i) => ({ i, name, at: bindPos[i] }))
      .filter((b) => /^(L|R)_(Hand|Thumb|Index|Middle|Ring|Pinky)/.test(b.name));
    const handSize = (side) => {
      const hand = handBones.find((b) => b.name.startsWith(side + '_Hand'));
      const tip = handBones.find((b) => b.name.startsWith(side + '_Middle3'));
      return hand && tip ? hand.at.distanceTo(tip.at) : 0;
    };
    const reach = { L: handSize('L') * 0.45, R: handSize('R') * 0.45 };
    const position = geometry.getAttribute('position');
    const v = new THREE.Vector3();
    let moved = 0;
    for (let i = 0; i < index.count; i++) {
      let any = 0;
      for (let k = 0; k < 4; k++) if (arm.test(names[index.getComponent(i, k)] || '')) any += weight.getComponent(i, k);
      if (any > 0) continue;
      v.fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
      let best = null, dist = Infinity;
      for (const b of handBones) {
        const d = b.at.distanceTo(v);
        if (d < dist) (dist = d), (best = b);
      }
      if (best && dist < reach[best.name[0]]) {
        index.setComponent(i, 0, best.i);
        weight.setComponent(i, 0, 1);
        for (let k = 1; k < 4; k++) weight.setComponent(i, k, 0);
        moved++;
      }
    }
    // Triangles that join a forearm/hand vertex with a hip/skirt/face vertex
    // are welded rip artefacts: those stray vertices follow the arm instead.
    const far = /^(L|R)_(Elbow|Hand|Thumb|Index|Middle|Ring|Pinky)/;
    const dominant = (i) => {
      let best = 0, w = -1;
      for (let k = 0; k < 4; k++) if (weight.getComponent(i, k) > w) (w = weight.getComponent(i, k)), (best = index.getComponent(i, k));
      return names[best] || '';
    };
    const tri = geometry.index;
    const bindAt = (i) => new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.bindMatrix);
    const near = Math.max(reach.L, reach.R) * 0.7;
    for (let pass = 0; pass < 1 && tri; pass++) {
      for (let t = 0; t < tri.count; t += 3) {
        const ids = [tri.getX(t), tri.getX(t + 1), tri.getX(t + 2)];
        const armVertex = ids.find((i) => far.test(dominant(i)));
        if (armVertex === undefined) continue;
        for (const i of ids) {
          if (arm.test(dominant(i))) continue;
          // only genuine slivers: the stray vertex sits right next to the hand
          if (bindAt(i).distanceTo(bindAt(armVertex)) > near) continue;
          for (let k = 0; k < 4; k++) {
            index.setComponent(i, k, index.getComponent(armVertex, k));
            weight.setComponent(i, k, weight.getComponent(armVertex, k));
          }
          moved++;
        }
      }
    }
    index.needsUpdate = true;
    for (let i = 0; i < index.count; i++) {
      let armWeight = 0, total = 0;
      for (let k = 0; k < 4; k++) {
        const w = weight.getComponent(i, k);
        total += w;
        if (arm.test(names[index.getComponent(i, k)] || '')) armWeight += w;
      }
      if (armWeight < 0.2 || armWeight >= total - 1e-4) continue;
      for (let k = 0; k < 4; k++)
        weight.setComponent(i, k, arm.test(names[index.getComponent(i, k)] || '') ? weight.getComponent(i, k) / armWeight : 0);
    }
    weight.needsUpdate = true;
    mesh.geometry = geometry;
  });
}

/** Prepared, normalised template (feet at y=0, head bone at HEAD_HEIGHT, facing +Z). */
export function prepareAgentTemplate(gltf, { markSilhouette = false } = {}) {
  // work on a copy: the cached scene is also used to build first-person arms
  const scene = clone(gltf.scene);
  scene.updateMatrixWorld(true);
  const head = findBone(scene, 'Head');
  const box = new THREE.Box3().setFromObject(scene);
  const headY = head ? worldOf(head).y - box.min.y : (box.max.y - box.min.y) * 0.92;
  const scale = HEAD_HEIGHT / headY;
  const center = box.getCenter(new THREE.Vector3());
  const holder = new THREE.Group();
  const inner = new THREE.Group();
  inner.add(scene);
  scene.position.set(-center.x, -box.min.y, -center.z);
  inner.scale.setScalar(scale);
  holder.add(inner);
  fixArmWeights(scene);
  if (markSilhouette) {
    // own material copies: the cached ones are shared with the first-person arms
    const copies = new Map();
    scene.traverse((node) => {
      if (!node.isMesh) return;
      const swap = (material) => {
        if (!copies.has(material)) {
          const copy = material.clone();
          Object.assign(copy, {
            stencilWrite: true,
            stencilRef: STENCIL_ENEMY,
            stencilFunc: THREE.AlwaysStencilFunc,
            stencilZPass: THREE.ReplaceStencilOp,
          });
          copies.set(material, copy);
        }
        return copies.get(material);
      };
      node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
    });
  }
  holder.updateMatrixWorld(true);
  return holder;
}

function capsuleBetween(a, b, radius, part) {
  const length = Math.max(0.01, a.distanceTo(b));
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 4, 10), hitboxMaterial);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  mesh.userData.part = part;
  mesh.userData.hitbox = true;
  mesh.visible = false;
  return mesh;
}
const hitboxMaterial = new THREE.MeshBasicMaterial({ visible: false });

/**
 * Hitboxes are attached to the bones they cover, so they follow the walk and
 * crouch animation. Parts: head, body (torso + arms) and legs.
 */
function buildHitboxes(root, group) {
  group.updateMatrixWorld(true);
  const bone = (name) => findBone(root, name);
  const at = (name, fallback) => {
    const b = bone(name);
    return b ? group.worldToLocal(worldOf(b)) : new THREE.Vector3(...fallback);
  };
  const place = (mesh, parentName) => {
    group.add(mesh);
    const parent = bone(parentName);
    if (parent) parent.attach(mesh);
    return mesh;
  };
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10), hitboxMaterial);
  head.position.copy(at('Head', [0, HEAD_HEIGHT, 0])).add(new THREE.Vector3(0, 0.03, 0.01));
  Object.assign(head.userData, { part: 'head', hitbox: true });
  head.visible = false;
  place(head, 'Head');
  place(capsuleBetween(at('Pelvis', [0, 0.95, 0]), at('Neck', [0, 1.5, 0]), 0.2, 'body'), 'Pelvis');
  for (const side of ['L', 'R']) {
    place(capsuleBetween(at(side + '_Shoulder', [0, 1.45, 0]), at(side + '_Elbow', [0, 1.2, 0]), 0.075, 'body'), side + '_Shoulder');
    place(capsuleBetween(at(side + '_Elbow', [0, 1.2, 0]), at(side + '_Hand', [0, 0.9, 0]), 0.065, 'body'), side + '_Elbow');
    place(capsuleBetween(at(side + '_Hip', [0, 0.9, 0]), at(side + '_Knee', [0, 0.5, 0]), 0.1, 'legs'), side + '_Hip');
    place(capsuleBetween(at(side + '_Knee', [0, 0.5, 0]), at(side + '_Foot', [0, 0.08, 0]), 0.085, 'legs'), side + '_Knee');
  }
}

/**
 * Third-person rifle for the agents: barrel along +Z, grip (socket `Root_`) at
 * the origin. Shared geometry/materials; no shots ever hit it.
 */
export function prepareWeaponTemplate(gltf, length = 0.92) {
  const scene = clone(gltf.scene);
  scene.traverse((node) => {
    if (/Magazine_Extra|GN_(AK|Dmr|Luger)_Magazine/i.test(node.name) && !node.isBone) node.visible = false;
  });
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const axis = size.x >= size.y && size.x >= size.z ? new THREE.Vector3(1, 0, 0) : size.y >= size.z ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(0, 0, 1);
  let muzzle = null;
  scene.traverse((n) => {
    if (!muzzle && /^Muzzle[_0-9]/i.test(n.name)) muzzle = n;
  });
  if (muzzle && muzzle.getWorldPosition(new THREE.Vector3()).sub(center).dot(axis) < 0) axis.negate();
  const oriented = new THREE.Group();
  oriented.add(scene);
  scene.position.sub(center);
  oriented.quaternion.setFromUnitVectors(axis, new THREE.Vector3(0, 0, 1));
  oriented.scale.setScalar(length / Math.max(size.x, size.y, size.z));
  const holder = new THREE.Group();
  holder.add(oriented);
  holder.updateMatrixWorld(true);
  let grip = null;
  holder.traverse((n) => {
    if (!grip && /^Root_\d+$/i.test(n.name)) grip = n.getWorldPosition(new THREE.Vector3());
  });
  // fallback: a quarter of the gun behind the centre, a bit below the bore
  grip ||= new THREE.Vector3(0, -0.06, -length * 0.22);
  oriented.position.sub(grip);
  holder.updateMatrixWorld(true);
  // Bake every part into plain static meshes in holder space: a skinned gun
  // re-parented under a hand bone stretched into a fan of triangles.
  const toHolder = holder.matrixWorld.clone().invert();
  const baked = new THREE.Group();
  holder.traverse((mesh) => {
    if (!mesh.isMesh || !mesh.visible) return;
    let hidden = false;
    for (let n = mesh; n; n = n.parent) if (!n.visible) hidden = true;
    if (hidden) return;
    const source = mesh.geometry;
    const pos = source.getAttribute('position');
    const out = new Float32Array(pos.count * 3);
    const v = new THREE.Vector3();
    const matrix = toHolder.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
      v.applyMatrix4(matrix).toArray(out, i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(out, 3));
    if (source.getAttribute('uv')) geometry.setAttribute('uv', source.getAttribute('uv'));
    if (source.index) geometry.setIndex(source.index);
    source.groups.forEach((g) => geometry.addGroup(g.start, g.count, g.materialIndex));
    geometry.computeVertexNormals();
    baked.add(new THREE.Mesh(geometry, mesh.material));
  });
  holder.clear();
  holder.add(baked);
  holder.traverse((n) => {
    if (n.isMesh) {
      n.castShadow = true;
      n.raycast = () => {};
      n.userData.sharedAsset = true;
      n.userData.keepColors = true;
      n.frustumCulled = false;
    }
  });
  return holder;
}

/**
 * Points a bone so the direction to `child` becomes `target` (bot space).
 * Works in the parent's own coordinates (worldToLocal) so mirrored/scaled
 * rigs from Sketchfab rotate correctly instead of twisting the skin.
 */
function aimBone(group, bone, child, target) {
  group.updateMatrixWorld(true);
  const parent = bone.parent;
  const origin = worldOf(bone);
  const desired = origin.clone().add(target.clone().normalize().transformDirection(group.matrixWorld));
  const p0 = parent.worldToLocal(origin.clone());
  const from = parent.worldToLocal(worldOf(child)).sub(p0).normalize();
  const to = parent.worldToLocal(desired).sub(p0).normalize();
  // bone.quaternion lives in parent space: rotate it by from→to
  const local = bone.position.clone();
  const delta = new THREE.Quaternion().setFromUnitVectors(from, to);
  bone.quaternion.premultiply(delta);
  bone.position.copy(local);
  group.updateMatrixWorld(true);
}

/** Rifle at the ready: right hand on the grip, left hand on the handguard, gun at chest height. */
function holdRifle(body, group, weaponTemplate) {
  const b = (name) => findBone(body, name);
  const bones = ['R_Shoulder', 'R_Elbow', 'R_Hand', 'L_Shoulder', 'L_Elbow', 'L_Hand'].map(b);
  if (bones.some((x) => !x)) return;
  const [rs, re, rh, ls, le, lh] = bones;
  group.updateMatrixWorld(true);
  const rightX = Math.sign(group.worldToLocal(worldOf(rh)).x) || -1; // model's right side
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  aimBone(group, rs, re, V(rightX * 0.18, -0.85, 0.5)); // upper arm down, elbow a bit forward
  aimBone(group, re, rh, V(-rightX * 0.3, 0.12, 1)); // forearm forward, toward the centre
  aimBone(group, ls, le, V(-rightX * 0.25, -0.7, 0.75));
  // left hand reaches the handguard, ~32 cm ahead of the right hand
  const grip = group.worldToLocal(worldOf(rh));
  const handguard = grip.clone().add(V(-rightX * 0.04, 0.02, 0.32));
  aimBone(group, le, lh, handguard.sub(group.worldToLocal(worldOf(le))));
  const gun = clone(weaponTemplate);
  gun.position.copy(group.worldToLocal(worldOf(rh))).add(V(-rightX * 0.015, -0.01, 0.03));
  gun.rotation.set(-0.05, 0, 0);
  group.add(gun);
  rh.attach(gun); // follows the hand from now on
}

/** Shows or hides the enemy highlight (a body on the floor is no longer a threat). */
export function setAgentOutline(group, visible) {
  for (const hull of group.userData.outlineHulls || []) hull.visible = visible;
}

/** A ready-to-place agent bot. */
export function createAgentBot(template, { outline = true, weapon = null } = {}) {
  const group = new THREE.Group();
  group.userData.part = 'body';
  group.userData.agentBot = true;
  const body = clone(template);
  group.add(body);
  const outlines = [];
  body.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.frustumCulled = false;
    node.raycast = () => {};
    node.userData.sharedAsset = true;
    node.userData.keepColors = true;
    if (outline) outlines.push(node);
  });
  group.userData.outlineHulls = [];
  for (const mesh of outlines)
    for (const pass of outlinePasses) {
      const hull = mesh.isSkinnedMesh
        ? new THREE.SkinnedMesh(mesh.geometry, pass)
        : new THREE.Mesh(mesh.geometry, pass);
      if (mesh.isSkinnedMesh) hull.bind(mesh.skeleton, mesh.bindMatrix);
      hull.position.copy(mesh.position);
      hull.quaternion.copy(mesh.quaternion);
      hull.scale.copy(mesh.scale);
      hull.frustumCulled = false;
      hull.castShadow = false;
      hull.raycast = () => {};
      hull.userData.sharedAsset = true;
      hull.userData.keepColors = true;
      hull.renderOrder = 10;
      mesh.parent.add(hull);
      group.userData.outlineHulls.push(hull);
    }
  body.updateMatrixWorld(true);
  if (weapon) holdRifle(body, group, weapon);
  const rig = buildRig(body, group);
  if (rig) group.userData.rig = rig;
  // yaw first, then pitch: lets a dying bot fall backwards relative to where it faces
  group.rotation.order = 'YXZ';
  buildHitboxes(body, group);
  return group;
}
