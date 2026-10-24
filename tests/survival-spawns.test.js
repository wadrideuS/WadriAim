import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resetSpike, spawnDefenseWave } from '../src/game/SpikeDefense.js';
import {
  MAX_ENTRY_ANGLE,
  MIN_ENTRY_DISTANCE,
  DEFENDER_SPACING,
  angleFromView,
  cameraYawFor,
  facingHeading,
  forwardOf,
  waveSpawnPoints,
} from '../src/game/defense-spawns.js';
import {
  SURVIVAL_DEFENDER_SPAWN,
  SURVIVAL_ENTRIES,
  survivalNavigation,
} from '../src/game/survival-map.js';

const SURVIVAL = 12;
const survivalSession = (patch = {}) => {
  const session = { mode: SURVIVAL, elapsed: 0, random: () => 0.5, emit() {}, ...patch };
  return session;
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const allSlots = SURVIVAL_ENTRIES.flatMap((entry) => entry.slots);

test('every survival entry slot is walkable and leads to the defender spawn', () => {
  for (const slot of allSlots) {
    assert.ok(survivalNavigation.canWalk(slot.x, slot.z), `slot ${slot.x},${slot.z} is not walkable`);
    assert.ok(survivalNavigation.path(slot, SURVIVAL_DEFENDER_SPAWN).length > 0, `slot ${slot.x},${slot.z} is cut off`);
  }
});

test('every survival entry is far from the defender spawn', () => {
  for (const slot of allSlots) assert.ok(distance(slot, SURVIVAL_DEFENDER_SPAWN) >= MIN_ENTRY_DISTANCE);
});

test('the survival defender starts on the defender spawn looking at the entries', () => {
  const session = survivalSession();
  resetSpike(session);
  assert.deepEqual(
    { x: session.position.x.toFixed(1), z: session.position.z.toFixed(1) },
    { x: SURVIVAL_DEFENDER_SPAWN.x.toFixed(1), z: SURVIVAL_DEFENDER_SPAWN.z.toFixed(1) },
  );
  for (const slot of allSlots)
    assert.ok(angleFromView(session.position, session.yaw, slot) <= MAX_ENTRY_ANGLE, `slot ${slot.x},${slot.z} is outside the view`);
});

test('the first wave walks in from the entries, in front of the defender and never close', () => {
  const session = survivalSession();
  resetSpike(session);
  assert.equal(session.targets.length, 5);
  for (const bot of session.targets) {
    assert.ok(allSlots.some((slot) => distance(slot, bot) < 0.01), `bot at ${bot.x},${bot.z} is not on an entry`);
    assert.ok(distance(bot, session.position) >= MIN_ENTRY_DISTANCE);
    assert.ok(angleFromView(session.position, session.yaw, bot) <= MAX_ENTRY_ANGLE);
  }
});

test('the next wave also comes through the entries after the rest', () => {
  const session = survivalSession();
  resetSpike(session);
  const start = { ...session.position };
  session.spike.wave = 2;
  session.elapsed = 40;
  spawnDefenseWave(session);
  for (const bot of session.targets) {
    assert.ok(allSlots.some((slot) => distance(slot, bot) < 0.01));
    assert.ok(distance(bot, start) >= MIN_ENTRY_DISTANCE);
  }
});

test('the survival bots spread over every entry instead of piling on one', () => {
  const session = survivalSession();
  resetSpike(session);
  const used = new Set(session.targets.map((bot) => SURVIVAL_ENTRIES.findIndex((e) => e.slots.some((s) => distance(s, bot) < 0.01))));
  assert.equal(used.size, SURVIVAL_ENTRIES.length);
  const unique = new Set(session.targets.map((bot) => `${bot.x.toFixed(1)},${bot.z.toFixed(1)}`));
  assert.equal(unique.size, session.targets.length);
});

test('the bot partner stands beside the player facing the same front', () => {
  const session = survivalSession();
  resetSpike(session, { partner: 'bot' });
  const ally = session.companion;
  const forward = forwardOf(session.yaw);
  const side = angleFromView(session.position, session.yaw, ally);
  assert.ok(distance(ally, session.position) >= DEFENDER_SPACING * 0.7);
  assert.ok(distance(ally, session.position) <= DEFENDER_SPACING * 2.5);
  assert.ok(side >= Math.PI / 4 && side <= (3 * Math.PI) / 4, 'the partner should be beside, not in front or behind');
  assert.ok(Math.abs(Math.sin(ally.yaw - Math.atan2(forward.x, forward.z))) < 1e-9 && Math.cos(ally.yaw - Math.atan2(forward.x, forward.z)) > 0);
  assert.ok(!survivalNavigation.blocked(session.position, ally));
});

test('a friend in the room gets their own place in the defender line', () => {
  const host = survivalSession();
  resetSpike(host, { partner: 'friend' });
  const guest = survivalSession({ defenderSlot: 1 });
  resetSpike(guest, { partner: 'friend' });
  assert.ok(distance(host.position, guest.position) >= DEFENDER_SPACING * 0.7);
  assert.equal(guest.yaw, host.yaw);
});

test('a spawn picked from the pause menu keeps its own view', () => {
  const session = survivalSession();
  resetSpike(session, { spawn: { x: -5.1, z: 2.5, yaw: 1.2 } });
  assert.equal(session.position.x, -5.1);
  assert.equal(session.yaw, 1.2);
});

test('the view faces the middle of the narrowest arc, also across the ±180° seam', () => {
  const from = { x: 0, z: 0 };
  const behindLeft = { x: Math.sin(Math.PI - 0.2), z: Math.cos(Math.PI - 0.2) };
  const behindRight = { x: Math.sin(-Math.PI + 0.2), z: Math.cos(-Math.PI + 0.2) };
  const heading = facingHeading(from, [behindLeft, behindRight]);
  assert.ok(Math.abs(Math.cos(heading) + 1) < 1e-9, 'expected to face straight down -Z');
});

test('the camera yaw looks along the heading', () => {
  const forward = forwardOf(cameraYawFor(Math.atan2(3, -4)));
  assert.ok(Math.abs(forward.x - 0.6) < 1e-9 && Math.abs(forward.z + 0.8) < 1e-9);
});

test('a point behind the view is reported at 180°', () => {
  assert.ok(Math.abs(angleFromView({ x: 0, z: 0 }, 0, { x: 0, z: 5 }) - Math.PI) < 1e-9);
  assert.ok(angleFromView({ x: 0, z: 0 }, 0, { x: 0, z: -5 }) < 1e-9);
});

test('waves alternate the entries and rotate which one leads', () => {
  const entries = [
    { name: 'a', slots: [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }] },
    { name: 'b', slots: [{ x: 0, z: 9 }, { x: 1, z: 9 }, { x: 2, z: 9 }] },
  ];
  assert.deepEqual(waveSpawnPoints(entries, 1, 5).map((p) => p.entry), ['a', 'b', 'a', 'b', 'a']);
  assert.deepEqual(waveSpawnPoints(entries, 2, 5).map((p) => p.entry), ['b', 'a', 'b', 'a', 'b']);
  assert.equal(new Set(waveSpawnPoints(entries, 1, 5).map((p) => `${p.x},${p.z}`)).size, 5);
});
