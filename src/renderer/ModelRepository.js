import { frameSportKnife } from './SportKnifeViewmodel.js';
import { buildUploadedChamberArms } from './UploadedChamberArms.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import models from '../data/models.json' with { type: 'json' };
import { buildCustomArms } from './CustomArms.js';
import { buildChamberViewmodel } from './ChamberArms.js';
import { fitWeaponModel } from './WeaponViewmodel.js';
import { buildFpsRigArms } from './FpsRigArms.js';

export class MissingAssetError extends Error {
  constructor(id) {
    super(`Falta importar ${id}`);
    this.name = 'MissingAssetError';
  }
}

export class ModelRepository {
  constructor() {
    this.cache = new Map();
    this.gltf = new GLTFLoader();
  }
  /** Cached, parsed GLTF for a manifest entry (shared by viewmodels and arena agents). */
  gltfFor(id) {
    const entry = models[id];
    if (!entry?.path) return Promise.reject(new MissingAssetError(id));
    if (!this.cache.has(id)) {
      const url = import.meta.env.BASE_URL + entry.path.replace(/^\//, '');
      const promise = this.gltf
        .loadAsync(url)
        .then(async (loaded) => {
          // Older Sketchfab assets store their colour maps in the specular/glossiness extension.
          const materials = new Set();
          loaded.scene.traverse((n) => {
            if (n.isMesh)
              (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) =>
                materials.add(m),
              );
          });
          await Promise.all(
            [...materials].map(async (material) => {
              const definition = loaded.parser.json.materials?.find(
                (m) => m.name === material.name,
              );
              const legacy = definition?.extensions?.KHR_materials_pbrSpecularGlossiness;
              if (!legacy) return;
              if (legacy.diffuseTexture) {
                material.map = await loaded.parser.getDependency(
                  'texture',
                  legacy.diffuseTexture.index,
                );
                material.map.colorSpace = THREE.SRGBColorSpace;
              }
              material.color.fromArray(legacy.diffuseFactor || [1, 1, 1]);
              material.metalness = 0;
              material.roughness = material.name.includes('Glove') ? 0.8 : 0.6;
              material.needsUpdate = true;
            }),
          );
          return loaded;
        })
        .catch((error) => {
          this.cache.delete(id);
          throw error;
        });
      this.cache.set(id, promise);
    }
    return this.cache.get(id);
  }
  async load(id) {
    if (id === 'customhands') {
      const object = buildCustomArms();
      return {
        object,
        animations: [],
        mixer: new THREE.AnimationMixer(object),
        entry: { kind: 'arms', author: 'WadriAim' },
        poseArms: null,
      };
    }
    const entry = models[id];
    const loaded = await this.gltfFor(id);
    let object = clone(loaded.scene);
    if (id === 'fpshands') {
      const arms = buildFpsRigArms(loaded);
      return { object: arms, animations: [], mixer: new THREE.AnimationMixer(arms), entry, poseArms: null };
    }
    if (entry.kind === 'arms') {
      if (id === 'fpshands') {
        const draw = loaded.animations.find((clip) => clip.name === 'Draw');
        if (draw) {
          const poseMixer = new THREE.AnimationMixer(object);
          const action = poseMixer.clipAction(draw);
          action.play();
          poseMixer.setTime(Math.max(0, draw.duration - 0.025));
          object.updateMatrixWorld(true);
        }
      }
      const arms = (id === 'chamber_tpose' || id.startsWith('agent_')) ? buildUploadedChamberArms(object) : buildChamberViewmodel(object, { posed: id === 'fpshands' });
      return {
        object: arms,
        animations: [],
        mixer: new THREE.AnimationMixer(arms),
        entry,
        poseArms: null,
      };
    }
    if (entry.includesHands) {
      // The upload contains a spare, unheld knife as well as the held viewmodel.
      const spare = object.getObjectByName('models/weapons/v_knife_karam.mdl');
      spare?.removeFromParent();
      // This GLB has no embedded textures: give its existing surfaces a dark sport finish.
      object.traverse(node => {
        if (!node.isMesh) return;
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          if (material.name.includes('bare_arm')) material.color.set('#a77b61');
          else if (material.name.includes('knife_karam')) {
            material.color.set('#667887'); material.metalness = .85; material.roughness = .24;
          } else { material.color.set('#26343f'); material.roughness = .82; }
        }
      });
    }
    let container = fitWeaponModel(object, entry, id);
    if (entry.includesHands) container = frameSportKnife(container, entry.viewmodel.position[0]);
    let poseArms = null;
    container.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((m) => {
          if (m) m.depthTest = true;
        });
      }
    });
    return {
      object: container,
      animations: loaded.animations || [],
      mixer: new THREE.AnimationMixer(object),
      entry,
      poseArms,
    };
  }
  dispose() {
    this.cache.forEach(async (p) => {
      const { scene } = await p;
      scene.traverse((n) => {
        if (n.isMesh) {
          n.geometry.dispose();
          const mats = Array.isArray(n.material) ? n.material : [n.material];
          mats.forEach((m) => {
            Object.values(m).forEach((v) => {
              if (v?.isTexture) v.dispose();
            });
            m.dispose();
          });
        }
      });
    });
    this.cache.clear();
  }
}
export { models };
