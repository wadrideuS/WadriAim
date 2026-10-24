import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  burstMissShare,
  dispersion,
  formatMs,
  halvesAccuracy,
  reactionStats,
  timeline,
} from '../src/features/session-summary/round-stats.js';
import { compareRound, primaryMetric } from '../src/features/session-summary/history-compare.js';
import { roundInsights } from '../src/features/session-summary/insights.js';

const NOW = new Date(2026, 9, 23, 20, 0).getTime();
const shot = (t, result = 'miss', patch = {}) => ({ t, result, head: false, ...patch });
const record = (patch = {}) => ({
  mode: 1,
  name: 'Flick Shot',
  hits: 40,
  headshots: 10,
  shots: 60,
  accuracy: 67,
  score: 0,
  duration: 60,
  activeDuration: 60,
  ammoMode: 'reload',
  date: NOW,
  ...patch,
});
const past = (minutesAgo, patch = {}) => record({ date: NOW - minutesAgo * 60_000, ...patch });

test('timeline groups shots into one-second buckets for short rounds', () => {
  const result = timeline(
    [shot(0.2, 'kill', { head: true }), shot(0.8), shot(1.5, 'impact'), shot(2.9, 'kill')],
    3,
  );
  assert.equal(result.size, 1);
  assert.deepEqual(result.buckets, [
    { start: 0, kills: 1, heads: 1, impacts: 0, misses: 1 },
    { start: 1, kills: 0, heads: 0, impacts: 1, misses: 0 },
    { start: 2, kills: 1, heads: 0, impacts: 0, misses: 0 },
  ]);
});

test('timeline widens buckets so long rounds stay at sixty bars or fewer', () => {
  const result = timeline([shot(119.5)], 120);
  assert.equal(result.size, 2);
  assert.equal(result.buckets.length, 60);
  assert.equal(result.buckets[59].misses, 1);
});

test('a 60 s round that overruns by a frame still gets one-second bars', () => {
  const result = timeline([shot(60.01)], 60.02);
  assert.equal(result.size, 1);
  assert.equal(result.buckets.length, 60);
  assert.equal(result.buckets[59].misses, 1);
});

test('reaction stats use only kills and bin them by 150 ms', () => {
  const stats = reactionStats([
    shot(1, 'kill', { ms: 320 }),
    shot(2, 'miss'),
    shot(3, 'kill', { ms: 480 }),
    shot(4, 'kill', { ms: 2100 }),
  ]);
  assert.equal(stats.count, 3);
  assert.equal(stats.best, 320);
  assert.equal(stats.median, 480);
  assert.equal(stats.average, 967);
  assert.equal(stats.bins.find((bin) => bin.from === 300).count, 1);
  assert.equal(stats.bins.find((bin) => bin.from === 450).count, 1);
  assert.equal(stats.bins.at(-1).count, 1, 'slow kills land in the open last bin');
});

test('times under a second stay in ms and longer ones read in seconds', () => {
  assert.equal(formatMs(640), '640 ms');
  assert.equal(formatMs(3533), '3,5 s');
});

test('reaction stats are empty without kills', () => {
  assert.equal(reactionStats([shot(1)]), null);
});

test('dispersion averages offsets and needs at least three points', () => {
  assert.equal(dispersion([shot(1, 'miss', { dx: 1, dy: 0 })]), null);
  const result = dispersion([
    shot(1, 'kill', { dx: -0.6, dy: 0.2 }),
    shot(2, 'miss', { dx: -1.2, dy: -0.2 }),
    shot(3, 'impact', { dx: -0.3, dy: 0 }),
    shot(4, 'miss'),
  ]);
  assert.equal(result.points.length, 3);
  assert.equal(result.mean.x, -0.7);
  assert.equal(result.mean.y, 0);
});

test('burst misses are misses fired right after another shot', () => {
  const log = [shot(1), shot(1.1), shot(1.2), shot(3), shot(3.05, 'kill')];
  assert.equal(burstMissShare(log), 0.5);
});

test('halves compare kill rate in each half of the round', () => {
  const log = [
    ...Array.from({ length: 10 }, (_, i) => shot(i, i < 8 ? 'kill' : 'miss')),
    ...Array.from({ length: 10 }, (_, i) => shot(30 + i, i < 3 ? 'kill' : 'miss')),
  ];
  assert.deepEqual(halvesAccuracy(log, 60), { first: 80, second: 30, shots: [10, 10] });
});

test('primary metric uses points when the round scores them', () => {
  assert.deepEqual(primaryMetric(record({ mode: 6, score: 4200, hits: 30 })), {
    value: 4200,
    unit: 'puntos',
  });
  assert.deepEqual(primaryMetric(record({ hits: 41 })), { value: 41, unit: 'impactos' });
});

test('first complete round in a mode becomes the reference', () => {
  const comparison = compareRound(record(), [record()]);
  assert.equal(comparison.verdict.tone, 'first');
});

test('beating every previous complete round is a best mark', () => {
  const history = [past(30, { hits: 35 }), past(20, { hits: 39 })];
  const comparison = compareRound(record({ hits: 40 }), history);
  assert.equal(comparison.verdict.tone, 'best');
  assert.match(comparison.verdict.text, /antes 39/);
});

test('reports the percentage over the average of previous rounds', () => {
  const history = [past(30, { hits: 50 }), past(20, { hits: 30 })];
  const comparison = compareRound(record({ hits: 44 }), history);
  assert.equal(comparison.deltaPct, 10);
  assert.equal(comparison.verdict.tone, 'up');
  assert.match(comparison.verdict.text, /\+10% sobre tu media/);
});

test('ignores early, endless, other modes and other ammo rules when comparing', () => {
  const history = [
    past(50, { hits: 10, early: true }),
    past(40, { hits: 10, endless: true }),
    past(30, { hits: 10, mode: 3 }),
    past(25, { hits: 10, ammoMode: 'infinite' }),
    past(20, { hits: 50 }),
  ];
  const comparison = compareRound(record({ hits: 40 }), history);
  assert.equal(comparison.pool.length, 1);
  assert.equal(comparison.deltaPct, -20);
  assert.equal(comparison.verdict.tone, 'down');
});

test('an early round is never compared as if it were complete', () => {
  const history = [past(20, { hits: 5 })];
  const comparison = compareRound(record({ hits: 9, early: true, activeDuration: 19.4 }), history);
  assert.equal(comparison.verdict.tone, 'incomplete');
  assert.equal(comparison.deltaPct, null);
  assert.match(comparison.verdict.text, /19 s de 60 s/);
});

test('trend keeps the last complete rounds of the mode in order', () => {
  const history = Array.from({ length: 12 }, (_, i) => past(100 - i, { accuracy: i }));
  const comparison = compareRound(record(), history, { limit: 5 });
  assert.deepEqual(
    comparison.pool.map((round) => round.accuracy),
    [7, 8, 9, 10, 11],
  );
});

const stats = (patch = {}) => ({
  shots: 30,
  misses: 10,
  seconds: 60,
  burstShare: 0,
  halves: null,
  dispersion: null,
  orbTargets: false,
  ...patch,
});

test('low accuracy asks to slow down with the real numbers', () => {
  const lines = roundInsights(
    record({ accuracy: 7, shots: 27, hits: 2 }),
    stats({ misses: 25, seconds: 19.4 }),
    null,
  );
  assert.match(lines[0], /Precisión baja: 25 fallos en 19 s/);
});

test('no low accuracy advice when there are too few shots to judge', () => {
  const lines = roundInsights(
    record({ accuracy: 20, shots: 5 }),
    stats({ shots: 5, misses: 4 }),
    null,
  );
  assert.ok(lines.every((line) => !line.startsWith('Precisión baja')));
});

test('spraying misses are called out when most misses come in bursts', () => {
  const lines = roundInsights(record(), stats({ misses: 12, burstShare: 0.75 }), null);
  assert.ok(lines.some((line) => line.includes('ráfaga')));
});

test('a consistent vertical bias below the head suggests raising the crosshair', () => {
  const lines = roundInsights(
    record(),
    stats({ dispersion: { points: new Array(10), mean: { x: 0.1, y: -0.9 } } }),
    null,
  );
  assert.ok(lines.some((line) => /por debajo de la cabeza.*0,9°/.test(line)));
});

test('orb modes never talk about headshots or heads', () => {
  const lines = roundInsights(
    record({ mode: 0, hits: 20, headshots: 0 }),
    stats({ orbTargets: true, dispersion: { points: new Array(10), mean: { x: 0, y: -0.9 } } }),
    null,
  );
  assert.ok(lines.every((line) => !/cabeza|headshot/i.test(line)));
  assert.ok(lines.some((line) => line.includes('por debajo del centro')));
});

test('accuracy dropping in the second half is reported', () => {
  const lines = roundInsights(
    record(),
    stats({ halves: { first: 70, second: 40, shots: [15, 15] } }),
    null,
  );
  assert.ok(lines.some((line) => line.includes('de 70% a 40%')));
});

test('faster time per target than your average is praised with the delta', () => {
  const lines = roundInsights(record({ targetMs: 450 }), stats(), { averageTargetMs: 600 });
  assert.ok(lines.some((line) => line.includes('25% más rápido')));
});

test('insights stop at three lines', () => {
  const lines = roundInsights(
    record({ accuracy: 10, shots: 40, hits: 4, headshots: 0, expired: 6, targetMs: 300 }),
    stats({
      shots: 40,
      misses: 36,
      burstShare: 0.9,
      halves: { first: 30, second: 5, shots: [20, 20] },
      dispersion: { points: new Array(10), mean: { x: 1, y: 0 } },
    }),
    { averageTargetMs: 600 },
  );
  assert.equal(lines.length, 3);
});
