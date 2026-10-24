import * as THREE from 'three';
/** Fits each uploaded weapon using its muzzle and skeleton sockets. */
export function fitWeaponModel(object, entry, id) {
  const container = new THREE.Group(),
    oriented = new THREE.Group();
  oriented.add(object);
  container.add(oriented);
  const remove = [];
  object.traverse((node) => {
    if (/GN_(Dmr|Luger)_Magazine|Magazine_Extra/i.test(node.name) && !node.isBone)
      remove.push(node);
  });
  remove.forEach((node) => node.removeFromParent());
  object.updateMatrixWorld(true);
  if (entry.viewmodel.autoOrient) {
    const bounds = new THREE.Box3().setFromObject(object),
      size = bounds.getSize(new THREE.Vector3()),
      center = bounds.getCenter(new THREE.Vector3());
    const axis =
      size.x >= size.y && size.x >= size.z
        ? new THREE.Vector3(1, 0, 0)
        : size.y >= size.z
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);
    let muzzle = null;
    object.traverse((n) => {
      if (!muzzle && /^Muzzle[_0-9]/i.test(n.name)) muzzle = n;
    });
    if (muzzle) {
      if (muzzle.getWorldPosition(new THREE.Vector3()).sub(center).dot(axis) < 0) axis.negate();
    }
    oriented.quaternion.setFromUnitVectors(axis, new THREE.Vector3(0, 0, -1));
  }
  oriented.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(oriented),
    size = bounds.getSize(new THREE.Vector3()),
    center = bounds.getCenter(new THREE.Vector3());
  oriented.position.sub(center);
  container.scale.setScalar(entry.viewmodel.length / Math.max(size.x, size.y, size.z, 0.001));
  container.rotation.fromArray([...entry.viewmodel.rotation, 'XYZ']);
  container.position.fromArray(entry.viewmodel.position);
  container.updateMatrixWorld(true);
  return container;
}
export function findGripSockets(object) {
  object.updateMatrixWorld(true);
  let right, left;
  object.traverse((node) => {
    if (!right && /^Root_\d+$/i.test(node.name)) right = node;
    if (!left && /^Left_Hand_Target_\d+$/i.test(node.name)) left = node;
  });
  return {
    right: right?.getWorldPosition(new THREE.Vector3()),
    left: left?.getWorldPosition(new THREE.Vector3()),
  };
}
