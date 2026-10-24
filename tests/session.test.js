import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingSession } from '../src/game/TrainingSession.js';
function step(s, seconds, input = {}) {
  for (let n = 0; n < Math.ceil(seconds / 0.01); n++) s.tick(0.01, input);
}
test('rifle fires while held; semi automatic does not', () => {
  const s = new TrainingSession();
  s.start();
  step(s, 0.5, { fire: true });
  assert(s.shots >= 4);
  s.reset(0, 'sheriff');
  s.start();
  step(s, 0.5, { fire: true });
  assert.equal(s.shots, 0);
  s.shoot();
  assert.equal(s.ammo, 5);
  assert.equal(s.shoot(), false);
});
test('reload refills the chosen magazine after its duration', () => {
  const s = new TrainingSession();
  s.reset(0, 'sheriff');
  s.start();
  s.shoot();
  s.reload();
  assert(s.reloadLeft > 0);
  assert.equal(s.shoot(), false);
  step(s, 2.3);
  assert.equal(s.ammo, 6);
  assert.equal(s.reloadLeft, 0);
});
test('pause freezes session and resume keeps elapsed time', () => {
  const s = new TrainingSession();
  s.start();
  step(s, 2);
  s.pause();
  const remaining = s.remaining;
  step(s, 3);
  assert.equal(s.remaining, remaining);
  s.start();
  step(s, 1);
  assert(s.remaining < remaining);
});
test('diagonal movement is normalized and walking/crouching reduce speed', () => {
  const a = new TrainingSession(),
    b = new TrainingSession();
  a.start();
  b.start();
  step(a, 1, { keys: new Set(['w']) });
  step(b, 1, { keys: new Set(['w', 'd']) });
  assert(Math.abs(a.moveSpeed - b.moveSpeed) < 0.001);
  const normal = b.moveSpeed;
  step(b, 1, { keys: new Set(['w', 'Shift']) });
  assert(b.moveSpeed < normal * 0.6);
  step(b, 1, { keys: new Set(['w', 'Control']) });
  assert(b.position.y < 1.2);
});
test('jump returns to ground and never sinks below it', () => {
  const s = new TrainingSession();
  s.start();
  s.jump();
  step(s, 0.1);
  assert(s.position.y > 1.65);
  step(s, 2);
  assert.equal(s.jumpHeight, 0);
  assert.equal(s.position.y, 1.65);
});
test('headshot only ignores body hits; hit test gets selected target', () => {
  let part = 'body';
  const s = new TrainingSession({ hitTest: () => ({ id: 0, part }) });
  s.reset(3, 'guardian');
  s.start();
  s.shoot();
  assert.equal(s.hits, 0);
  step(s, 0.25);
  part = 'head';
  s.shoot();
  assert.equal(s.hits, 1);
});
test('tracking measures time on target and ends at 60 seconds', () => {
  const s = new TrainingSession({ hitTest: () => ({ id: 0, part: 'body' }) });
  s.reset(2, 'vandal');
  s.start();
  step(s, 61, { fire: true });
  assert.equal(s.status, 'finished');
  assert.equal(s.remaining, 0);
  assert(s.result().accuracy >= 99);
  assert.equal(s.shots, 0);
});
test('expired reflex target does not count as a fired bullet', () => {
  const s = new TrainingSession();
  s.reset(4, 'ghost');
  s.start();
  step(s, 2);
  assert(s.expired > 0);
  assert.equal(s.shots, 0);
});

test('spawns are separated in screen angle, including after repeated kills', () => {
  const s = new TrainingSession();
  for (let n = 0; n < 100; n++) {
    const live = s.targets.filter((t) => !t.dead);
    for (let i = 0; i < live.length; i++)
      for (let j = i + 1; j < live.length; j++)
        assert(
          Math.abs(Math.atan2(live[i].x, -live[i].z) - Math.atan2(live[j].x, -live[j].z)) > 0.12,
        );
    s.start();
    s.eliminate(s.targets[n % 3], 'head');
    step(s, 0.6);
  }
});
test('a kill removes the bot before a delayed respawn and emits feedback', () => {
  const s = new TrainingSession({ hitTest: () => ({ id: 0, part: 'body' }) });
  s.start();
  s.shoot();
  assert.equal(s.hits, 1);
  assert(s.targets[0].dead);
  assert(s.events.some((e) => e.type === 'kill'));
  step(s, 0.2);
  assert(s.targets[0].dead);
  step(s, 0.5);
  assert(!s.targets[0].dead);
});
test('target switching advances a wave only after all targets are eliminated', () => {
  const s = new TrainingSession();
  s.reset(5, 'phantom');
  s.start();
  s.targets.forEach((t) => s.eliminate(t, 'head'));
  assert(s.targets.every((t) => t.dead));
  step(s, 1);
  assert.equal(s.wave, 2);
  assert(s.targets.every((t) => !t.dead));
});

test('NO APTO PARA PLATAS lasts 45 seconds, expires rapid targets and rewards fast streaks', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.reset(6, 'phantom');
  s.start();
  assert.equal(s.remaining, 45);
  assert.equal(s.targets.length, 3);
  const target = s.targets[0];
  s.hitTest = () => ({ id: target.id, part: 'body' });
  const ammunition = s.ammo;
  s.shoot();
  assert(s.score >= 160);
  assert.equal(s.ammo, ammunition);
  for (let i = 0; i < 100; i++) s.tick(0.01, { keys: new Set() });
  assert(s.expired > 0);
  for (let i = 0; i < 4501; i++) s.tick(0.01, { keys: new Set() });
  assert.equal(s.status, 'finished');
  assert.equal(s.remaining, 0);
  assert.equal(s.result().duration, 45);
  assert(s.result().score > 0);
});

test('extreme targets stay stationary until they expire or are hit', () => {
  const s = new TrainingSession({ random: () => 0.5 });
  s.reset(6, 'vandal');
  s.start();
  const original = s.targets.map((t) => ({ x: t.x, y: t.y, z: t.z }));
  for (let n = 0; n < 30; n++) s.tick(0.01, { keys: new Set() });
  assert.deepEqual(
    s.targets.map((t) => ({ x: t.x, y: t.y, z: t.z })),
    original,
  );
});
