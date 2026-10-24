import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {peekWalls} from '../game/peek-arena.js';
import { dynamicWalls } from '../game/dynamic-arena.js';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ModelRepository } from './ModelRepository.js';
import { VIEWMODEL_ADS_SHIFT, VIEWMODEL_REST_OFFSET } from './viewmodelRest.js';
import { applyFinish } from '../data/finishes.js';
import {
  OrbBursts,
  animateTargetOrbs,
  createTargetOrb,
  setTargetOrbColor,
  setTargetOrbQuality,
  targetOrbRadius,
} from './targetOrb.js';
import { animateAgent, flinchAgent } from './agent-rig.js';
import { approachAngle } from './agent-gait.js';
import {
  allyAgentId,
  createAgentBot,
  enemyAgentId,
  prepareAgentTemplate,
  prepareWeaponTemplate,
  setAgentOutline,
  setOutlineColor,
  setOutlineResolution,
} from './EnemyAgents.js';

/** Viewmodel field of view: wider = smaller gun and hands on screen. */
const VIEWMODEL_FOV = 92;
/** The karambit upload is framed inside its own container. */
const KNIFE_REST_OFFSET = new THREE.Vector3();
const VIEWMODEL_VERTICAL = 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(VIEWMODEL_FOV) / 2) / (16 / 9)));
/** Modes whose targets are floating heads rather than full agents. */
const headOnlyModes = [0, 2, 6];
/** Agent bots ease toward a new heading at this rate (1/s) instead of snapping. */
const BOT_TURN_RATE = 10;
/** Smoothing of the measured bot velocity (1/s): network updates arrive in bursts. */
const BOT_VELOCITY_SMOOTHING = 10;
/** Faster than this (m/s) is a respawn, not a step. */
const TELEPORT_SPEED = 25;
/** Baja latencia: bots farther than this (m) animate at FAR_BOT_RATE (Hz) instead of every frame. */
const FAR_BOT_DISTANCE = 18;
const FAR_BOT_RATE = 20;
/** Defence modes: a killed agent falls backwards (s, radians) and its body stays a moment (s). */
const DEATH_FALL = 0.55;
const DEATH_TILT = 1.45;
const BODY_LINGER = 2.5;

const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...options });
function cube(group, size, position, color) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material(color));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
/** Glowing, shootable ability (Leer, Dizzy, Prowler) for the flash drill. */
function createAbilityOrb(target) {
  const group = new THREE.Group();
  const color = new THREE.Color(target.color || 0xffffff);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(target.size || 0.25, 20, 14),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, roughness: 0.3 }),
  );
  core.userData.part = 'head';
  core.userData.keepColors = true;
  core.position.y = 1.65;
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry((target.size || 0.25) * 1.9, 16, 10),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false }),
  );
  halo.userData.keepColors = true;
  halo.raycast = () => {};
  halo.position.y = 1.65;
  group.add(core, halo);
  return group;
}
function createBot() {
  const group = new THREE.Group();
  group.userData.part = 'body';
  const add = (geometry, color, position, part = 'body', emissive = 0) => {
    const mesh = new THREE.Mesh(
      geometry,
      material(color, { metalness: 0.25, emissive, emissiveIntensity: 0.5 }),
    );
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.userData.part = part;
    group.add(mesh);
    return mesh;
  };
  add(new THREE.CapsuleGeometry(0.21, 0.43, 8, 16), 0x2d2939, [0, 1.03, 0]);
  add(new THREE.SphereGeometry(0.18, 24, 16), 0xec4c91, [0, 1.65, 0], 'head', 0x581f41);
  add(new THREE.BoxGeometry(0.25, 0.055, 0.025), 0xd4f5ff, [0, 1.67, 0.177], 'head', 0x53a3c1);
  const armor = add(new THREE.BoxGeometry(0.35, 0.33, 0.1), 0xb42a6e, [0, 1.13, 0.19]);
  armor.rotation.x = 0.05;
  add(new THREE.OctahedronGeometry(0.065), 0xffa8ce, [0, 1.14, 0.255], 'body', 0xda3a87);
  for (const side of [-1, 1]) {
    const arm = add(new THREE.CapsuleGeometry(0.075, 0.4, 6, 12), 0x69536e, [side * 0.34, 1.05, 0]);
    arm.rotation.z = side * 0.1;
    add(new THREE.SphereGeometry(0.11, 16, 10), 0xd83e83, [side * 0.31, 1.34, 0]);
    add(new THREE.CapsuleGeometry(0.075, 0.42, 6, 12), 0x4b4259, [side * 0.13, 0.37, 0]);
    add(new THREE.BoxGeometry(0.18, 0.1, 0.29), 0x252332, [side * 0.13, 0.06, 0.04]);
  }
  return group;
}

export class ArenaRenderer {
  constructor(canvas, { onAssetStatus = () => {} } = {}) {
    this.canvas = canvas;
    this.onAssetStatus = onAssetStatus;
    this.repository = new ModelRepository();
    this.loadToken = 0;
    this.mixers = [];
    this.agentTemplates = {};
    this.loadAgentTemplates();
    // desynchronized = low-latency canvas (skips the compositor queue where supported)
    const contextOptions = {
      antialias: true,
      stencil: true, // enemy silhouette outline
      alpha: false,
      desynchronized: true,
      powerPreference: 'high-performance',
    };
    const context =
      canvas.getContext('webgl2', contextOptions) || canvas.getContext('webgl2', { ...contextOptions, desynchronized: false });
    this.renderer = new THREE.WebGLRenderer({ canvas, context, ...contextOptions });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.weaponSide = 'right';
    this.frameDt = 0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x171023);
    this.scene.fog = new THREE.FogExp2(0x21152a, 0.012);
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.025, 120);
    this.camera.rotation.order = 'YXZ';
    this.scene.add(new THREE.HemisphereLight(0xe9d6ff, 0x312139, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1f8, 3);
    sun.position.set(5, 14, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, far: 65 });
    this.scene.add(sun);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      material(0x23212d, { roughness: 0.95 }),
    );
    this.arenaFloor = floor;
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(160, 80, 0xa64882, 0x61516e);
    this.arenaGrid = grid;
    grid.material.transparent = true;
    grid.material.opacity = 0.23;
    grid.position.y = 0.005;
    this.scene.add(grid);
    const wall = new THREE.Group();
    cube(wall, [50, 3.3, 0.4], [0, 1.65, -33], 0x494153);
    cube(wall, [50, 0.045, 0.1], [0, 3.34, -32.75], 0xff3e92);
    for (let x = -24; x <= 24; x += 4) cube(wall, [0.065, 3.2, 0.12], [x, 1.6, -32.7], 0x847087);
    this.arenaWall=wall;
    this.scene.add(wall);
    const stars = new THREE.BufferGeometry();
    const positions = [];
    for (let i = 0; i < 450; i++) {
      const seed = (n) => (((Math.sin(n * 132.3) * 43758.5) % 1) + 1) % 1;
      positions.push((seed(i + 1) - 0.5) * 150, 12 + seed(i + 15) * 70, -70 + seed(i + 50) * 110);
    }
    stars.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.scene.add(
      new THREE.Points(stars, new THREE.PointsMaterial({ size: 0.055, color: 0xe9c9ed })),
    );
    this.loadedMaps=new Set();
    this.havenGroup=new THREE.Group();this.scene.add(this.havenGroup);
    this.allyBots=new THREE.Group();this.scene.add(this.allyBots);
    this.tracers=[];
    this.effects = [];
    this.orbBursts = new OrbBursts(this.scene);
    this.effectSeen = new WeakSet();
    this.peekGeometry = new THREE.Group();
    this.scene.add(this.peekGeometry);
    this.courseGeometry = new THREE.Group();
    this.scene.add(this.courseGeometry);
    this.bots = new THREE.Group();
    this.scene.add(this.bots);
    this.raycaster = new THREE.Raycaster();
    this.center = new THREE.Vector2();
    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.viewCamera.rotation.order = 'YXZ';
    this.viewScene.add(new THREE.HemisphereLight(0xffffff, 0x70647e, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(1, 3, 2);
    this.viewScene.add(key);
    this.viewScene.add(new THREE.AmbientLight(0xd7c2eb, 0.35));
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new RoomEnvironment();
    this.environment = pmrem.fromScene(environment, 0.04);
    this.viewScene.environment = this.environment.texture;
    pmrem.dispose();
    environment.dispose();
    this.viewmodel = new THREE.Group();
    this.viewScene.add(this.viewmodel);
    this.muzzleLight = new THREE.PointLight(0xffd8a7, 0, 3);
    this.muzzleLight.position.set(0.1, -0.05, -0.9);
    this.viewScene.add(this.muzzleLight);
    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      if (this.lastSession) this.render(this.lastSession);
    });
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
  }
  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    setOutlineResolution(width, height);
    this.camera.aspect = width / height;
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(103) / 2) / this.camera.aspect),
    );
    this.camera.updateProjectionMatrix();
    this.viewCamera.aspect = width / height;
    // Viewmodel: 75° horizontal on 16:9, but never a narrower vertical FOV than that.
    // On wide/short windows a fixed horizontal FOV blew the gun up past the screen edge.
    const viewVertical = THREE.MathUtils.radToDeg(
      2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(VIEWMODEL_FOV) / 2) / this.viewCamera.aspect),
    );
    this.viewCamera.fov = Math.max(viewVertical, VIEWMODEL_VERTICAL);
    this.viewCamera.updateProjectionMatrix();
  }
  loadAgentTemplates() {
    for (const [role, id] of [['enemy', enemyAgentId], ['ally', allyAgentId]])
      this.repository
        .gltfFor(id)
        .then((gltf) => {
          this.agentTemplates[role] = prepareAgentTemplate(gltf, { markSilhouette: role === 'enemy' });
          this.rebuildBots = true;
        })
        .catch((error) => console.warn('Agente no disponible, se usan bots simples:', error.message));
    // Haven and Supervivencia: the attackers carry a Vandal
    this.repository
      .gltfFor('vandal')
      .then((gltf) => {
        this.agentTemplates.vandal = prepareWeaponTemplate(gltf);
        this.rebuildBots = true;
      })
      .catch(() => {});
  }
  setEnemyOutline(key) {
    setOutlineColor(key);
  }
  setWeaponSide(side) {
    this.weaponSide = side === 'left' ? 'left' : 'right';
  }
  /** 'quality' or 'performance' (lower resolution, no shadows: less GPU time per frame = less input lag). */
  setQuality(mode) {
    const fast = mode === 'performance';
    this.lowLatency = fast;
    this.renderer.setPixelRatio(fast ? 1 : Math.min(devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = !fast;
    setTargetOrbQuality(fast);
    this.scene.traverse((n) => {
      if (n.material) [].concat(n.material).forEach((m) => (m.needsUpdate = true));
    });
    this.resize();
  }
  /** Horizontal FOV in degrees, VALORANT style (103°, scoped rifles zoom 1.25x). */
  horizontalFov(session) {
    const zoom = session?.ads ? session.weapon?.ads?.zoom || 1.25 : 1;
    return THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(103) / 2) / zoom));
  }
  /** Converts an angular offset (degrees, x right / y up) to normalised device coordinates. */
  degreesToNdc(offset) {
    const h = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const w = Math.atan(Math.tan(h) * this.camera.aspect);
    return {
      x: Math.tan(THREE.MathUtils.degToRad(offset.x)) / Math.tan(w),
      y: Math.tan(THREE.MathUtils.degToRad(offset.y)) / Math.tan(h),
    };
  }
  makeBot(mode, target = {}) {
    const template = this.agentTemplates.enemy;
    let bot;
    if (target.kind === 'ability') bot = createAbilityOrb(target);
    else if (headOnlyModes.includes(mode)) bot = createTargetOrb(targetOrbRadius(mode));
    else if (!template) bot = createBot();
    else bot = createAgentBot(template, { outline: true, weapon: [11, 12].includes(mode) ? this.agentTemplates.vandal : null });
    bot.userData.kind = target.kind || 'default';
    bot.userData.ready = Boolean(template) || headOnlyModes.includes(mode) || target.kind === 'ability';
    return bot;
  }
  makeAlly() {
    const template = this.agentTemplates.ally;
    if (template) return createAgentBot(template, { outline: false, weapon: this.agentTemplates.vandal });
    const ally = createBot();
    ally.traverse((n) => {
      if (n.isMesh) {
        n.material.color.set(0x438ba3);
        n.material.emissive?.set(0x102f38);
      }
    });
    return ally;
  }
  async prepareMode(mode){
    if([11,12].includes(mode) && !this.loadedMaps.has(mode)){
      const loaded=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+(mode===12?'maps/survival/model.glb':'maps/haven-c/model.glb'));
      loaded.scene.updateMatrixWorld(true);
      const remove=[];loaded.scene.traverse(node=>{if(!node.isMesh)return;const bounds=new THREE.Box3().setFromObject(node);if(mode===11 && (bounds.max.y>24||bounds.min.y< -3||bounds.getSize(new THREE.Vector3()).length()>80))remove.push(node);else{node.userData.haven=true;node.receiveShadow=true;node.castShadow=true;}});
      remove.forEach(n=>n.removeFromParent());loaded.scene.userData.mapMode=mode;this.havenGroup.add(loaded.scene);this.loadedMaps.add(mode);
    }
    this.havenGroup.children.forEach(root=>root.visible=root.userData.mapMode===mode);
    const haven=[11,12].includes(mode);this.havenGroup.visible=haven;this.arenaFloor.visible=!haven;this.arenaGrid.visible=!haven;this.arenaWall.visible=!haven;

  }
  sync(session) {
    this.camera.position.set(session.position.x, session.position.y, session.position.z);
    this.camera.rotation.set(session.viewPitch ?? session.pitch, session.viewYaw ?? session.yaw, 0, 'YXZ');
    this.camera.fov = THREE.MathUtils.radToDeg(
      2 *
        Math.atan(
          Math.tan(THREE.MathUtils.degToRad(this.horizontalFov(session)) / 2) / this.camera.aspect,
        ),
    );
    this.camera.updateProjectionMatrix();
    if (this.targetMode !== session.mode || this.renderedCourse !== session.course) {
      this.renderedCourse = session.course;
      for(const part of [...this.peekGeometry.children]){this.peekGeometry.remove(part);this.disposeObject(part);}
      const walls = session.mode === 10 ? peekWalls : session.mode === 14 ? dynamicWalls : [];
      for(const wall of walls){
       const base = wall.y || 0;
       cube(this.peekGeometry,[wall.w,wall.h,wall.d],[wall.x,base+wall.h/2,wall.z],0x343742);
       const rim=cube(this.peekGeometry,[wall.w,.045,wall.d+.025],[wall.x,base+wall.h,wall.z],0xe75b9c);
       rim.material.emissive.set(0x7a2854);rim.material.emissiveIntensity=.45;
      }
      for (const bot of [...this.bots.children]) {
        this.bots.remove(bot);
        this.disposeObject(bot);
      }
      for (const part of [...this.courseGeometry.children]) {this.courseGeometry.remove(part);this.disposeObject(part);}
      const course = session.course;
      if (course) course.pads.forEach((pad,index)=>{
        const block=cube(this.courseGeometry,[pad.w,pad.h,pad.d],[pad.x,pad.h/2,pad.z],0x222633);
        const edge=cube(this.courseGeometry,[pad.w,.035,pad.d],[pad.x,pad.h+.018,pad.z],0xe75b9c);
        edge.userData.coursePad=index;
        edge.material.emissive.set(0x7a2854);edge.material.emissiveIntensity=.3;
        if(index>0){const marker=new THREE.Mesh(new THREE.TorusGeometry(.28,.025,8,32),material(0xf57fb1,{emissive:0x77254f,emissiveIntensity:.8}));marker.rotation.x=-Math.PI/2;marker.position.set(pad.x,pad.h+.06,pad.z);marker.userData.coursePad=index;this.courseGeometry.add(marker);}
      });
      this.targetMode = session.mode;
    }
    if (this.rebuildBots) {
      this.rebuildBots = false;
      for (const group of [this.bots, this.allyBots])
        for (const bot of [...group.children]) {
          group.remove(bot);
          this.disposeObject(bot);
        }
    }
    // replace bots whose kind changed (flash drill mixes agents, decoys and abilities)
    // or that were built before the agent model finished loading
    this.bots.children.forEach((bot, i) => {
      const t = session.targets[i];
      if (t && ((bot.userData.kind || 'default') !== (t.kind || 'default') || (!bot.userData.ready && this.agentTemplates.enemy))) {
        const next = this.makeBot(session.mode, t);
        this.bots.children[i] = next;
        next.parent = this.bots;
        this.disposeObject(bot);
        bot.parent = null;
      }
    });
    while (this.bots.children.length < session.targets.length)
      this.bots.add(this.makeBot(session.mode, session.targets[this.bots.children.length]));
    while (this.bots.children.length > session.targets.length) {
      const object = this.bots.children.at(-1);
      this.bots.remove(object);
      this.disposeObject(object);
    }
    session.targets.forEach((t, i) => {
      const bot = this.bots.children[i];
      const aim = t.yaw ?? Math.atan2(session.position.x - t.x, session.position.z - t.z) * (bot.userData.agentBot ? 1 : 0);
      const dying = this.syncDeath(bot, t, Boolean(session.spike));
      const yaw = this.displayYaw(bot, aim);
      this.animateBot(bot, t.x, t.z, yaw, dying ? 1 : t.crouch || 0);
      bot.position.set(t.x, t.y - 1.65, t.z);
      bot.rotation.y = yaw;
      if (t.tracked !== undefined)
        bot.traverse((n) => {
          if (n.isMesh && n.material?.emissive && !n.userData.hitbox)
            n.material.emissiveIntensity = t.tracked ? 1.8 : 0.5;
        });
      bot.userData.targetId = t.id;
      bot.traverse((mesh) => {
        if (mesh.isMesh) mesh.userData.targetId = t.id;
      });
    });
    // the bot partner carries a body heading; friends send their camera yaw, which looks the opposite way
    const allies=session.spike?[...(session.companion?[{...session.companion,heading:session.companion.yaw||0}]:[]),...Object.values(session.remotePlayers||{}).map(p=>({...p,heading:(p.yaw||0)+Math.PI}))].filter(p=>p.hp>0):[];
    while(this.allyBots.children.length<allies.length)this.allyBots.add(this.makeAlly());
    this.allyBots.children.forEach((bot,i)=>{bot.visible=i<allies.length;if(bot.visible){const p=allies[i];const yaw=this.displayYaw(bot,p.heading);this.animateBot(bot,p.x,p.z,yaw,0);bot.position.set(p.x,(p.y||1.65)-1.65,p.z);bot.rotation.y=yaw;}});
    this.syncDrill(session);
    this.courseGeometry.children.forEach(part=>{if(part.userData.coursePad===undefined)return;const active=part.userData.coursePad===session.courseStep+1;part.material.color.copy(this.paletteAccent || new THREE.Color(0xff4b92));part.material.emissiveIntensity=active?.8:.12;part.visible=part.geometry.type!=='TorusGeometry' || active;});
    this.scene.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
  }
  /** Flash-drill projectiles and nearsight fog. */
  syncDrill(session) {
    if (!this.drillGroup) {
      this.drillGroup = new THREE.Group();
      this.scene.add(this.drillGroup);
      this.drillGeometry = new THREE.SphereGeometry(1, 16, 10);
    }
    const visuals = session.drill?.visuals || [];
    while (this.drillGroup.children.length < visuals.length) {
      const mesh = new THREE.Mesh(
        this.drillGeometry,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.95, depthWrite: false, fog: false }),
      );
      mesh.userData.keepColors = true;
      mesh.userData.sharedAsset = true;
      mesh.raycast = () => {};
      this.drillGroup.add(mesh);
    }
    this.drillGroup.children.forEach((mesh, i) => {
      const v = visuals[i];
      mesh.visible = Boolean(v);
      if (!v) return;
      mesh.position.set(v.x, v.y, v.z);
      mesh.scale.setScalar(Math.max(0.01, v.size));
      mesh.material.color.set(v.color);
    });
    // nearsight: vision collapses to a few metres
    const near = Math.min(1, (session.drill?.nearsight || 0) / 0.5);
    if (this.baseFog === undefined) this.baseFog = this.scene.fog.density;
    this.scene.fog.density = this.baseFog + near * 0.42;
    if (near > 0 || this.nearsightTint) {
      this.paletteBg ||= this.scene.background.clone();
      const tint = this.paletteBg.clone().lerp(new THREE.Color(0x050308), near * 0.8);
      this.scene.background.copy(tint);
      this.scene.fog.color.copy(tint);
      this.nearsightTint = near > 0;
    }
  }
  /** Walk / crouch animation from the bot's movement since it was last animated. */
  animateBot(bot, x, z, yaw, crouch) {
    // hit tests also call sync(); only the render pass advances the animation
    const data = bot.userData;
    if (!data.rig || !this.inRender) return;
    data.pendingDt = (data.pendingDt || 0) + (this.frameDt || 1 / 60);
    const far = Math.hypot(x - this.camera.position.x, z - this.camera.position.z) > FAR_BOT_DISTANCE;
    if (this.lowLatency && far && data.pendingDt < 1 / FAR_BOT_RATE) return;
    const dt = data.pendingDt;
    data.pendingDt = 0;
    const prev = data.prev || { x, z };
    data.prev = { x, z };
    const vx = (x - prev.x) / dt,
      vz = (z - prev.z) / dt;
    // world velocity → bot space (x right, z forward)
    const c = Math.cos(yaw),
      s = Math.sin(yaw);
    const measured = Math.hypot(vx, vz) > TELEPORT_SPEED ? { x: 0, z: 0 } : { x: vx * c - vz * s, z: vx * s + vz * c };
    const last = data.velocity || measured;
    const k = 1 - Math.exp(-BOT_VELOCITY_SMOOTHING * dt);
    data.velocity = { x: last.x + (measured.x - last.x) * k, z: last.z + (measured.z - last.z) * k };
    animateAgent(bot, dt, data.velocity, crouch);
  }
  /** Agent bots ease toward a new heading; hit tests use the heading the player sees. */
  displayYaw(bot, target) {
    const data = bot.userData;
    if (!data.agentBot || data.yaw === undefined) return (data.yaw = target);
    if (this.inRender) data.yaw = approachAngle(data.yaw, target, BOT_TURN_RATE, this.frameDt || 1 / 60);
    return data.yaw;
  }
  /** Defence modes: a killed agent falls backwards and lies there briefly. Returns true while dying. */
  syncDeath(bot, target, defence) {
    const data = bot.userData;
    if (!target.dead || !defence || !data.rig) {
      if (!target.dead && data.dying) {
        // the slot holds a new attacker: start it fresh, standing
        Object.assign(data, { deadFor: undefined, yaw: undefined, prev: undefined, velocity: undefined });
        bot.rotation.x = 0;
        setAgentOutline(bot, true);
      }
      data.dying = false;
      bot.visible = !target.dead;
      return false;
    }
    if (data.deadFor === undefined) setAgentOutline(bot, false);
    if (this.inRender) data.deadFor = (data.deadFor || 0) + (this.frameDt || 1 / 60);
    const fall = Math.min(1, (data.deadFor || 0) / DEATH_FALL);
    bot.rotation.x = -DEATH_TILT * fall * fall; // speeds up like a real fall
    data.dying = true;
    bot.visible = (data.deadFor || 0) < DEATH_FALL + BODY_LINGER;
    return true;
  }
  cast(offset = { x: 0, y: 0 }) {
    if (offset.degrees) offset = this.degreesToNdc(offset);
    this.raycaster.setFromCamera(this.center.set(offset.x, offset.y), this.camera);
    const hit = this.raycaster.intersectObjects(
      this.bots.children.filter((b) => b.visible && !b.userData.dying),
      true,
    )[0];
    const covers=this.lastSession?.spike?this.havenGroup.children.filter(n=>n.visible):this.peekGeometry.children;
    const cover = this.raycaster.intersectObjects(covers,true)[0];
    if(hit && cover && cover.distance < hit.distance)return null;
    return hit
      ? { id: hit.object.userData.targetId, part: hit.object.userData.part || 'body' }
      : null;
  }
  castFromPose(pose){
    const position=this.camera.position.clone(),quaternion=this.camera.quaternion.clone();
    try{this.camera.position.set(pose.x,pose.y||1.65,pose.z);this.camera.rotation.set(pose.pitch,pose.yaw,0,'YXZ');this.camera.updateMatrixWorld(true);return this.cast();}
    finally{this.camera.position.copy(position);this.camera.quaternion.copy(quaternion);this.camera.updateMatrixWorld(true);}
  }
  async equip(id, finish = 'original') {
    const token = ++this.loadToken;
    this.onAssetStatus('Cargando modelo 3D…');
    try {
      const [weapon, arms] = await Promise.all([
        this.repository.load(id),
        id === 'karambit' ? Promise.resolve({object:new THREE.Group(),mixer:new THREE.AnimationMixer(new THREE.Group())}) : this.repository.load(this.agentId || 'fpshands'),
      ]);
      if (token !== this.loadToken) return;
      if (this.weaponModel)
        this.weaponModel.object.traverse((n) => {
          if (n.isMesh && n.geometry.userData.viewModelBaked) n.geometry.dispose();
          if (n.isMesh)
            (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose());
        });
      if (this.armsModel)
        this.armsModel.object.traverse((n) => {
          if (n.isMesh) n.geometry.dispose();
        });
      this.mixers.forEach((m) => m.stopAllAction());
      this.viewmodel.clear();
      this.mixers = [weapon.mixer, arms.mixer];
      this.weaponModel = weapon;
      this.armsModel = arms;
      applyFinish(weapon.object, finish);
      this.viewmodel.add(weapon.object, arms.object);
      arms.object.userData.fitToWeapon?.(weapon.object, id);
      this.onAssetStatus('');
      this.activeWeapon = id;
    } catch (error) {
      if (token === this.loadToken) {
        this.onAssetStatus('No se pudo cargar el modelo: ' + error.message);
        throw error;
      }
    }
  }
  render(session, dt = 0) {
    const palette = document.body.dataset.palette;
    if (this.currentPalette !== palette) {
      this.currentPalette = palette;
      const style = getComputedStyle(document.body);
      this.scene.background.set(style.getPropertyValue('--arena-bg').trim() || '#566779');
      this.scene.fog.color.copy(this.scene.background);
      this.paletteBg = this.scene.background.clone();
      this.paletteAccent = new THREE.Color(
        style.getPropertyValue('--palette-accent').trim() || '#62b1ff',
      );
      setTargetOrbColor(this.paletteAccent);
      const gridColors = this.arenaGrid.geometry.getAttribute('color');
      const gridColor = this.paletteAccent.clone().lerp(new THREE.Color('#8d9ba8'), 0.65);
      for (let i = 0; i < gridColors.count; i++)
        gridColors.setXYZ(i, gridColor.r, gridColor.g, gridColor.b);
      gridColors.needsUpdate = true;
      this.arenaFloor.material.color.set(
        style.getPropertyValue('--arena-floor').trim() || '#465665',
      );
    }
    this.lastSession = session;
    this.frameDt = dt || this.frameDt;
    this.inRender = true;
    this.sync(session);
    this.inRender = false;
    if (this.paletteAccent)
      this.scene.traverse((node) => {
        if (node.userData.haven || node.userData.keepColors || !node.material || node === this.arenaFloor || node === this.arenaGrid) return;
        for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
          if (mat.userData.appliedPalette === this.currentPalette) continue;
          for (const key of ['color', 'emissive']) {
            if (!mat[key]) continue;
            const savedKey = 'paletteOriginal' + key;
            if (!mat.userData[savedKey]) mat.userData[savedKey] = mat[key].clone();
            const original = mat.userData[savedKey];
            const hsl = {};
            original.getHSL(hsl);
            if (hsl.h > 0.65 && hsl.s > 0.06) {
              const accentHsl = {};
              this.paletteAccent.getHSL(accentHsl);
              mat[key].setHSL(accentHsl.h, Math.min(hsl.s, accentHsl.s + 0.12), hsl.l);
            }
          }
          mat.userData.appliedPalette = this.currentPalette;
        }
      });
    for (const event of session.events) {
      if (this.effectSeen.has(event)) continue;
      this.effectSeen.add(event);
      if (event.type === 'impact') {
        const struck = this.bots.children.find((bot) => bot.userData.targetId === event.id);
        if (struck) flinchAgent(struck, Math.random() < 0.5 ? -1 : 1);
      }
      if(['enemy-shot','ally-shot'].includes(event.type)){
        const geometry=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(event.x,event.y,event.z),new THREE.Vector3(event.to.x,event.to.y,event.to.z)]);
        const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:event.type==='enemy-shot'?0xffab72:0x74dbc7,transparent:true,opacity:.6}));
        this.scene.add(line);this.tracers.push({line,life:.09});
      }
      if (event.type === 'kill' && headOnlyModes.includes(session.mode)) {
        this.orbBursts.spawn(event, targetOrbRadius(session.mode));
      } else if (event.type === 'kill') {
        const group = new THREE.Group();
        group.position.set(event.x, event.y, event.z);
        for (let i = 0; i < 9; i++) {
          const bit = cube(
            group,
            [0.06, 0.06, 0.06],
            [0, 0, 0],
            event.part === 'head' ? 0xffd8a4 : 0xff529d,
          );
          bit.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2,
          );
        }
        this.scene.add(group);
        this.effects.push({ group, life: 0.45 });
      }
    }
    this.orbBursts.update(dt);
    animateTargetOrbs(performance.now() / 1000, session.targets.some((t) => t.tracked));
    this.tracers=this.tracers.filter(item=>{item.life-=dt;if(item.life>0)return true;this.scene.remove(item.line);item.line.geometry.dispose();item.line.material.dispose();return false;});
    for (const effect of this.effects) {
      effect.life -= dt;
      effect.group.children.forEach((bit) => {
        bit.position.addScaledVector(bit.userData.velocity, dt);
        bit.scale.setScalar(Math.max(0, effect.life / 0.45));
      });
    }
    this.effects = this.effects.filter((effect) => {
      if (effect.life > 0) return true;
      this.scene.remove(effect.group);
      this.disposeObject(effect.group);
      return false;
    });
    const dip =
      session.reloadLeft > 0
        ? Math.sin((session.reloadLeft / session.weapon.reload) * Math.PI) * 0.25
        : 0;
    const side = this.weaponSide === 'left' ? -1 : 1;
    const rest = session.weaponId === 'karambit' ? KNIFE_REST_OFFSET : VIEWMODEL_REST_OFFSET;
    this.viewmodel.scale.x = side;
    this.viewmodel.position.set(
      side * ((session.ads ? VIEWMODEL_ADS_SHIFT : 0) + rest.x),
      rest.y + Math.sin(session.bob) * Math.min(0.003, session.moveSpeed * 0.001) - dip,
      rest.z - session.recoil * 0.025,
    );
    this.viewmodel.rotation.x = session.recoil * 0.04;
    this.viewmodel.rotation.z = side * session.recoil * 0.018;
    this.muzzleLight.intensity = session.flash > 0 ? 5 : 0;
    this.mixers.forEach((m) => m.update(dt));
    this.renderer.autoClear = true;
    this.renderer.render(this.scene, this.camera);
    this.renderer.autoClear = false;
    this.renderer.clearDepth();
    this.renderer.render(this.viewScene, this.viewCamera);
  }
  disposeObject(root) {
    root.traverse((o) => {
      if (o.isMesh && !o.userData.sharedAsset) {
        o.geometry.dispose();
        if (o.userData.hitbox) return;
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      }
    });
  }
  dispose() {
    this.loadToken++;
    this.resizeObserver.disconnect();
    this.repository.dispose();
    this.disposeObject(this.scene);
    this.environment.dispose();
    this.renderer.dispose();
  }
}
