export const finishes = {
  original: { name: 'Acabado original', color: null },
  rose: { name: 'Rosa Wadri · personalizado', color: 0xf5a2c4 },
  graphite: { name: 'Grafito Wadri · personalizado', color: 0x66707e },
};
export const skinNames = {
  vandal: 'Forsaken blanca',
  phantom: 'BlastX',
  ghost: 'Ghost base',
  guardian: 'Guardian base',
  sheriff: 'Sheriff base',
};
export function applyFinish(root, id) {
  const finish = finishes[id] || finishes.original;
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mesh.material = list.map((material) => {
      const copy = material.clone();
      if (finish.color !== null)
        copy.color.multiply({
          r: ((finish.color >> 16) & 255) / 255,
          g: ((finish.color >> 8) & 255) / 255,
          b: (finish.color & 255) / 255,
        });
      return copy;
    });
    if (mesh.material.length === 1) mesh.material = mesh.material[0];
  });
}
