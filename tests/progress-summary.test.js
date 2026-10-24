import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accuracyTrend,
  formatTrainingTime,
  relativeDate,
  summarizeProgress,
} from '../src/features/progress-summary.js';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = new Date(2026, 9, 23, 20, 0).getTime();
const round = (patch) => ({
  mode: 1,
  name: 'Flick Shot',
  hits: 40,
  headshots: 10,
  shots: 60,
  accuracy: 66,
  score: 0,
  duration: 60,
  activeDuration: 60,
  date: NOW - HOUR,
  ...patch,
});

test('returns an empty summary when there is no history', () => {
  const summary = summarizeProgress([], NOW);
  assert.equal(summary.sessions, 0);
  assert.equal(summary.averageAccuracy, null);
  assert.equal(summary.headshotRate, null);
  assert.equal(summary.best, null);
  assert.equal(summary.streakDays, 0);
  assert.equal(summary.trainingSeconds, 0);
});

test('averages accuracy only over rounds where the player could shoot', () => {
  const history = [
    round({ accuracy: 70 }),
    round({ accuracy: 50 }),
    round({ mode: 7, name: 'Circuito de saltos', shots: 0, accuracy: 0, hits: 0, headshots: 0 }),
  ];
  assert.equal(summarizeProgress(history, NOW).averageAccuracy, 60);
});

test('counts tracking rounds even without shots and old rounds without a shots field', () => {
  const history = [
    round({ mode: 2, shots: 0, accuracy: 80 }),
    round({ shots: undefined, accuracy: 40 }),
  ];
  assert.equal(summarizeProgress(history, NOW).averageAccuracy, 60);
});

test('headshot rate is headshots over hits across all rounds', () => {
  const history = [round({ hits: 30, headshots: 6 }), round({ hits: 10, headshots: 4 })];
  assert.equal(summarizeProgress(history, NOW).headshotRate, 25);
});

test('best mark prefers scored rounds and keeps the unit and mode name', () => {
  const history = [
    round({ hits: 90, score: 0 }),
    round({ mode: 6, name: 'NO APTO PARA PLATAS', hits: 20, score: 4200 }),
    round({ mode: 14, name: 'Duelo dinámico', hits: 25, score: 2650 }),
  ];
  assert.deepEqual(summarizeProgress(history, NOW).best, {
    value: 4200,
    unit: 'puntos',
    name: 'NO APTO PARA PLATAS',
  });
});

test('best mark falls back to hits when no round has a score', () => {
  const history = [round({ hits: 44 }), round({ hits: 57 })];
  assert.deepEqual(summarizeProgress(history, NOW).best, {
    value: 57,
    unit: 'aciertos',
    name: 'Flick Shot',
  });
});

test('training time sums active seconds and falls back to the round duration', () => {
  const history = [
    round({ activeDuration: 42.4 }),
    round({ activeDuration: undefined, duration: 45 }),
  ];
  assert.equal(summarizeProgress(history, NOW).trainingSeconds, 87);
});

test('streak counts consecutive calendar days ending today', () => {
  const history = [
    round({ date: NOW - 2 * DAY }),
    round({ date: NOW - DAY }),
    round({ date: NOW - HOUR }),
  ];
  assert.equal(summarizeProgress(history, NOW).streakDays, 3);
});

test('streak survives until the end of the day after the last session', () => {
  const history = [round({ date: NOW - 2 * DAY }), round({ date: NOW - DAY })];
  assert.equal(summarizeProgress(history, NOW).streakDays, 2);
});

test('streak resets when the last session is older than yesterday', () => {
  const history = [round({ date: NOW - 3 * DAY }), round({ date: NOW - 2 * DAY })];
  assert.equal(summarizeProgress(history, NOW).streakDays, 0);
});

test('accuracy trend keeps the latest aim rounds in chronological order', () => {
  const history = [
    round({ accuracy: 10, date: NOW - 3 * HOUR }),
    round({ mode: 8, shots: 0, accuracy: 0, date: NOW - 2 * HOUR }),
    round({ accuracy: 30, date: NOW - HOUR }),
    round({ accuracy: 20, date: NOW - 2.5 * HOUR }),
  ];
  assert.deepEqual(
    accuracyTrend(history, 2).map((point) => point.accuracy),
    [20, 30],
  );
});

test('relative dates read like a person would say them', () => {
  assert.equal(relativeDate(NOW - 20_000, NOW), 'ahora mismo');
  assert.equal(relativeDate(NOW - 5 * 60_000, NOW), 'hace 5 minutos');
  assert.equal(relativeDate(NOW - 5 * HOUR, NOW), 'hace 5 horas');
  assert.equal(relativeDate(NOW - DAY, NOW), 'ayer');
  assert.equal(relativeDate(NOW - 3 * DAY, NOW), 'hace 3 días');
  assert.equal(relativeDate(NOW - 12 * DAY, NOW), '11 oct');
});

test('training time is formatted in hours and minutes', () => {
  assert.equal(formatTrainingTime(0), '0 min');
  assert.equal(formatTrainingTime(59), '1 min');
  assert.equal(formatTrainingTime(25 * 60), '25 min');
  assert.equal(formatTrainingTime(72 * 60), '1 h 12 min');
});
