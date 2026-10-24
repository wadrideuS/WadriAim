import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { findGripSockets } from './WeaponViewmodel.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
/** Original, camera-space glove geometry. Each grip is authored around the weapon sockets. */
export function buildCustomArms() {
  const root = new THREE.Group();
  root.name = 'Wadri custom gloves';
  const grain = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < 128 * 128; i++) {
    const noise = 110 + Math.floor(((((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1) * 35);
    grain.set([noise, noise, noise, 255], i * 4);
  }
  const texture = new THREE.DataTexture(grain, 128, 128, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.needsUpdate = true;
  const leather = new THREE.MeshStandardMaterial({
    color: 0x363e46,
    roughness: 0.82,
    bumpMap: texture,
    bumpScale: 0.0005,
  });
  const skin = new THREE.MeshStandardMaterial({
    color: 0xc18d6c,
    roughness: 0.86,
    bumpMap: texture,
    bumpScale: 0.0002,
  });
  const pads = new THREE.MeshStandardMaterial({ color: 0x58606a, roughness: 0.65 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x171d27, roughness: 1 });
  const seam = new THREE.MeshStandardMaterial({ color: 0x8092a5, roughness: 0.8 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x93a6ab, roughness: 0.65 });
  const add = (geometry, mat, parent = root) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.frustumCulled = false;
    parent.add(mesh);
    return mesh;
  };
  const oval = (parent, position, size, mat) => {
    const mesh = add(new THREE.SphereGeometry(1, 24, 16), mat, parent);
    mesh.position.copy(position);
    mesh.scale.fromArray(size);
    return mesh;
  };
  const panel = (parent, position, size, material, radius = 0.008) => {
    const mesh = add(new RoundedBoxGeometry(...size, 4, radius), material, parent);
    mesh.position.copy(position);
    return mesh;
  };
  const palm = (parent, position, size) => {
    const mesh = panel(
      parent,
      position,
      size.map((n) => n * 1.8),
      leather,
      0.014,
    );
    mesh.rotation.z = -0.06;
    return mesh;
  };
  const tube = (parent, points, radius, mat) => {
    if (parent !== root && radius >= 0.008) {
      const finger = new THREE.Group();
      parent.add(finger);
      points.forEach((p, i) => {
        const r = radius * (1 - i * 0.095);
        const fingertip = i === points.length - 1;
        oval(finger, p, [r, r * 0.94, r], fingertip ? skin : mat);
        if (!i) return;
        const previous = points[i - 1],
          length = p.distanceTo(previous);
        const segment = add(
          new THREE.CylinderGeometry(r, radius * (1 - (i - 1) * 0.095), length, 14, 1),
          mat,
          finger,
        );
        segment.position.copy(p).add(previous).multiplyScalar(0.5);
        segment.quaternion.setFromUnitVectors(v(0, 1, 0), p.clone().sub(previous).normalize());
        if (i < points.length - 1) {
          const pad = panel(
            finger,
            p.clone().add(v(0, 0.001, -r * 0.65)),
            [r * 1.35, r * 0.85, 0.004],
            pads,
            0.002,
          );
          pad.rotation.copy(segment.rotation);
        }
      });
      return finger;
    }
    const curve = new THREE.CatmullRomCurve3(points);
    return add(new THREE.TubeGeometry(curve, 24, radius, 10, false), mat, parent);
  };
  const forearm = (wrist, side) => {
    // Both sleeve ends extend beyond the viewport, so no detached elbow is exposed.
    const elbow = v(side === 'left' ? -0.18 : 0.48, -0.85, -0.28);
    const sleeve = tube(root, [elbow, elbow.clone().lerp(wrist, 0.55), wrist], 0.042, fabric);
    const positions = sleeve.geometry.attributes.position;
    const curve = sleeve.geometry.parameters.path;
    const point = new THREE.Vector3();
    for (let ring = 0; ring <= 24; ring++) {
      const center = curve.getPointAt(ring / 24);
      for (let edge = 0; edge <= 10; edge++) {
        const i = ring * 11 + edge;
        point
          .fromBufferAttribute(positions, i)
          .sub(center)
          .multiplyScalar(1 - (ring / 24) * 0.36)
          .add(center);
        positions.setXYZ(i, point.x, point.y, point.z);
      }
    }
    sleeve.geometry.computeVertexNormals();
    const cuff = oval(root, wrist.clone().add(v(0, -0.024, 0.015)), [0.034, 0.03, 0.031], leather);
    cuff.rotation.z = side === 'left' ? -0.2 : 0.15;
    oval(root, wrist.clone().add(v(0, -0.026, -0.027)), [0.025, 0.012, 0.008], accent);
  };
  const rightHand = (grip, pistol) => {
    const hand = new THREE.Group();
    root.add(hand);
    hand.position.copy(grip);
    hand.scale.setScalar(0.82);
    palm(hand, v(0.035, -0.008, 0.024), [0.033, 0.057, 0.025]);
    panel(hand, v(0.059, 0.003, 0.027), [0.008, 0.065, 0.034], pads, 0.004);
    for (let i = 0; i < 3; i++)
      panel(hand, v(0.064, -0.016 + i * 0.016, 0.028), [0.003, 0.007, 0.025], fabric, 0.001);
    tube(hand, [v(0.06, -0.045, 0.007), v(0.065, 0.0, 0.006), v(0.058, 0.04, 0.01)], 0.001, seam);
    for (let i = 0; i < 4; i++) {
      const y = 0.03 - i * 0.021;
      tube(
        hand,
        [v(0.052, y, 0.004), v(0.033, y, -0.029), v(-0.004, y, -0.039), v(-0.027, y, -0.018)],
        0.009,
        leather,
      );
      oval(hand, v(0.036, y, -0.022), [0.012, 0.01, 0.009], pads);
      tube(
        hand,
        [v(0.046, y + 0.004, -0.016), v(0.03, y + 0.004, -0.03), v(0.014, y + 0.004, -0.036)],
        0.0013,
        seam,
      );
    }
    tube(
      hand,
      [v(0.025, 0.047, 0.033), v(-0.005, 0.055, 0.02), v(-0.026, 0.035, -0.005)],
      0.012,
      leather,
    );
    const wrist = grip.clone().add(v(0.035, -0.065, 0.04));
    forearm(wrist, 'right');
    hand.userData.pistol = pistol;
  };
  const supportHand = (support, pistol) => {
    const hand = new THREE.Group();
    root.add(hand);
    hand.position.copy(support);
    hand.scale.setScalar(0.82);
    if (pistol) {
      palm(hand, v(-0.026, -0.02, 0.022), [0.029, 0.043, 0.025]);
      for (let i = 0; i < 4; i++) {
        const y = 0.019 - i * 0.019;
        tube(hand, [v(-0.048, y, 0.014), v(-0.028, y, -0.027), v(0.01, y, -0.036)], 0.009, leather);
      }
      tube(
        hand,
        [v(-0.037, 0.022, 0.027), v(-0.023, 0.049, 0.008), v(0.007, 0.044, -0.016)],
        0.012,
        leather,
      );
      forearm(support.clone().add(v(-0.035, -0.06, 0.035)), 'left');
    } else {
      palm(hand, v(-0.015, -0.022, 0.003), [0.039, 0.023, 0.052]);
      for (let i = 0; i < 4; i++) {
        const z = -0.041 + i * 0.024;
        tube(
          hand,
          [v(-0.05, -0.008, z), v(-0.046, 0.027, z), v(-0.019, 0.04, z), v(0.008, 0.028, z)],
          0.009,
          leather,
        );
        oval(hand, v(-0.045, 0.017, z), [0.012, 0.013, 0.01], pads);
      }
      tube(
        hand,
        [v(0.018, -0.018, 0.04), v(0.041, 0.006, 0.037), v(0.032, 0.035, 0.018)],
        0.012,
        leather,
      );
      tube(hand, [v(-0.046, -0.021, -0.033), v(-0.046, -0.023, 0.025)], 0.0015, seam);
      forearm(support.clone().add(v(-0.023, -0.045, 0.045)), 'left');
    }
  };
  root.userData.fitToWeapon = (weapon, id) => {
    root.traverse((n) => {
      if (n.isMesh) n.geometry.dispose();
    });
    root.clear();
    const sockets = findGripSockets(weapon);
    const pistol = ['ghost', 'sheriff'].includes(id);
    const overrides = {
      phantom: { right: [0.22, -0.22, -0.48], left: [0.22, -0.19, -0.85] },
    };
    const right = (sockets.right || v(...(overrides[id]?.right || [0.22, -0.18, -0.5]))).clone();
    right.add(v(0.0, pistol ? -0.025 : -0.045, 0.025));
    const left = pistol
      ? right.clone().add(v(-0.025, -0.012, 0.007))
      : (sockets.left || v(...(overrides[id]?.left || [0.22, -0.16, -0.86])))
          .clone()
          .add(v(0.012, -0.04, 0));
    rightHand(right, pistol);
    supportHand(left, pistol);
    root.userData.grips = { right: right.toArray(), left: left.toArray(), weapon: id };
  };
  return root;
}
