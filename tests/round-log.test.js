import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrainingSession } from '../src/game/TrainingSession.js';
import { medianKillMs, targetAngles } from '../src/game/round-log.js';

const view = (patch = {}) => ({ position: { x: 0, y: 1.65, z: 0 }, yaw: 0, pitch: 0, ...patch });

test('a target straight ahead sits at the view centre', () => {
  const angles = targetAngles(view(), { x: 0, y: 1.65, z: -10 });
  assert.ok(Math.abs(angles.x) < 1e-9 && Math.abs(angles.y) < 1e-9);
});

test('a target to the right and above reads as positive degrees', () => {
  const angles = targetAngles(view(), { x: 1, y: 2.65, z: -10 });
  assert.equal(angles.x.toFixed(2), '5.71');
  assert.equal(angles.y.toFixed(2), '5.71');
});

test('turning toward the target with the game yaw convention centres it', () => {
  const target = { x: 3, y: 1.65, z: -8 };
  const angles = targetAngles(view({ yaw: Math.atan2(-3, 8) }), target);
  assert.ok(Math.abs(angles.x) < 1e-9);
});

test('a target behind the camera has no screen position', () => {
  assert.equal(targetAngles(view(), { x: 0, y: 1.65, z: 5 }), null);
});

test('median kill time ignores shots without a kill', () => {
  const log = [
    { result: 'kill', ms: 300 },
    { result: 'miss' },
    { result: 'kill', ms: 500 },
    { result: 'kill', ms: 900 },
  ];
  assert.equal(medianKillMs(log), 500);
  assert.equal(medianKillMs([{ result: 'miss' }]), null);
});

function microflicks(hitTest) {
  const s = new TrainingSession({ hitTest });
  s.reset(0, 'vandal');
  s.start();
  return s;
}

test('every shot is logged with its time and outcome', () => {
  let answer = null;
  const s = microflicks(() => answer);
  s.elapsed = 0.5;
  s.shoot();
  const target = s.targets[1];
  answer = { id: target.id, part: 'head' };
  s.elapsed = 1.2;
  s.cooldown = 0;
  s.shoot();
  assert.deepEqual(
    s.shotLog.map(({ t, result, head }) => ({ t, result, head })),
    [
      { t: 0.5, result: 'miss', head: false },
      { t: 1.2, result: 'kill', head: true },
    ],
  );
});

test('kill time counts from the later of spawn or the previous kill', () => {
  const s = microflicks(() => null);
  const [first, second] = s.targets;
  s.hitTest = () => ({ id: first.id, part: 'head' });
  s.elapsed = 0.4;
  s.shoot();
  s.hitTest = () => ({ id: second.id, part: 'head' });
  s.elapsed = 1.0;
  s.cooldown = 0;
  s.shoot();
  assert.deepEqual(
    s.shotLog.map((shot) => shot.ms),
    [400, 600],
  );
});

test('a hit that does not kill is logged as an impact', () => {
  const s = new TrainingSession();
  s.reset(1, 'vandal');
  s.start();
  s.hitTest = () => ({ id: s.targets[0].id, part: 'leg' });
  s.shoot();
  assert.equal(s.shotLog[0].result, 'impact');
  assert.equal(s.shotLog[0].ms, undefined);
});

test('hits carry the offset from the struck target in degrees', () => {
  const s = microflicks(() => null);
  const target = s.targets[1];
  s.yaw = Math.atan2(-(target.x - s.position.x), -(target.z - s.position.z));
  s.pitch = 0;
  s.random = () => 0;
  s.hitTest = () => ({ id: target.id, part: 'head' });
  s.shoot();
  const { dx, dy } = s.shotLog[0];
  assert.ok(Math.abs(dx) < 0.05, `dx ${dx}`);
  assert.ok(Math.abs(dy) < 0.05, `dy ${dy}`);
});

test('a miss far from every target has no offset', () => {
  const s = microflicks(() => null);
  s.yaw = Math.PI;
  s.shoot();
  assert.equal(s.shotLog[0].dx, undefined);
});

test('the log restarts each round and only aggregates reach the result', () => {
  const s = microflicks(() => ({ id: 0, part: 'head' }));
  s.elapsed = 0.3;
  s.shoot();
  const result = s.result();
  assert.equal(result.targetMs, 300);
  assert.equal('shotLog' in result, false);
  s.reset(0, 'vandal');
  assert.deepEqual(s.shotLog, []);
});
