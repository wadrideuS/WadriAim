import {resetSpike,tickSpike,damageSpikeBot,moveHaven} from './SpikeDefense.js';
import {spawnPeek,tickPeek} from './peek-arena.js';
import { resetFlashDrill, tickFlashDrill, flashDrillHit } from './flash-drill.js';
import { spawnDynamic, tickDynamic } from './dynamic-arena.js';
import {resetCourse,tickCourse,requestCourseJump} from './movement-courses.js';
import { arsenal, weaponDamage, AGENT_HP, headOnlyModes } from '../data/weapons.js';
import { exercises } from '../data/exercises.js';
import { trainingRules } from '../data/training-rules.js';
import { MAX_LOGGED_SHOTS, medianKillMs, shotOffset } from './round-log.js';

/** Deterministic training rules. Rendering and browser APIs stay outside this class. */
export class TrainingSession {
  constructor({ random = Math.random, hitTest = () => null } = {}) {
    this.random = random;
    this.hitTest = hitTest;
    /** chosen before each mode: reloadable or infinite ammo, timed or endless round */
    this.trainingOptions = { ammo: 'reload', timed: true };
    this.reset(0, 'vandal');
  }
  reset(mode, weaponId) {
    this.mode = mode;
    this.weaponId = [7,8,9].includes(mode) ? 'karambit' : arsenal[weaponId] && weaponId !== 'karambit' ? weaponId : 'vandal';
    this.status = 'ready';
    const endless = this.trainingOptions?.timed === false && ![11].includes(mode);
    this.duration = endless ? Infinity : trainingRules[mode].duration || 60;
    this.remaining = this.duration;
    this.score = 0;
    this.elapsed = 0;
    this.totalElapsed = 0;
    this.hits = 0;
    this.headshots = 0;
    this.shots = 0;
    this.expired = 0;
    this.trackTime = 0;
    this.ammo = this.weapon.mag;
    this.reloadLeft = 0;
    this.cooldown = 0;
    this.recoil = 0;
    this.flash = 0;
    this.hitmarker = 0;
    this.burst = 0;
    this.sprayIndex = 0;
    this.lastShotAt = -Infinity;
    this.punch = { x: 0, y: 0 };
    this.lastSpread = 0;
    this.trackTick = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.ads = false;
    this.position = { x: 0, y: this.mode === 6 ? 1.05 + this.random() * 1.9 : 1.65, z: 2 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.jumpHeight = 0;
    this.crouch = 0;
    this.moveSpeed = 0;
    this.bob = 0;
    this.wave = 1;
    this.combo = 0;
    this.events = [];
    this.shotLog = [];
    this.lastKillAt = -Infinity;
    this.feedback = null;
    this.waveReset = 0;
    this.spawnSerial = 0;
    this.spike=null;this.health=null;this.companion=null;this.remotePlayer=null;
    resetCourse(this);
    this.targets = [];
    for (let id = 0; id < trainingRules[mode].count; id++) this.targets.push(this.spawn(id));
    if(mode===10)this.targets.forEach((t,i)=>{t.dead=true;t.respawnAt=.8+i*1.15;});
    if(mode===11 || mode===12)resetSpike(this,this.spikeOptions);
    this.drill = null;
    if (mode === 13) resetFlashDrill(this);
  }
  get weapon() {
    return arsenal[this.weaponId];
  }
  get infiniteAmmo() {
    return this.mode === 6 || this.trainingOptions?.ammo === 'infinite';
  }
  /** Camera pitch/yaw including the recoil view punch (radians). */
  get viewPitch() {
    return this.pitch + (this.punch.y * Math.PI) / 180;
  }
  get viewYaw() {
    return this.yaw - (this.punch.x * Math.PI) / 180;
  }
  withHealth(target) {
    if (!headOnlyModes.includes(this.mode) && target.hp === 1) target.hp = target.maxHp = AGENT_HP;
    return target;
  }
  spawn(id) {
    return this.withHealth(this.spawnRaw(id));
  }
  spawnRaw(id) {
    if(this.mode===10)return spawnPeek(id,this.elapsed,this.random,this.targets);
    if (this.mode === 14) return spawnDynamic(id, this);
    const rule = trainingRules[this.mode],
      others = (this.targets || []).filter((t) => t.id !== id && !t.dead),
      previous = (this.targets || []).find((t) => t.id === id);
    let x = 0,
      z = -rule.depth;
    const previousLane = previous?.lane;
    let lane = id % rule.lanes.length;
    if (rule.count === 1 && rule.lanes.length > 1) {
      lane = this.spawnSerial++ % rule.lanes.length;
      if (lane === previousLane) lane = (lane + 1) % rule.lanes.length;
    }
    for (let attempt = 0; attempt < 40; attempt++) {
      x = rule.lanes[lane] + (this.random() - 0.5) * rule.jitter * 2;
      z = -rule.depth - (this.mode === 1 ? this.random() * 4 : 0);
      if (
        others.every((t) => Math.abs(Math.atan2(t.x, -t.z) - Math.atan2(x, -z)) > rule.minimumAngle)
      )
        break;
      lane = (lane + 1) % rule.lanes.length;
    }
    return {
      id,
      lane,
      x,
      z,
      y: this.mode === 6 ? 1.05 + this.random() * 1.9 : 1.65,
      velocity: (this.random() > 0.5 ? 1 : -1) * (this.mode === 2 ? 2 : 1.3),
      hp: 1,
      born: this.elapsed,
      dead: false,
      respawnAt: 0,
      generation: (previous?.generation || 0) + 1,
    };
  }
  emit(type, details = {}) {
    this.events.push({ type, time: this.elapsed, ...details });
    if (this.events.length > 100) this.events.shift();
  }
  eliminate(target, part) {
    target.dead = true;
    target.hp = 0;
    target.respawnAt = this.elapsed + trainingRules[this.mode].respawn;
    this.hits++;
    if (part === 'head') this.headshots++;
    this.combo++;
    if (this.mode === 6)
      this.score +=
        100 +
        Math.min(20, this.combo) * 10 +
        Math.max(0, Math.round((0.65 - (this.elapsed - target.born)) * 100));
    this.feedback = {
      text: part === 'head' ? '' : 'OBJETIVO ELIMINADO',
      until: this.elapsed + 0.65,
    };
    this.emit('kill', {
      combo: this.combo,
      killCount: this.hits,
      id: target.id,
      part,
      x: target.x,
      y: part === 'head' ? target.y : target.y-.65,
      z: target.z,
    });
  }
  chooseWeapon(id) {
    if (this.status === 'running' || !arsenal[id] || this.course || id === 'karambit') return;
    this.weaponId = id;
    this.ammo = this.weapon.mag;
    this.reloadLeft = 0;
    this.sprayIndex = 0;
    this.punch = { x: 0, y: 0 };
    // switching mid-round costs the equip time, like in game
    this.cooldown = this.status === 'paused' ? this.weapon.equip || 1 : 0;
  }
  start() {
    if (this.status === 'finished') this.reset(this.mode, this.weaponId);
    this.status = 'running';
  }
  pause() {
    if (this.status === 'running') this.status = 'paused';
  }
  look(dx, dy, sensitivity) {
    if (this.status !== 'running') return;
    const factor = (sensitivity * 0.07 * Math.PI) / 180;
    this.yaw -= dx * factor;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * factor));
  }
  jump() {
    if (this.course) { if(this.status==='running') requestCourseJump(this); return; }
    if (this.status === 'running' && (this.course ? this.onGround : this.jumpHeight === 0)) {this.velocity.y=5.5;this.onGround=false;this.jumps++;}
  }
  reload() {
    if (this.status !== 'running' || this.reloadLeft > 0 || this.ammo === this.weapon.mag || this.infiniteAmmo) return;
    this.reloadLeft = this.weapon.reload;
    this.burst = 0;
  }
  shoot() {
    if (this.status !== 'running' || this.cooldown > 0 || this.reloadLeft > 0 || this.mode === 2 || this.course || ([11,12].includes(this.mode) && this.health<=0))
      return false;
    if (this.ammo <= 0) {
      this.reload();
      return false;
    }
    this.shots++;
    if (!this.infiniteAmmo) this.ammo--;
    const w = this.weapon;
    const adsRate = this.ads && w.ads ? w.ads.rate : 1;
    this.cooldown = 1 / (w.rate * adsRate);
    this.recoil = w.kick;
    this.flash = 0.055;
    // spray pattern: continues while firing, resets after the recovery time
    if (this.elapsed - this.lastShotAt > (w.recovery || 0.4)) this.sprayIndex = 0;
    const pattern = w.spray || [[0, 0]];
    let [sprayX, sprayY] = pattern[Math.min(this.sprayIndex, pattern.length - 1)];
    if (this.sprayIndex >= pattern.length) sprayX += Math.sin(this.sprayIndex * 1.7) * 0.6;
    // first-shot spread + bloom + movement inaccuracy (degrees)
    const first = w.spread ? w.spread[this.ads ? 1 : 0] : 0;
    const bloom = Math.min(w.maxBloom || 0, (w.bloom || 0) * this.sprayIndex);
    const move = w.move || { walk: 0, run: 0, air: 0 };
    const moving =
      this.jumpHeight > 0.03
        ? move.air
        : this.moveSpeed > w.speed * 0.6
          ? move.run
          : this.moveSpeed > 0.8
            ? move.walk
            : 0;
    const spread = first + bloom + moving;
    this.lastSpread = spread;
    const radius = spread * Math.sqrt(this.random()),
      angle = this.random() * Math.PI * 2;
    // the camera already shows `viewKick` of the pattern; the bullet carries the rest
    const kick = w.viewKick || 0;
    const aim = {
      x: sprayX - this.punch.x + Math.cos(angle) * radius,
      y: sprayY - this.punch.y + Math.sin(angle) * radius,
      degrees: true,
    };
    const hit = this.hitTest(aim);
    const struck = hit ? this.targets.find((t) => t.id === hit.id && !t.dead) : null;
    const offset = shotOffset(
      { position: this.position, yaw: this.viewYaw, pitch: this.viewPitch },
      struck,
      this.targets,
      aim,
    );
    const hitsBefore = this.hits;
    this.punch.x = sprayX * kick;
    this.punch.y = sprayY * kick;
    this.sprayIndex++;
    this.lastShotAt = this.elapsed;
    this.burst = Math.min(9, this.burst + 1);
    if (hit && !([11,12].includes(this.mode) && this.networkRole==='guest')) {
      const target = struck;
      if (target) {
        this.hitmarker = 0.14;
        const distance = Math.hypot(target.x - this.position.x, target.z - this.position.z);
        const damage = weaponDamage(w, hit.part, distance);
        if (this.mode === 3 && hit.part !== 'head') {
          this.feedback = { text: 'APUNTA A LA CABEZA', until: this.elapsed + 0.55 };
          this.emit('body-blocked');
        } else if (this.mode === 13) flashDrillHit(this, target, hit.part, damage);
        else if([11,12].includes(this.mode)){damageSpikeBot(this,target,hit.part,damage);}
        else if (headOnlyModes.includes(this.mode) || !target.maxHp) this.eliminate(target, hit.part);
        else {
          target.hp = Math.max(0, target.hp - damage);
          target.hurtAt = this.elapsed;
          if (target.hp === 0) this.eliminate(target, hit.part);
          else this.emit('impact', { id: target.id, part: hit.part, damage });
        }
      }
    } else this.combo = 0;
    this.logShot(struck, hit?.part, offset, this.hits > hitsBefore);
    if (this.ammo === 0) this.reload();
    return true;
  }
  /** One small entry per shot for the round summary; never read during play. */
  logShot(target, part, offset, killed) {
    if (this.shotLog.length >= MAX_LOGGED_SHOTS) return;
    const shot = {
      t: Math.round(this.elapsed * 100) / 100,
      result: killed ? 'kill' : target ? 'impact' : 'miss',
      head: Boolean(target) && part === 'head',
      ...offset,
    };
    if (killed) {
      const since = Math.max(target.born ?? this.elapsed, this.lastKillAt);
      shot.ms = Math.round((this.elapsed - since) * 1000);
      this.lastKillAt = this.elapsed;
    }
    this.shotLog.push(shot);
  }
  tick(dt, { keys = new Set(), fire = false, ads = false } = {}) {
    if (this.status !== 'running') return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.elapsed += dt;
    this.totalElapsed += dt;
    this.remaining = Math.max(0, this.duration - this.elapsed);
    if (this.course) {tickCourse(this,dt,keys);return;}
    this.ads = ads && Boolean(this.weapon.ads);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 7);
    // the view punch drifts back down once you stop shooting
    const settle = this.elapsed - this.lastShotAt > 1 / this.weapon.rate + 0.03 ? 1 - Math.exp(-dt * 9) : 0;
    this.punch.x -= this.punch.x * settle;
    this.punch.y -= this.punch.y * settle;
    this.flash = Math.max(0, this.flash - dt);
    this.hitmarker = Math.max(0, this.hitmarker - dt);
    if (this.reloadLeft > 0) {
      this.reloadLeft = Math.max(0, this.reloadLeft - dt);
      if (this.reloadLeft === 0) this.ammo = this.weapon.mag;
    }
    if (!fire) this.burst = Math.max(0, this.burst - dt * 13);
    const forward =
      Number(keys.has('w') || keys.has('ArrowUp')) - Number(keys.has('s') || keys.has('ArrowDown'));
    const side =
      Number(keys.has('d') || keys.has('ArrowRight')) -
      Number(keys.has('a') || keys.has('ArrowLeft'));
    const norm = Math.max(1, Math.hypot(forward, side));
    const speed =
      this.weapon.speed *
      (keys.has('Shift') ? 0.52 : 1) *
      (keys.has('Control') ? 0.47 : 1) *
      (this.ads ? this.weapon.ads.move : 1);
    const dx = ((-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * side) / norm) * speed;
    const dz = ((-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * side) / norm) * speed;
    const response = 1 - Math.exp(-(this.jumpHeight > 0 ? 4 : 24) * dt);
    this.velocity.x += (dx - this.velocity.x) * response;
    this.velocity.z += (dz - this.velocity.z) * response;
    this.moveSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if([11,12].includes(this.mode))this.navigation.move(this.position,this.velocity.x*dt,this.velocity.z*dt);
    else{
      this.position.x = Math.max(-12, Math.min(12, this.position.x + this.velocity.x * dt));
      this.position.z = Math.max(-7, Math.min(5, this.position.z + this.velocity.z * dt));
    }
    this.velocity.y -= 16 * dt;
    this.jumpHeight = Math.max(0, this.jumpHeight + this.velocity.y * dt);
    if (this.jumpHeight === 0) this.velocity.y = 0;
    this.crouch += ((keys.has('Control') ? 1 : 0) - this.crouch) * (1 - Math.exp(-14 * dt));
    this.position.y = 1.65 - this.crouch * 0.55 + this.jumpHeight;
    this.bob += this.moveSpeed * dt * 1.6;
    if(this.mode===10){this.position.x=Math.max(-3,Math.min(3,this.position.x));this.position.z=Math.max(0,Math.min(5,this.position.z));}
    const rule = trainingRules[this.mode];
    if (this.mode === 5 && this.targets.every((t) => t.dead) && !this.waveReset) {
      this.waveReset = this.elapsed + 0.85;
      this.feedback = { text: 'OLEADA COMPLETADA', until: this.elapsed + 0.85 };
    }
    if (this.waveReset && this.elapsed >= this.waveReset) {
      this.wave++;
      this.waveReset = 0;
      this.targets = [];
      for (let id = 0; id < rule.count; id++) this.targets.push(this.spawn(id));
    }
    if(this.mode===10)tickPeek(this,dt);
    if (this.mode === 13) tickFlashDrill(this, dt);
    if (this.mode === 14) tickDynamic(this, dt, (id) => this.spawn(id));
    this.targets.forEach((t, i) => {
      if(this.mode===10 || [11,12,13,14].includes(this.mode))return;
      if (t.dead) {
        if (this.mode !== 5 && this.elapsed >= t.respawnAt) this.targets[i] = this.spawn(t.id);
        return;
      }
      if (this.mode === 2) {
        t.x = Math.sin(this.elapsed * 0.65) * 6;
        t.y = 1.65 + Math.sin(this.elapsed * 0.8) * 0.5;
      }
      if (this.mode === 5) {
        t.x = rule.lanes[t.lane] + Math.sin(this.elapsed * 1.8 + t.id) * 0.65;
      }
      if ([4, 6].includes(this.mode) && this.elapsed - t.born > rule.lifetime) {
        t.dead = true;
        t.respawnAt = this.elapsed + rule.respawn;
        this.expired++;
        this.combo = 0;
        this.feedback = { text: 'DEMASIADO TARDE', until: this.elapsed + 0.4 };
        this.emit('expired', { id: t.id });
      }
    });
    if (fire && this.weapon.auto && this.mode !== 2) this.shoot();
    if (this.mode === 2) {
      const onTarget = fire && this.hitTest({ x: 0, y: 0, degrees: true });
      this.tracking = Boolean(onTarget);
      for (const t of this.targets) t.tracked = this.tracking;
      if (onTarget) {
        this.trackTime += dt;
        this.hits = Math.round(this.trackTime * 100);
        this.hitmarker = 0.06;
        this.trackTick -= dt;
        if (this.trackTick <= 0) {
          this.trackTick = 0.09;
          this.emit('track-hit');
        }
      } else this.trackTick = 0;
    }
    if([11,12].includes(this.mode))tickSpike(this,dt);
    else if (this.remaining === 0) this.status = 'finished';
  }
  result() {
    return {
      name: exercises[this.mode][0],
      defenseOutcome: this.spike?.outcome,
      difficulty: this.spike?.difficulty,
      partner: this.spike?.partner,
      health: this.health,
      survivalWave: this.spike?.survival?this.spike.wave:null,
      mode: this.mode,
      headshots: this.headshots,
      lives: this.lives,
      courseOutcome: this.courseOutcome,
      completedCourses: this.completedCourses,
      courseLevel: this.courseLevel,
      bestBunnyChain: this.bestBunnyChain,
      falls: this.falls,
      jumps: this.jumps,
      weapon: this.weaponId,
      date: Date.now(),
      hits: this.hits,
      score: this.score,
      duration: Number.isFinite(this.duration) ? this.duration : Math.round(this.totalElapsed),
      endless: !Number.isFinite(this.duration) && ![11, 12].includes(this.mode),
      ammoMode: this.infiniteAmmo ? 'infinite' : 'reload',
      activeDuration: this.totalElapsed,
      shots: this.shots,
      targetMs: medianKillMs(this.shotLog),
      expired: this.expired,
      accuracy:
        this.mode === 2
          ? Math.round((this.trackTime / Math.max(1, Math.min(this.totalElapsed, this.duration))) * 100)
          : Math.round((this.hits / Math.max(this.shots, 1)) * 100),
    };
  }
}
