import * as THREE from 'three';

/** Hitbox radius per head-only mode (Microflicks, Smooth Tracking, mode 6). */
const ORB_RADIUS_BY_MODE = { 0: 0.17, 2: 0.25, 6: 0.14 };
const DEFAULT_ORB_RADIUS = 0.25;
/** Head height inside the bot group; ArenaRenderer offsets the group by -1.65. */
export const ORB_CENTER_Y = 1.65;
/** Aura sprite width in hitbox radii; the sphere edge sits at 1 / AURA_SCALE of its half-width. */
const AURA_SCALE = 1.7;
/** Fraction of the sphere covered by the emblem texture. */
const EMBLEM_EXTENT = 0.72;
const TEXTURE_SIZE = 256;
const EMBLEM_SPIN = 0.22;
const AURA_SPIN = 0.35;
const BURST_LIFE = 0.24;
const BURST_GROWTH = 1.6;

const noRaycast = () => {};

const coreVertex = /* glsl */ `
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = viewPosition.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

// The view-space normal's xy is the point's position on a camera-facing disc,
// so the emblem billboards for free and never leaves the silhouette.
const coreFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uTracked;
  uniform sampler2D uEmblem;
  varying vec3 vViewPosition;
  varying vec3 vViewNormal;
  void main() {
    vec3 normal = normalize(vViewNormal);
    float facing = clamp(dot(normal, normalize(-vViewPosition)), 0.0, 1.0);
    float pulse = 0.5 + 0.5 * sin(uTime * 3.2);
    float angle = uTime * ${EMBLEM_SPIN.toFixed(2)};
    mat2 spin = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    vec2 uv = spin * normal.xy / (2.0 * ${EMBLEM_EXTENT.toFixed(2)}) + 0.5;
    vec4 mask = texture2D(uEmblem, uv);

    float rim = pow(1.0 - facing, 2.0);
    float streaks = pow(abs(sin(atan(normal.y, normal.x) * 9.0 + uTime * 0.8)), 10.0);
    vec3 shell = mix(uColor * 0.62, mix(uColor, vec3(1.0), 0.3), rim);
    shell = (shell + uColor * 0.3 * streaks * (1.0 - rim)) * (0.92 + 0.08 * pulse);
    vec3 color = mix(shell, uColor * 0.1 + vec3(0.008, 0.006, 0.03), mask.r);
    color = mix(color, vec3(1.0), mask.g * (0.86 + 0.14 * pulse));
    color *= 1.0 + 0.3 * uTracked;
    color = mix(color, uColor * 0.18, smoothstep(0.16, 0.03, facing));
    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function paintCanvas(paint) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEXTURE_SIZE;
  const context = canvas.getContext('2d');
  context.translate(TEXTURE_SIZE / 2, TEXTURE_SIZE / 2);
  paint(context, TEXTURE_SIZE / 2);
  return canvas;
}

function circle(context, radius) {
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
}

/** Red channel: deep inner disc. Green channel: white ring and faceted crosshair emblem. */
function paintEmblem(context, half) {
  const unit = half * (1 / EMBLEM_EXTENT);
  context.fillStyle = '#000';
  context.fillRect(-half, -half, half * 2, half * 2);
  context.globalCompositeOperation = 'lighter';
  context.fillStyle = '#f00';
  circle(context, unit * 0.6);
  context.fill();
  context.strokeStyle = '#0f0';
  context.lineWidth = unit * 0.07;
  circle(context, unit * 0.63);
  context.stroke();
  for (let i = 0; i < 4; i++) {
    context.save();
    context.rotate(Math.PI / 4 + (i * Math.PI) / 2);
    for (const side of [1, -1]) {
      context.fillStyle = side > 0 ? '#0f0' : '#090';
      context.beginPath();
      context.moveTo(0, -unit * 0.12);
      context.lineTo(side * unit * 0.1, -unit * 0.26);
      context.lineTo(0, -unit * 0.5);
      context.closePath();
      context.fill();
    }
    context.restore();
  }
  context.fillStyle = '#0f0';
  context.rotate(Math.PI / 4);
  context.fillRect(-unit * 0.045, -unit * 0.045, unit * 0.09, unit * 0.09);
}

/** Soft halo hugging the sphere plus dark crystal rays; tinted by the sprite colour. */
function paintAura(context, half) {
  const edge = half / AURA_SCALE;
  const halo = context.createRadialGradient(0, 0, edge * 0.95, 0, 0, edge * 1.3);
  halo.addColorStop(0, 'rgba(255,255,255,0.3)');
  halo.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = halo;
  context.fillRect(-half, -half, half * 2, half * 2);
  for (let i = 0; i < 8; i++) {
    const length = edge * (i % 2 ? 1.22 : 1.45);
    context.save();
    context.rotate((i * Math.PI) / 4 + Math.PI / 8);
    context.beginPath();
    context.moveTo(0, -edge * 0.85);
    context.lineTo(half * 0.045, -edge * 1.15);
    context.lineTo(0, -length);
    context.lineTo(-half * 0.045, -edge * 1.15);
    context.closePath();
    context.fillStyle = 'rgba(28,28,34,0.6)';
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.22)';
    context.lineWidth = 1.5;
    context.stroke();
    context.restore();
  }
}

/** Expanding ring with a bright flash in the middle, for the hit burst. */
function paintBurst(context, half) {
  const flash = context.createRadialGradient(0, 0, 0, 0, 0, half);
  flash.addColorStop(0, 'rgba(255,255,255,0.75)');
  flash.addColorStop(0.35, 'rgba(255,255,255,0.15)');
  flash.addColorStop(0.72, 'rgba(255,255,255,0)');
  flash.addColorStop(0.84, 'rgba(255,255,255,0.95)');
  flash.addColorStop(0.92, 'rgba(255,255,255,0)');
  context.fillStyle = flash;
  context.fillRect(-half, -half, half * 2, half * 2);
}

let assets;
function orbAssets() {
  if (assets) return assets;
  const emblem = new THREE.CanvasTexture(paintCanvas(paintEmblem));
  const uniforms = {
    uColor: { value: new THREE.Color('#8f6bff') },
    uTime: { value: 0 },
    uTracked: { value: 0 },
    uEmblem: { value: emblem },
  };
  const spriteOptions = { transparent: true, depthWrite: false, fog: false, toneMapped: false };
  const aura = new THREE.CanvasTexture(paintCanvas(paintAura));
  const burst = new THREE.CanvasTexture(paintCanvas(paintBurst));
  aura.colorSpace = burst.colorSpace = THREE.SRGBColorSpace;
  assets = {
    uniforms,
    geometry: new THREE.SphereGeometry(1, 40, 24),
    core: new THREE.ShaderMaterial({ uniforms, vertexShader: coreVertex, fragmentShader: coreFragment }),
    aura: new THREE.SpriteMaterial({ map: aura, ...spriteOptions }),
    burst: new THREE.SpriteMaterial({ map: burst, blending: THREE.AdditiveBlending, ...spriteOptions }),
  };
  return assets;
}

export function targetOrbRadius(mode) {
  return ORB_RADIUS_BY_MODE[mode] ?? DEFAULT_ORB_RADIUS;
}

/** Energy orb target: the sphere is the only raycastable part, the aura sits behind it. */
export function createTargetOrb(radius) {
  const { geometry, core, aura } = orbAssets();
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(geometry, core);
  sphere.scale.setScalar(radius);
  sphere.position.y = ORB_CENTER_Y;
  Object.assign(sphere.userData, { part: 'head', keepColors: true, sharedAsset: true });
  const halo = new THREE.Sprite(aura);
  halo.scale.setScalar(radius * 2 * AURA_SCALE);
  halo.position.y = ORB_CENTER_Y;
  halo.userData.keepColors = true;
  halo.raycast = noRaycast;
  group.add(sphere, halo);
  return group;
}

/** Follows the palette accent (`--palette-accent`). */
export function setTargetOrbColor(color) {
  const { uniforms, aura, burst } = orbAssets();
  uniforms.uColor.value.copy(color);
  aura.color.copy(color);
  burst.color.copy(color).lerp(new THREE.Color(0xffffff), 0.35);
}

/** Performance mode drops the translucent aura; the core stays identical. */
export function setTargetOrbQuality(isFast) {
  orbAssets().aura.visible = !isFast;
}

export function animateTargetOrbs(time, isTracked) {
  const { uniforms, aura } = orbAssets();
  uniforms.uTime.value = time;
  uniforms.uTracked.value = isTracked ? 1 : 0;
  aura.rotation = time * AURA_SPIN;
  aura.opacity = 0.85 + 0.15 * Math.sin(time * 3.2);
}

/** Short ring flash where an orb was destroyed. */
export class OrbBursts {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }
  spawn(position, radius) {
    const sprite = new THREE.Sprite(orbAssets().burst.clone());
    sprite.position.set(position.x, position.y, position.z);
    sprite.userData.keepColors = true;
    sprite.raycast = noRaycast;
    this.scene.add(sprite);
    this.items = [...this.items, { sprite, radius, life: BURST_LIFE }];
  }
  update(dt) {
    this.items = this.items.filter((item) => {
      item.life -= dt;
      const progress = Math.min(1, 1 - item.life / BURST_LIFE);
      item.sprite.scale.setScalar(item.radius * 2 * (1 + progress * BURST_GROWTH));
      item.sprite.material.opacity = 1 - progress;
      if (item.life > 0) return true;
      this.scene.remove(item.sprite);
      item.sprite.material.dispose();
      return false;
    });
  }
}
