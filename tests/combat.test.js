import test from 'node:test';
import assert from 'node:assert/strict';
import { arsenal, weaponDamage, AGENT_HP } from '../src/data/weapons.js';
import { rankFor } from '../src/data/ranks.js';
import { TrainingSession } from '../src/game/TrainingSession.js';
import { flashAbilities } from '../src/game/flash-drill.js';

test('damage matches the in-game stat cards', () => {
  assert.equal(weaponDamage(arsenal.vandal, 'head', 45), 160);
  assert.equal(weaponDamage(arsenal.vandal, 'legs', 10), 34);
  assert.equal(weaponDamage(arsenal.phantom, 'head', 10), 156);
  assert.equal(weaponDamage(arsenal.phantom, 'body', 25), 35);
  assert.equal(weaponDamage(arsenal.sheriff, 'body', 35), 50);
  assert.equal(weaponDamage(arsenal.ghost, 'head', 31), 87);
  assert.equal(arsenal.ghost.mag, 13);
});

function shootAt(session, part, times) {
  const target = session.targets[0];
  session.hitTest = () => ({ id: target.id, part });
  for (let i = 0; i < times; i++) {
    session.cooldown = 0;
    session.shoot();
  }
  return target;
}

test('agents have 150 HP: one Vandal headshot, four body shots', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.reset(1, 'vandal');
  s.start();
  assert.equal(s.targets[0].hp, AGENT_HP);
  assert.equal(shootAt(s, 'body', 3).dead, false);
  assert.equal(shootAt(s, 'body', 1).dead, true);
  s.reset(1, 'vandal');
  s.start();
  assert.equal(shootAt(s, 'head', 1).dead, true);
  s.reset(1, 'ghost');
  s.start();
  assert.equal(shootAt(s, 'head', 1).dead, false);
});

test('spray climbs while firing and resets after recovery', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.reset(1, 'vandal');
  s.start();
  s.hitTest = () => null;
  const offsets = [];
  s.hitTest = (o) => (offsets.push(o.y), null);
  for (let i = 0; i < 10; i++) {
    s.cooldown = 0;
    s.elapsed += 0.1;
    s.shoot();
  }
  assert.ok(s.punch.y > 0.5, 'camera kicks up');
  assert.ok(offsets[9] > offsets[1], 'bullets climb');
  s.elapsed += 2;
  s.cooldown = 0;
  s.shoot();
  assert.equal(s.sprayIndex, 1);
});

test('infinite ammo and endless rounds', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.trainingOptions = { ammo: 'infinite', timed: false };
  s.reset(1, 'sheriff');
  s.start();
  s.hitTest = () => null;
  for (let i = 0; i < 20; i++) {
    s.cooldown = 0;
    s.shoot();
  }
  assert.equal(s.ammo, 6);
  assert.equal(s.duration, Infinity);
  assert.equal(s.result().endless, true);
});

test('tracking clicks while on target', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.reset(2, 'vandal');
  s.start();
  s.hitTest = () => ({ id: 0, part: 'head' });
  for (let i = 0; i < 30; i++) s.tick(1 / 30, { keys: new Set(), fire: true });
  assert.ok(s.trackTime > 0.9);
  assert.ok(s.events.filter((e) => e.type === 'track-hit').length >= 9);
});

test('flash drill covers every blind in the game and blinds you when you look', () => {
  const ids = flashAbilities.map((a) => a.id);
  for (const id of ['curveball', 'guiding-light', 'flashpoint', 'flash-drive', 'blindside', 'arc-rose', 'fakeout', 'leer', 'paranoia', 'dizzy', 'prowler'])
    assert.ok(ids.includes(id), id);
  const s = new TrainingSession({ random: () => 0.3 });
  s.reset(13, 'vandal');
  s.start();
  for (let i = 0; i < 90 && !s.drill.flashed && !s.drill.dodged; i++) s.tick(1 / 30);
  assert.ok(s.drill.flashed + s.drill.dodged >= 1);
});

test('ranks go from Hierro to Radiante', () => {
  assert.equal(rankFor(1, 0).label, 'Hierro 1');
  assert.equal(rankFor(1, 85).label, 'Radiante');
  assert.match(rankFor(1, 50).label, /Platino|Oro|Diamante/);
});
