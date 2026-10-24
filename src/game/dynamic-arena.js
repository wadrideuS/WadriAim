/**
 * "Duelo dinámico": bots that strafe, crouch, peek from low cover, show up in
 * second-floor windows and walk along high ledges.
 */
import { AGENT_HP } from '../data/weapons.js';

const FRONT = -16; // building facade
const WINDOW_SILL = 2.6; // floor of the second storey behind the windows
const windows = [-7.5, -2.5, 2.5, 7.5];

/** Boxes {x,z,w,d,h,y?} used for rendering and to block bullets. */
export const dynamicWalls = (() => {
  const walls = [];
  // facade with four window openings (1.6 wide, from 2.6 to 4.4 m)
  const openW = 1.6, bottom = WINDOW_SILL, top = 4.4, height = 6;
  walls.push({ x: 0, z: FRONT, w: 26, d: 0.5, h: bottom }); // lower storey
  walls.push({ x: 0, z: FRONT, w: 26, d: 0.5, h: height - top, y: top }); // above windows
  let left = -13;
  for (const wx of [...windows, 13 + openW / 2]) {
    const right = wx - openW / 2;
    if (right > left) walls.push({ x: (left + right) / 2, z: FRONT, w: right - left, d: 0.5, h: top - bottom, y: bottom });
    left = wx + openW / 2;
  }
  // floor of the upper storey (bots stand on it behind the windows)
  walls.push({ x: 0, z: FRONT - 1.5, w: 26, d: 2.5, h: 0.2, y: WINDOW_SILL - 0.2 });
  // low covers on the ground
  walls.push({ x: -5, z: -9, w: 2.4, d: 0.6, h: 1.05 });
  walls.push({ x: 4.5, z: -10.5, w: 2.4, d: 0.6, h: 1.05 });
  // high ledges (side towers)
  walls.push({ x: -11, z: -11, w: 3, d: 6, h: 3.4 });
  walls.push({ x: 11, z: -11, w: 3, d: 6, h: 3.4 });
  return walls;
})();

const behaviours = ['strafe', 'cover', 'window', 'ledge', 'strafe', 'window'];

export function spawnDynamic(id, s) {
  const taken = new Set(s.targets.filter((t) => !t.dead && t.id !== id).map((t) => t.slot));
  let behaviour, slot;
  for (let i = 0; i < 12; i++) {
    behaviour = behaviours[Math.floor(s.random() * behaviours.length)];
    slot = behaviour + ':' + Math.floor(s.random() * 4);
    if (!taken.has(slot)) break;
  }
  const n = Number(slot.split(':')[1]);
  const base = { id, slot, behaviour, hp: AGENT_HP, maxHp: AGENT_HP, born: s.elapsed, dead: false, respawnAt: 0, crouch: 0, phase: s.random() * 6 };
  switch (behaviour) {
    case 'strafe':
      return { ...base, x: -6 + s.random() * 12, z: -11 - s.random() * 3, y: 1.65, ground: 0, dir: s.random() < 0.5 ? -1 : 1, nextTurn: s.elapsed + 0.4 + s.random() * 0.8, nextCrouch: s.elapsed + 1 + s.random() * 1.5 };
    case 'cover': {
      const c = n % 2 ? { x: 4.5, z: -11.2 } : { x: -5, z: -9.7 };
      return { ...base, x: c.x, z: c.z, y: 1.65, ground: 0, crouch: 1, nextCrouch: s.elapsed + 0.6 + s.random() * 0.8 };
    }
    case 'window': {
      const wx = windows[n];
      return { ...base, x: wx + (s.random() < 0.5 ? -1.6 : 1.6), z: FRONT - 1, y: WINDOW_SILL + 1.65, ground: WINDOW_SILL, peekX: wx, hideX: wx + (s.random() < 0.5 ? -1.7 : 1.7), stay: 1.6 + s.random() };
    }
    case 'ledge': {
      const side = n % 2 ? 1 : -1;
      return { ...base, x: side * 11, z: -13.5, y: 3.4 + 1.65, ground: 3.4, dir: 1, zMin: -13.6, zMax: -8.6, nextCrouch: s.elapsed + 1.5 };
    }
  }
}

export function tickDynamic(s, dt, respawn) {
  s.targets.forEach((t, i) => {
    if (t.dead) {
      if (s.elapsed >= t.respawnAt) s.targets[i] = respawn(t.id);
      return;
    }
    const age = s.elapsed - t.born;
    switch (t.behaviour) {
      case 'strafe': {
        // A-D strafe with stops and random crouch-spam, like a real duel
        if (s.elapsed >= t.nextTurn) {
          t.dir = s.random() < 0.25 ? 0 : t.dir === 0 ? (s.random() < 0.5 ? -1 : 1) : -t.dir;
          t.nextTurn = s.elapsed + 0.25 + s.random() * 0.7;
        }
        t.x = Math.max(-8, Math.min(8, t.x + t.dir * 3.6 * dt));
        if (Math.abs(t.x) >= 8) t.dir *= -1;
        if (s.elapsed >= t.nextCrouch) {
          t.crouching = !t.crouching;
          t.nextCrouch = s.elapsed + (t.crouching ? 0.35 + s.random() * 0.5 : 1 + s.random() * 1.6);
        }
        t.crouch = t.crouching ? 1 : 0;
        break;
      }
      case 'cover':
        // hides behind the box and stands up to shoot
        if (s.elapsed >= t.nextCrouch) {
          t.crouch = t.crouch ? 0 : 1;
          t.nextCrouch = s.elapsed + (t.crouch ? 0.7 + s.random() * 0.9 : 0.8 + s.random() * 0.8);
        }
        break;
      case 'window': {
        // slides into the window, holds, then slides out
        const reveal = age < 0.45 ? age / 0.45 : age < 0.45 + t.stay ? 1 : Math.max(0, 1 - (age - 0.45 - t.stay) / 0.45);
        t.x = t.hideX + (t.peekX - t.hideX) * reveal;
        if (age > 0.9 + t.stay) {
          t.dead = true;
          t.respawnAt = s.elapsed + 0.3;
          s.combo = 0;
        }
        break;
      }
      case 'ledge':
        t.z += t.dir * 2.2 * dt;
        if (t.z > t.zMax || t.z < t.zMin) t.dir *= -1;
        if (s.elapsed >= t.nextCrouch) {
          t.crouch = t.crouch ? 0 : 1;
          t.nextCrouch = s.elapsed + 0.6 + s.random() * 1.5;
        }
        break;
    }
    t.y = t.ground + 1.65; // crouching is drawn by the leg rig
  });
}
