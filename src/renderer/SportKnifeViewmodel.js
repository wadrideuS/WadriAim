import * as THREE from 'three';
// The supplied knife and gloves are already posed. Bake that pose, then spread
// the two forearms in camera space without changing the grip or finger shapes.
export function frameSportKnife(source, centerX = 0) {
  source.updateMatrixWorld(true);
  const framed = new THREE.Group();
  source.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.skeleton?.update();
    const geometry = mesh.geometry.clone();
    const positions = geometry.getAttribute('position');
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(mesh.geometry.attributes.position, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, point);
      point.applyMatrix4(mesh.matrixWorld);
      point.x += point.x < centerX ? -.035 : .10;
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.viewModelBaked = true;
    const surface = new THREE.Mesh(geometry, mesh.material);
    surface.name = mesh.name;
    surface.frustumCulled = false;
    framed.add(surface);
  });
  return framed;
}
