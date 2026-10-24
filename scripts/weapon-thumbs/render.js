import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ModelRepository } from '../../src/renderer/ModelRepository.js';
import { WEAPON_THUMB_IDS, WEAPON_THUMB_SIZE } from '../../src/data/weapon-thumbs.js';

const SUPERSAMPLE = 2;
const PADDING = 0.06;
const WEBP_QUALITY = 0.88;
const { width, height } = WEAPON_THUMB_SIZE;

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(1);
renderer.setSize(width * SUPERSAMPLE, height * SUPERSAMPLE);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2430, 0.9));
const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(4, 5, 1);
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.2);
rim.position.set(-3, 2, -4);
scene.add(key, rim);

const camera = new THREE.OrthographicCamera();
const repository = new ModelRepository();

/** Profile view: muzzle (−Z after fitWeaponModel) points right, camera on +X. */
function frame(object) {
  object.position.set(0, 0, 0);
  object.rotation.set(0, 0, 0);
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  object.position.sub(box.getCenter(new THREE.Vector3()));
  const size = box.getSize(new THREE.Vector3());
  const aspect = width / height;
  const halfW = Math.max(size.z / 2, (size.y / 2) * aspect) * (1 + PADDING * 2);
  const halfH = halfW / aspect;
  Object.assign(camera, {
    left: -halfW,
    right: halfW,
    top: halfH,
    bottom: -halfH,
    near: 0.01,
    far: 100,
  });
  camera.position.set(10, 0, 0);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

function downscale() {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.imageSmoothingQuality = 'high';
  context.drawImage(renderer.domElement, 0, 0, width, height);
  return canvas.toDataURL('image/webp', WEBP_QUALITY);
}

async function renderWeapon(id) {
  const { object } = await repository.load(id);
  scene.add(object);
  frame(object);
  renderer.render(scene, camera);
  const dataUrl = downscale();
  scene.remove(object);
  return dataUrl;
}

const status = document.getElementById('status');
const list = document.getElementById('thumbs');
try {
  for (const id of WEAPON_THUMB_IDS) {
    const dataUrl = await renderWeapon(id);
    const figure = document.createElement('figure');
    const image = new Image();
    image.src = dataUrl;
    image.alt = id;
    const output = document.createElement('output');
    output.dataset.weapon = id;
    output.textContent = dataUrl;
    figure.append(image, output);
    list.append(figure);
  }
  status.textContent = 'Listo';
  document.body.dataset.done = 'true';
} catch (error) {
  status.textContent = 'Error: ' + error.message;
  document.body.dataset.error = error.message;
  console.error(error);
}
