import { headOnlyModes } from '../../data/weapons.js';
import { medianKillMs } from '../../game/round-log.js';

const MAX_BARS = 60;
const REACTION_BIN_MS = 150;
const REACTION_OPEN_BIN_MS = 1500;
const MIN_DISPERSION_POINTS = 3;
const BURST_GAP_SECONDS = 0.15;
const MIN_HALF_SHOTS = 8;

const round2 = (value) => Math.round(value * 100) / 100;
const percent = (part, total) => (total ? Math.round((part / total) * 100) : 0);

export const formatMs = (ms) =>
  ms < 1000 ? `${ms} ms` : `${(ms / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} s`;

/** Shots per time bucket: one-second bars, wider when the round is longer than a minute. */
export function timeline(log, seconds) {
  const whole = Math.max(1, Math.round(seconds));
  const size = Math.ceil(whole / MAX_BARS);
  const count = Math.ceil(whole / size);
  const buckets = Array.from({ length: count }, (_, i) => ({
    start: i * size,
    kills: 0,
    heads: 0,
    impacts: 0,
    misses: 0,
  }));
  for (const shot of log) {
    const bucket = buckets[Math.min(count - 1, Math.floor(shot.t / size))];
    if (shot.result === 'kill') {
      bucket.kills += 1;
      if (shot.head) bucket.heads += 1;
    } else if (shot.result === 'impact') bucket.impacts += 1;
    else bucket.misses += 1;
  }
  return { size, buckets };
}

/** Time per target (spawn or previous kill → kill), with a histogram for the distribution. */
export function reactionStats(log) {
  const times = log.filter((shot) => shot.result === 'kill').map((shot) => shot.ms);
  if (!times.length) return null;
  const bins = [];
  for (let from = 0; from < REACTION_OPEN_BIN_MS; from += REACTION_BIN_MS)
    bins.push({ from, to: from + REACTION_BIN_MS, count: 0 });
  bins.push({ from: REACTION_OPEN_BIN_MS, to: Infinity, count: 0 });
  for (const ms of times)
    bins[Math.min(bins.length - 1, Math.floor(ms / REACTION_BIN_MS))].count += 1;
  return {
    count: times.length,
    best: Math.min(...times),
    median: medianKillMs(log),
    average: Math.round(times.reduce((sum, ms) => sum + ms, 0) / times.length),
    bins,
  };
}

/** Bullet error around the target in degrees, plus the average bias. */
export function dispersion(log) {
  const points = log
    .filter((shot) => Number.isFinite(shot.dx) && Number.isFinite(shot.dy))
    .map((shot) => ({ x: shot.dx, y: shot.dy, result: shot.result }));
  if (points.length < MIN_DISPERSION_POINTS) return null;
  const mean = (axis) =>
    round2(points.reduce((sum, point) => sum + point[axis], 0) / points.length);
  return { points, mean: { x: mean('x'), y: mean('y') } };
}

/** Share of misses fired less than 0.15 s after the previous shot (holding the trigger). */
export function burstMissShare(log) {
  let misses = 0;
  let bursts = 0;
  log.forEach((shot, i) => {
    if (shot.result !== 'miss') return;
    misses += 1;
    if (i > 0 && shot.t - log[i - 1].t < BURST_GAP_SECONDS) bursts += 1;
  });
  return misses ? bursts / misses : 0;
}

/** Kill accuracy in the first and second half of the round, when both halves have enough shots. */
export function halvesAccuracy(log, seconds) {
  const middle = seconds / 2;
  const first = log.filter((shot) => shot.t < middle);
  const second = log.filter((shot) => shot.t >= middle);
  if (first.length < MIN_HALF_SHOTS || second.length < MIN_HALF_SHOTS) return null;
  const kills = (shots) => shots.filter((shot) => shot.result === 'kill').length;
  return {
    first: percent(kills(first), first.length),
    second: percent(kills(second), second.length),
    shots: [first.length, second.length],
  };
}

/** Everything the summary draws, derived from the saved record and the in-memory shot log. */
export function summarizeRound(record, log = []) {
  const seconds = Math.max(0.001, record.activeDuration || 0);
  const shots = record.shots || 0;
  return {
    seconds,
    shots,
    misses: Math.max(0, shots - (record.hits || 0)),
    orbTargets: headOnlyModes.includes(record.mode),
    headshotRate: record.hits ? percent(record.headshots || 0, record.hits) : null,
    killsPerSecond: (record.hits || 0) / seconds,
    timeline: log.length ? timeline(log, seconds) : null,
    reaction: reactionStats(log),
    dispersion: dispersion(log),
    burstShare: burstMissShare(log),
    halves: halvesAccuracy(log, seconds),
  };
}
