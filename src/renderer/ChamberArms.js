import * as THREE from 'three';
import { findGripSockets } from './WeaponViewmodel.js';
/** Bake the uploaded Chamber forearms in bind pose, retaining their actual UVs/materials.
 * Separate viewmodel transforms avoid exposing the full-character shoulder rig to the camera. */
export function buildChamberViewmodel(root, { posed = false, customPose = false } = {}) {
  root.traverse((bone) => {
    if (!bone.isBone || posed) return;
    const match = bone.name.match(/(Left|Right)Hand(Index|Ring|Thumb)([123])_/i);
    if (!match) return;
    const finger = match[2].toLowerCase(),
      joint = Number(match[3]);
    const angle = finger === 'thumb' ? 0.2 : joint === 1 ? 0.65 : joint === 2 ? 0.85 : 0.55;
    bone.rotateX(angle);
  });
  root.updateMatrixWorld(true);
  const bones = [];
  root.traverse((n) => {
    if (n.isBone) bones.push(n);
    if (n.isSkinnedMesh) n.skeleton.update();
  });
  const find = (s) => bones.find((b) => b.name.toLowerCase().includes(s.toLowerCase()));
  const group = new THREE.Group();
  const armsBySide = {};
  const palmOffsets = {};
  const poses = {
    Right: { wrist: [0.25, -0.15, -0.52], direction: [0.15, 0.0, -1] },
    Left: { wrist: [0.18, -0.14, -0.85], direction: [0.7, 0.12, -0.75] },
  };
  for (const side of ['Left', 'Right']) {
    const wrist = find(side + 'Hand_'),
      elbow = find(side + 'ForeArm_');
    if (!wrist || !elbow) throw new Error('El rig de Chamber no contiene ' + side + 'Hand/ForeArm');
    const origin = wrist.getWorldPosition(new THREE.Vector3()),
      from = origin.clone().sub(elbow.getWorldPosition(new THREE.Vector3())).normalize(),
      to = new THREE.Vector3(...poses[side].direction).normalize();
    const arm = new THREE.Group();
    arm.quaternion.setFromUnitVectors(from, to);
    arm.position.fromArray(poses[side].wrist);
    arm.scale.setScalar(0.62);
    // Orient the palm, not just the elbow: this also fixes the wrist roll.
    const index = find(side + 'HandIndex1_').getWorldPosition(new THREE.Vector3());
    const ring = find(side + 'HandRing1_').getWorldPosition(new THREE.Vector3());
    if (posed)
      arm.scale.setScalar(
        (customPose ? 0.065 : 0.1) / Math.max(0.001, index.clone().add(ring).multiplyScalar(0.5).distanceTo(origin)),
      );
    const forward = index.clone().add(ring).multiplyScalar(0.5).sub(origin).normalize();
    const across = index.clone().sub(ring).normalize();
    const basis = (x, y) => {
      const z = new THREE.Vector3().crossVectors(x, y).normalize();
      x = new THREE.Vector3().crossVectors(y, z).normalize();
      return new THREE.Matrix4().makeBasis(x, y, z);
    };
    arm.userData.sourceBasis = basis(across, forward).invert();
    arm.userData.orient = (x, y) => {
      arm.quaternion.setFromRotationMatrix(
        basis(new THREE.Vector3(...x), new THREE.Vector3(...y).normalize()).multiply(
          arm.userData.sourceBasis,
        ),
      );
    };
    arm.userData.orient(
      customPose ? [0,0,1] : side === 'Right' ? [0, 0, -1] : [0, 0, 1],
      side === 'Right' ? [0, 1, -0.25] : customPose ? [0.1,1,-0.1] : [0.85, 0.5, 0.05],
    );
    palmOffsets[side] = index
      .clone()
      .add(ring)
      .multiplyScalar(0.5)
      .sub(origin)
      .multiplyScalar(customPose ? 0.9 : 0.55);
    // Bend the forearm toward the bottom edge without rotating the gripping palm.
    const sourceElbow = elbow.getWorldPosition(new THREE.Vector3()).sub(origin);
    const cameraElbow = customPose ? new THREE.Vector3(side === 'Left' ? -0.5 : 0.15, -0.72, 0.15) : new THREE.Vector3(side === 'Left' ? -0.06 : 0.08, -0.46, 0.06);
    const localElbow = cameraElbow
      .divideScalar(arm.scale.x)
      .applyQuaternion(arm.quaternion.clone().invert());
    const elbowRotation = new THREE.Quaternion().setFromUnitVectors(
      sourceElbow.clone().normalize(),
      localElbow.clone().normalize(),
    );
    const elbowStretch = localElbow.length() / sourceElbow.length();
    const bindMatrices=root.userData.handBindMatrices;
    const segments=customPose && bindMatrices ? bones.filter(b=>new RegExp('^'+side+'Hand(Thumb|Index|Middle|Pinky|Ring)[0123]_').test(b.name)).map(b=>{
      const bind=bindMatrices.get(b.uuid);
      const start=new THREE.Vector3().setFromMatrixPosition(bind);
      const child=b.children.find(c=>c.isBone && bindMatrices.has(c.uuid));
      const end=child?new THREE.Vector3().setFromMatrixPosition(bindMatrices.get(child.uuid)):start.clone().add(new THREE.Vector3(0,.012,0));
      return {line:new THREE.Line3(start,end),delta:b.matrixWorld.clone().multiply(bind.clone().invert())};
    }):[];
    const poseHandPoint=point=>{
      if(!segments.length || point.dot(sourceElbow)/sourceElbow.lengthSq()>.16 || point.length()>.22)return point;
      const world=point.clone().add(origin),closest=new THREE.Vector3();
      const choices=segments.map(segment=>{segment.line.closestPointToPoint(world,true,closest);return {...segment,distance:closest.distanceTo(world)};}).sort((a,b)=>a.distance-b.distance).slice(0,3);
      if(choices[0].distance>.055)return point;
      const result=new THREE.Vector3();let total=0;
      for(const item of choices){const weight=1/Math.pow(item.distance+.006,4);result.addScaledVector(world.clone().applyMatrix4(item.delta),weight);total+=weight;}
      return point.copy(result.divideScalar(total).sub(origin));
    };
    group.add(arm);
    armsBySide[side] = arm;
    root.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const source = mesh.geometry,
        skinIndex = source.getAttribute('skinIndex'),
        weights = source.getAttribute('skinWeight');
      if (!skinIndex || !weights) return;
      const accepted = new Set(
        mesh.skeleton.bones
          .map((b, i) => {let ancestor=b;while(ancestor){if(new RegExp(side + '(ForeArm|Hand)', 'i').test(ancestor.name))return i;ancestor=ancestor.parent;}return -1;})
          .filter((i) => i >= 0),
      );
      const bindPoints = new Map();
      const restPoint = i => {
        if(!bindPoints.has(i))bindPoints.set(i,new THREE.Vector3().fromBufferAttribute(source.attributes.position,i).applyMatrix4(mesh.matrixWorld).sub(origin));
        return bindPoints.get(i);
      };
      const allowed = (i) => {
        if(customPose){
          let unrelated=0;
          for(let j=0;j<4;j++){
            const name=mesh.skeleton.bones[skinIndex.getComponent(i,j)].name;
            if(/Hip|Skirt|Pelvis|Spine|Neck|Hair|Head|Clavicle|Shoulder|Thigh|Knee|Foot|Toe/.test(name))unrelated+=weights.getComponent(i,j);
          }
          if(unrelated>.5)return false;
          const p=restPoint(i),along=p.dot(sourceElbow)/sourceElbow.lengthSq();
          const radial=p.clone().addScaledVector(sourceElbow,-along).length();
          return (along>=-.06 && along<=1.08 && radial<.095) || (along<.14 && p.length()<.20);
        }
        let total = 0;
        for (let j = 0; j < 4; j++)
          if (accepted.has(skinIndex.getComponent(i, j))) total += weights.getComponent(i, j);
        return total >= 0.65;
      };
      const indices = source.index;
      const keep = [],
        groups = [];
      for (const part of source.groups.length
        ? source.groups
        : [
            {
              start: 0,
              count: indices ? indices.count : source.getAttribute('position').count,
              materialIndex: 0,
            },
          ]) {
        const start = keep.length;
        for (let n = part.start; n < part.start + part.count; n += 3) {
          const a = indices ? indices.getX(n) : n,
            b = indices ? indices.getX(n + 1) : n + 1,
            c = indices ? indices.getX(n + 2) : n + 2;
          if (allowed(a) && allowed(b) && allowed(c)) keep.push(a, b, c);
        }
        if (keep.length > start)
          groups.push({ start, count: keep.length - start, materialIndex: part.materialIndex });
      }
      if (!keep.length) return;
      const geometry = source.clone(),
        positions = source.getAttribute('position'),
        baked = new Float32Array(positions.count * 3),
        point = new THREE.Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i);
        if(customPose){
          point.applyMatrix4(mesh.matrixWorld).sub(origin);
          poseHandPoint(point);
        }else{
          mesh.applyBoneTransform(i, point);
          point.applyMatrix4(mesh.matrixWorld).sub(origin);
        }
        if (posed) {
          const blend = THREE.MathUtils.clamp(
            point.dot(sourceElbow) / sourceElbow.lengthSq(),
            0,
            1,
          );
          const forearm = point
            .clone()
            .addScaledVector(sourceElbow, blend * (elbowStretch - 1))
            .applyQuaternion(elbowRotation);
          point.lerp(forearm, THREE.MathUtils.smoothstep(blend, 0, 0.45));
        }
        point.toArray(baked, i * 3);
      }
      geometry.setAttribute('position', new THREE.BufferAttribute(baked, 3));
      geometry.setIndex(keep);
      geometry.clearGroups();
      groups.forEach((g) => geometry.addGroup(g.start, g.count, g.materialIndex));
      geometry.deleteAttribute('skinIndex');
      geometry.deleteAttribute('skinWeight');
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
      const result = new THREE.Mesh(geometry, mesh.material);
      result.frustumCulled = false;
      arm.add(result);
    });
    if (!arm.children.length) throw new Error('No se encontraron polígonos del brazo ' + side);
  }
  group.userData.fitToWeapon = (weapon, id) => {
    const sockets = findGripSockets(weapon);
    const pistol = ['ghost', 'sheriff'].includes(id);
    const right = (sockets.right || new THREE.Vector3(0.22, -0.19, -0.49)).clone();
    const left = (sockets.left || new THREE.Vector3(0.22, -0.16, -0.86)).clone();
    right.add(new THREE.Vector3(0.005, customPose ? -0.04 : pistol ? 0.02 : -0.005, -0.015));
    left.add(new THREE.Vector3(-0.015, customPose ? -0.025 : -0.085, 0));
    if (pistol) {
      left.copy(right).add(new THREE.Vector3(-0.035, -0.015, -0.025));
      armsBySide.Left.userData.orient([0, 0, 1], [0.25, 1, -0.25]);
    }
    for (const [side, target] of [
      ['Right', right],
      ['Left', left],
    ]) {
      const arm = armsBySide[side];
      const palm = palmOffsets[side]
        .clone()
        .multiplyScalar(arm.scale.x)
        .applyQuaternion(arm.quaternion);
      arm.position.copy(target).sub(palm);
    }
  };
  return group;
}
