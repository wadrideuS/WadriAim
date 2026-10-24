import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  IDLE_SPEED,
  RUN_SPEED,
  approachAngle,
  gaitFor,
  strideAngle,
} from '../src/renderer/agent-gait.js';

test('a bot standing still idles without stepping', () => {
  const gait = gaitFor(0);
  assert.equal(gait.state, 'idle');
  assert.equal(gait.cadence, 0);
});

test('a bot just above the idle threshold walks', () => {
  assert.equal(gaitFor(IDLE_SPEED * 0.9).state, 'idle');
  assert.equal(gaitFor(IDLE_SPEED * 1.1).state, 'walk');
});

test('basic-difficulty attackers walk and VCT attackers run', () => {
  assert.equal(gaitFor(1.8).state, 'walk');
  assert.equal(gaitFor(RUN_SPEED + 0.5).state, 'run');
});

test('steps cover exactly the distance travelled, so the feet do not slide', () => {
  for (const speed of [0.6, 1.8, 2.4, 3.1, 4.5]) {
    const gait = gaitFor(speed);
    assert.ok(Math.abs(gait.cadence * gait.stride - speed) < 1e-9, `slides at ${speed} m/s`);
  }
});

test('running takes longer strides than walking', () => {
  assert.ok(gaitFor(4).stride > gaitFor(1.5).stride);
});

test('the hip swing places the feet one stride apart', () => {
  const legLength = 0.9;
  const angle = strideAngle(0.72, legLength);
  assert.ok(Math.abs(2 * legLength * Math.sin(angle) - 0.72) < 1e-9);
});

test('the hip swing never overextends the leg', () => {
  assert.ok(strideAngle(5, 0.9) < Math.PI / 2);
});

test('turning eases toward the target heading', () => {
  const next = approachAngle(0, 1, 10, 0.05);
  assert.ok(next > 0 && next < 1);
});

test('turning takes the short way across the ±180° seam', () => {
  const next = approachAngle(Math.PI - 0.1, -Math.PI + 0.1, 10, 0.05);
  assert.ok(Math.cos(next - Math.PI) > Math.cos(0.1), 'should move toward 180°, not swing through 0°');
});

test('a long frame lands on the target instead of overshooting', () => {
  const next = approachAngle(0, 1, 10, 5);
  assert.ok(Math.abs(next - 1) < 1e-6);
});
