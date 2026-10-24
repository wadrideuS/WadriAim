import * as THREE from 'three';
import {
  ORB_CENTER_Y,
  OrbBursts,
  animateTargetOrbs,
  createTargetOrb,
  setTargetOrbColor,
} from './targetOrb.js';

export const HERO_ORB_COUNT = 3;
/**
 * Landing-page preview of the arena targets. The world origin is the CSS crosshair,
 * so slots are offsets from it. Orb i alternates between slots i and i + HERO_ORB_COUNT,
 * which share a depth band: the near orb always respawns near, the far one far.
 */
export const HERO_ORB_SLOTS = [
  { x: -2.4, y: -0.3, z: 0, radius: 0.36 },
  { x: 1.0, y: -0.52, z: 1.8, radius: 0.44 },
  { x: 3.93, y: 1.71, z: -3, radius: 0.33 },
  { x: 1.09, y: 1.43, z: -1, radius: 0.41 },
  { x: -0.96, y: 0.64, z: 1.4, radius: 0.47 },
  { x: 3.93, y: -1.22, z: -2.5, radius: 0.31 },
];
export const CAMERA_Z = 7;
const CAMERA_FOV = 34;
const MAX_PIXEL_RATIO = 1.5;
const PARALLAX = { x: 0.45, y: 0.28 };
const FLOAT_HEIGHT = 0.07;
const SWAY_WIDTH = 0.04;
const HIDDEN_AFTER_HIT = 0.5;
const SPAWN_DURATION = 0.42;
/** Glow sprite width in orb radii, placed behind the sphere so it never washes the emblem. */
const GLOW_SCALE = 5.2;
const GLOW_DEPTH = 1.3;
const GLOW_OPACITY = 0.5;
const GLOW_TEXTURE_SIZE = 128;

export function pairedSlot(slotIndex) {
  return (slotIndex + HERO_ORB_COUNT) % HERO_ORB_SLOTS.length;
}

function easeOutBack(progress) {
  const overshoot = 1.7;
  const shifted = progress - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

function paintGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = GLOW_TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  const half = GLOW_TEXTURE_SIZE / 2;
  const gradient = context.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE);
  return canvas;
}

function orbCenter(orb, time) {
  const { x, y, z } = orb.slot;
  return {
    x: x + Math.cos(time * 0.5 + orb.phase) * SWAY_WIDTH,
    y: y + Math.sin(time * 0.8 + orb.phase) * FLOAT_HEIGHT,
    z,
  };
}

function placeOrb(orb, time) {
  const growth = Math.min(Math.max((time - orb.bornAt) / SPAWN_DURATION, 0), 1);
  const scale = Math.max(orb.slot.radius * easeOutBack(growth), 0.001);
  const center = orbCenter(orb, time);
  orb.group.visible = time >= orb.hiddenUntil;
  orb.group.scale.setScalar(scale);
  orb.group.position.set(center.x, center.y - ORB_CENTER_Y * scale, center.z);
}

export function createHeroOrbScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 50);
  const glowTexture = new THREE.CanvasTexture(paintGlow());
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  const glowMaterial = new THREE.SpriteMaterial({
    map: glowTexture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: GLOW_OPACITY,
  });
  const bursts = new OrbBursts(scene);

  const createOrb = (_, slotIndex) => {
    const group = createTargetOrb(1);
    const glow = new THREE.Sprite(glowMaterial);
    glow.scale.setScalar(GLOW_SCALE);
    glow.position.set(0, ORB_CENTER_Y, -GLOW_DEPTH);
    group.add(glow);
    scene.add(group);
    const slot = HERO_ORB_SLOTS[slotIndex];
    return {
      group,
      slotIndex,
      slot,
      phase: slotIndex * 2.1,
      bornAt: -SPAWN_DURATION,
      hiddenUntil: 0,
    };
  };
  let orbs = Array.from({ length: HERO_ORB_COUNT }, createOrb);
  let hitCount = 0;

  return {
    resize(width, height, crosshairY) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.setViewOffset(width, height, 0, height / 2 - crosshairY, width, height);
    },
    setAccent(color) {
      const accent = new THREE.Color(color);
      setTargetOrbColor(accent);
      glowMaterial.color.copy(accent);
    },
    /** Pops the next orb with the game's hit burst and respawns it in its paired slot. */
    hit(time) {
      const target = hitCount % orbs.length;
      const victim = orbs[target];
      bursts.spawn(orbCenter(victim, time), victim.slot.radius);
      const slotIndex = pairedSlot(victim.slotIndex);
      const respawnAt = time + HIDDEN_AFTER_HIT;
      orbs = orbs.map((orb, index) =>
        index === target
          ? {
              ...orb,
              slotIndex,
              slot: HERO_ORB_SLOTS[slotIndex],
              bornAt: respawnAt,
              hiddenUntil: respawnAt,
            }
          : orb,
      );
      hitCount += 1;
    },
    render(time, dt, parallax) {
      animateTargetOrbs(time, false);
      bursts.update(dt);
      orbs.forEach((orb) => placeOrb(orb, time));
      camera.position.set(parallax.x * PARALLAX.x, -parallax.y * PARALLAX.y, CAMERA_Z);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    },
    /** Shared target-orb assets stay alive for the arena; only hero-owned resources are freed. */
    dispose() {
      bursts.update(Number.POSITIVE_INFINITY);
      glowMaterial.dispose();
      glowTexture.dispose();
      renderer.dispose();
    },
  };
}
