/**
 * Flash-dodge drill. Every blind/nearsight ability in the game, each with its own
 * delivery and counter-play. Timings are approximations of the live values.
 *
 * kind: 'flash' (white-out, depends on where you look when it pops) or
 *       'nearsight' (vision shrinks to a few metres; dodged by moving or shooting it).
 * counter: what the player has to do — 'turn', 'move', 'shoot' or 'hold' (don't shoot).
 */
import { AGENT_HP } from '../data/weapons.js';

export const flashAbilities = [
  { id: 'curveball', agent: 'Phoenix', name: 'Curveball', kind: 'flash', windup: 0.6, blind: 1.1, color: 0xff9a3c, counter: 'turn',
    hint: 'Gira la cara: dobla la esquina y explota casi al instante.' },
  { id: 'guiding-light', agent: 'Skye', name: 'Guiding Light', kind: 'flash', windup: 1.4, blind: 2.0, color: 0x7dff9a, counter: 'turn',
    hint: 'El halcón vuela hacia ti: date la vuelta antes de que lo reactiven.' },
  { id: 'flashpoint', agent: 'Breach', name: 'Flashpoint', kind: 'flash', windup: 0.5, blind: 2.0, color: 0xffb347, counter: 'turn',
    hint: 'Atraviesa la pared. Escucha el aviso y gira enseguida.' },
  { id: 'flash-drive', agent: 'KAY/O', name: 'FLASH/drive', kind: 'flash', windup: 1.6, blind: 2.0, color: 0x6fd3ff, counter: 'turn',
    hint: 'Granada en arco con mecha larga: tienes tiempo, no la mires.' },
  { id: 'blindside', agent: 'Yoru', name: 'Blindside', kind: 'flash', windup: 0.9, blind: 1.75, color: 0x5b7dff, counter: 'turn',
    hint: 'Rebota en una pared y vuelve hacia ti. Atento al rebote.' },
  { id: 'arc-rose', agent: 'Vyse', name: 'Arc Rose', kind: 'flash', windup: 0.5, blind: 1.75, color: 0xd977ff, counter: 'turn',
    hint: 'Está fija en una superficie: al oír el aviso, gira.' },
  { id: 'fakeout', agent: 'Yoru', name: 'Fakeout', kind: 'flash', windup: 0.25, blind: 1.5, color: 0x5b7dff, counter: 'hold', life: 3.2,
    hint: 'Señuelo: si le disparas, te ciega. Déjalo pasar.' },
  { id: 'leer', agent: 'Reyna', name: 'Leer', kind: 'nearsight', windup: 0.6, blind: 2.0, color: 0xc06bff, counter: 'shoot', life: 2.6,
    hint: 'El ojo te ciega mientras lo miras. Dispárale o no lo mires.' },
  { id: 'paranoia', agent: 'Omen', name: 'Paranoia', kind: 'nearsight', windup: 0.3, blind: 2.0, color: 0x6b5bff, counter: 'move', speed: 11,
    hint: 'Viaja en línea recta y atraviesa paredes: sal de su trayectoria.' },
  { id: 'dizzy', agent: 'Gekko', name: 'Dizzy', kind: 'nearsight', windup: 1.0, blind: 2.0, color: 0xb6ff3c, counter: 'shoot', life: 2.2,
    hint: 'Flota y escupe plasma. Destrúyelo o esquiva los disparos.' },
  { id: 'prowler', agent: 'Fade', name: 'Prowler', kind: 'nearsight', windup: 0.4, blind: 2.5, color: 0x5ae0c8, counter: 'shoot', speed: 4.5, life: 4,
    hint: 'Te persigue por el suelo: dispárale antes de que te alcance.' },
];

const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

export function resetFlashDrill(s) {
  s.drill = {
    next: 1.6,
    active: [],
    visuals: [],
    blind: 0,
    blindTotal: 1,
    nearsight: 0,
    callout: null,
    dodged: 0,
    flashed: 0,
    destroyed: 0,
    order: [],
  };
  s.targets = [];
}

/** View direction and angle (degrees) between where you look and a point. */
function lookAngle(s, p) {
  const dx = p.x - s.position.x, dy = p.y - s.position.y, dz = p.z - s.position.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  const cp = Math.cos(s.pitch);
  const fx = -Math.sin(s.yaw) * cp, fy = Math.sin(s.pitch), fz = -Math.cos(s.yaw) * cp;
  return (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy + dz * fz) / len))) * 180) / Math.PI;
}

/** Point in front of the base direction (yaw 0 = -Z), at an angle (deg) and distance. */
function around(s, angleDeg, distance, y) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: s.position.x + Math.sin(a) * distance, y, z: s.position.z - Math.cos(a) * distance };
}

function blindPlayer(s, ability, strength) {
  const duration = ability.blind * strength;
  if (ability.kind === 'nearsight') {
    s.drill.nearsight = Math.max(s.drill.nearsight, duration);
  } else if (duration > 0.05) {
    s.drill.blind = Math.max(s.drill.blind, duration);
    s.drill.blindTotal = Math.max(s.drill.blind, 0.4);
  }
  if (duration >= 0.35) {
    s.drill.flashed++;
    s.combo = 0;
    s.feedback = { text: (ability.kind === 'nearsight' ? 'MIOPÍA · ' : 'CEGADO · ') + ability.name.toUpperCase(), until: s.elapsed + 0.9 };
  } else {
    s.drill.dodged++;
    s.score += 100;
    s.feedback = { text: 'ESQUIVADA +100', until: s.elapsed + 0.7 };
  }
}

/** After every ability an enemy swings, like a real flash + peek. */
function swingPeek(s, side) {
  const id = 100 + (s.drill.peekSerial = (s.drill.peekSerial || 0) + 1);
  const p = around(s, side * (15 + s.random() * 35), 11 + s.random() * 5, 1.65);
  s.targets.push({ id, kind: 'agent', x: p.x, y: 1.65, z: p.z, vx: -side * 2.2, hp: AGENT_HP, maxHp: AGENT_HP, born: s.elapsed, life: 1.9, dead: false });
}

function launch(s) {
  const d = s.drill;
  if (!d.order.length) d.order = flashAbilities.map((a) => a.id).sort(() => s.random() - 0.5);
  const ability = flashAbilities.find((a) => a.id === d.order.pop());
  const side = s.random() < 0.5 ? -1 : 1;
  const a = { ability, side, born: s.elapsed, popAt: s.elapsed + ability.windup, popped: false };
  const id = 200 + (d.serial = (d.serial || 0) + 1);
  switch (ability.id) {
    case 'curveball': // comes out from behind a corner and curves in front of you
      a.from = around(s, side * 75, 7, 1.6);
      a.to = around(s, side * 12, 4.5, 2.6);
      a.curve = around(s, side * 35, 7.5, 2.4);
      break;
    case 'guiding-light':
      a.from = around(s, side * 25, 22, 2.4);
      a.to = around(s, side * 8, 4.5, 2.2);
      break;
    case 'flashpoint': // pops right out of the wall in front
      a.from = around(s, side * 10, 9, 1.4);
      a.to = around(s, side * 8, 6.5, 2.6);
      break;
    case 'flash-drive': // arcing grenade
      a.from = around(s, side * 20, 17, 1.6);
      a.to = around(s, side * 6, 5, 0.3);
      a.arc = 4;
      break;
    case 'blindside': // goes to a side wall, bounces back toward you
      a.from = around(s, side * 30, 16, 1.6);
      a.curve = around(s, side * 70, 9, 2);
      a.to = around(s, side * 15, 4, 2.2);
      break;
    case 'arc-rose':
      a.from = a.to = around(s, side * 22, 8, 2.8);
      break;
    case 'fakeout': { // decoy agent walking toward you; shooting it triggers the flash
      const p = around(s, side * 18, 12, 1.65);
      a.targetId = id;
      a.dieAt = s.elapsed + ability.life;
      s.targets.push({ id, kind: 'decoy', abilityId: ability.id, x: p.x, y: 1.65, z: p.z, vx: -side * 1.4, vz: 1.2, hp: 1, born: s.elapsed, dead: false });
      break;
    }
    case 'leer': { // floating eye, blinds while you look at it
      const p = around(s, side * 14, 9, 2.7);
      a.targetId = id;
      a.at = p;
      a.dieAt = a.popAt + ability.life;
      s.targets.push({ id, kind: 'ability', abilityId: ability.id, x: p.x, y: p.y, z: p.z, hp: 1, born: s.elapsed, dead: false, color: ability.color, size: 0.22 });
      break;
    }
    case 'paranoia': { // straight line through you: step aside
      a.from = around(s, side * 8, 26, 1.5);
      const dx = s.position.x - a.from.x, dz = s.position.z - a.from.z, len = Math.hypot(dx, dz);
      a.dir = { x: dx / len, z: dz / len };
      a.pos = { ...a.from };
      a.dieAt = s.elapsed + ability.windup + 40 / ability.speed;
      break;
    }
    case 'dizzy': { // flies in, hovers, spits three plasma balls at you
      const p = around(s, side * 12, 10, 2.8);
      a.targetId = id;
      a.at = p;
      a.dieAt = a.popAt + ability.life;
      a.shots = [];
      a.nextShot = a.popAt;
      s.targets.push({ id, kind: 'ability', abilityId: ability.id, x: p.x, y: p.y, z: p.z, hp: 1, born: s.elapsed, dead: false, color: ability.color, size: 0.3 });
      break;
    }
    case 'prowler': { // runs along the floor toward you
      const p = around(s, side * 20, 14, 0.45);
      a.targetId = id;
      a.dieAt = s.elapsed + ability.life;
      s.targets.push({ id, kind: 'ability', abilityId: ability.id, x: p.x, y: p.y, z: p.z, hp: 1, born: s.elapsed, dead: false, color: ability.color, size: 0.3 });
      break;
    }
  }
  d.active.push(a);
  d.callout = { name: ability.name, agent: ability.agent, hint: ability.hint, kind: ability.kind, until: s.elapsed + Math.max(1.6, ability.windup + 0.6) };
  s.emit('flash-cue', { kind: ability.kind });
}

const lerp = (a, b, t) => a + (b - a) * t;

export function tickFlashDrill(s, dt) {
  const d = s.drill;
  d.blind = Math.max(0, d.blind - dt);
  d.nearsight = Math.max(0, d.nearsight - dt);
  d.visuals = [];
  if (s.elapsed >= d.next && !d.active.length) {
    launch(s);
    d.next = s.elapsed + 3.4 + s.random() * 1.6;
  }
  for (const a of d.active) {
    const ab = a.ability;
    const t = Math.min(1, (s.elapsed - a.born) / Math.max(0.01, ab.windup));
    const target = a.targetId ? s.targets.find((x) => x.id === a.targetId) : null;
    if (a.from && !a.dir) {
      // projectile flight until it pops
      let p;
      if (a.curve) {
        const u = 1 - t;
        p = { x: u * u * a.from.x + 2 * u * t * a.curve.x + t * t * a.to.x, y: u * u * a.from.y + 2 * u * t * a.curve.y + t * t * a.to.y, z: u * u * a.from.z + 2 * u * t * a.curve.z + t * t * a.to.z };
      } else p = { x: lerp(a.from.x, a.to.x, t), y: lerp(a.from.y, a.to.y, t) + (a.arc ? Math.sin(t * Math.PI) * a.arc : 0), z: lerp(a.from.z, a.to.z, t) };
      a.pos = p;
      if (!a.popped) d.visuals.push({ ...p, color: ab.color, size: 0.18 + t * 0.08 });
      if (!a.popped && s.elapsed >= a.popAt) {
        a.popped = true;
        a.dieAt = s.elapsed + 0.25;
        const angle = lookAngle(s, p);
        // looking at it: full blind; side-on: partial; turned away (>100°): dodged
        const strength = angle <= 55 ? 1 : angle >= 100 ? 0 : 1 - ((angle - 55) / 45) * 0.85;
        blindPlayer(s, ab, strength);
        s.emit('flash-pop', { kind: ab.kind });
        swingPeek(s, a.side);
      }
      if (a.popped) d.visuals.push({ ...p, color: 0xffffff, size: 0.9 * Math.max(0, (a.dieAt - s.elapsed) / 0.25) });
    }
    if (ab.id === 'paranoia' && s.elapsed >= a.popAt) {
      a.pos.x += a.dir.x * ab.speed * dt;
      a.pos.z += a.dir.z * ab.speed * dt;
      for (let i = 0; i < 4; i++) d.visuals.push({ x: a.pos.x - a.dir.x * i * 0.5, y: a.pos.y, z: a.pos.z - a.dir.z * i * 0.5, color: ab.color, size: 0.55 - i * 0.1 });
      const near = Math.hypot(a.pos.x - s.position.x, a.pos.z - s.position.z);
      const along = (s.position.x - a.pos.x) * a.dir.x + (s.position.z - a.pos.z) * a.dir.z;
      if (!a.popped && near < 1.25) {
        a.popped = true;
        blindPlayer(s, ab, 1);
        s.emit('flash-pop', { kind: ab.kind });
        swingPeek(s, a.side);
      } else if (!a.popped && along < -1.5) {
        a.popped = true;
        blindPlayer(s, ab, 0);
        swingPeek(s, a.side);
      }
    }
    if (ab.id === 'leer' && target && !target.dead && s.elapsed >= a.popAt) {
      if (lookAngle(s, a.at) < 50) {
        d.nearsight = Math.max(d.nearsight, 0.35);
        a.hurt = true;
      }
    }
    if (ab.id === 'dizzy' && target && !target.dead && s.elapsed >= a.nextShot && a.shots.length < 3) {
      a.nextShot = s.elapsed + 0.45;
      const dx = s.position.x - a.at.x, dy = s.position.y - a.at.y, dz = s.position.z - a.at.z, len = Math.hypot(dx, dy, dz);
      a.shots.push({ x: a.at.x, y: a.at.y, z: a.at.z, v: { x: (dx / len) * 13, y: (dy / len) * 13, z: (dz / len) * 13 }, done: false });
      s.emit('flash-cue', { kind: 'nearsight' });
    }
    for (const shot of a.shots || []) {
      if (shot.done) continue;
      shot.x += shot.v.x * dt; shot.y += shot.v.y * dt; shot.z += shot.v.z * dt;
      d.visuals.push({ x: shot.x, y: shot.y, z: shot.z, color: ab.color, size: 0.2 });
      if (Math.hypot(shot.x - s.position.x, shot.y - s.position.y, shot.z - s.position.z) < 0.8) {
        shot.done = true;
        blindPlayer(s, ab, 1);
        s.emit('flash-pop', { kind: ab.kind });
      } else if ((shot.x - s.position.x) * shot.v.x + (shot.z - s.position.z) * shot.v.z > 3) shot.done = true;
    }
    if (ab.id === 'prowler' && target && !target.dead) {
      const dx = s.position.x - target.x, dz = s.position.z - target.z, len = Math.hypot(dx, dz);
      target.x += (dx / len) * ab.speed * dt;
      target.z += (dz / len) * ab.speed * dt;
      if (len < 1) {
        target.dead = true;
        blindPlayer(s, ab, 1);
        s.emit('flash-pop', { kind: ab.kind });
        swingPeek(s, a.side);
      }
    }
    if (ab.id === 'fakeout' && target && !target.dead) {
      target.x += target.vx * dt;
      target.z += target.vz * dt;
    }
    // expiry of shootable / timed abilities
    if (a.dieAt && s.elapsed >= a.dieAt && !a.finished) {
      a.finished = true;
      if (target && !target.dead) {
        target.dead = true;
        if (ab.id === 'fakeout') {
          s.score += 50;
          s.feedback = { text: 'SEÑUELO IGNORADO +50', until: s.elapsed + 0.8 };
        }
        if (ab.id === 'leer' && !a.hurt) blindPlayer(s, ab, 0);
        if (ab.id !== 'prowler' || !a.popped) swingPeek(s, a.side);
      }
    }
  }
  d.active = d.active.filter((a) => !(a.finished || (a.popped && !a.targetId && s.elapsed > (a.dieAt || a.popAt) + 0.3 && !(a.shots || []).some((x) => !x.done))));
  // swinging enemies
  for (const t of s.targets) {
    if (t.kind !== 'agent' || t.dead) continue;
    t.x += (t.vx || 0) * dt * (s.elapsed - t.born < 0.5 ? 1 : 0.15);
    if (s.elapsed - t.born > t.life) {
      t.dead = true;
      s.combo = 0;
      s.feedback = { text: 'TE HAN ASOMADO', until: s.elapsed + 0.6 };
    }
  }
  s.targets = s.targets.filter((t) => !t.dead || s.elapsed - (t.diedAt ?? t.born) < 0.05);
}

/** A bullet hit something in the drill. Returns true when handled. */
export function flashDrillHit(s, target, part, damage) {
  if (target.kind === 'decoy') {
    target.dead = true;
    const ability = flashAbilities.find((a) => a.id === 'fakeout');
    s.emit('flash-pop', { kind: 'flash' });
    blindPlayer(s, ability, 1);
    s.feedback = { text: 'ERA UN SEÑUELO', until: s.elapsed + 0.9 };
    return true;
  }
  if (target.kind === 'ability') {
    target.dead = true;
    s.drill.destroyed++;
    s.score += 75;
    const a = s.drill.active.find((x) => x.targetId === target.id);
    if (a) {
      a.finished = true;
      if (!a.hurt && a.ability.id !== 'dizzy') s.drill.dodged++;
      swingPeek(s, a.side);
    }
    s.feedback = { text: 'HABILIDAD DESTRUIDA +75', until: s.elapsed + 0.7 };
    s.emit('impact', { id: target.id, part: 'head' });
    return true;
  }
  if (target.kind === 'agent') {
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp === 0) {
      s.score += part === 'head' ? 200 : 150;
      s.eliminate(target, part);
    } else s.emit('impact', { id: target.id, part, damage });
    return true;
  }
  return false;
}
