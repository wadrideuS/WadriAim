import { isAimRound } from '../progress-summary.js';

const MOVEMENT_MODES = [7, 8, 9];
const TRACKING_MODE = 2;
const TREND_ROUNDS = 10;
/** Below this difference the round reads as "on your average", not up or down. */
const EVEN_PERCENT = 3;

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const average = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** The big number of a round: points when the mode scores them, otherwise kills. */
export function primaryMetric(round) {
  if (MOVEMENT_MODES.includes(round.mode) || number(round.score) > 0)
    return { value: number(round.score), unit: 'puntos' };
  if (round.mode === TRACKING_MODE)
    return { value: number(round.hits), unit: 'puntos de tracking' };
  return { value: number(round.hits), unit: 'impactos' };
}

const isComplete = (round) => !round.early && !round.endless;
const sameRules = (round, current) =>
  round.mode === current.mode && (round.ammoMode ?? 'reload') === (current.ammoMode ?? 'reload');

function incompleteText(record) {
  if (record.endless)
    return 'Ronda sin límite de tiempo: no se compara con tus rondas cronometradas.';
  const played = Math.round(number(record.activeDuration));
  return `Ronda incompleta: ${played} s de ${number(record.duration)} s. No se compara con tus rondas completas.`;
}

function verdictFor(record, value, unit, pool, best, mean) {
  if (!isComplete(record)) return { tone: 'incomplete', text: incompleteText(record) };
  if (!pool.length)
    return { tone: 'first', text: 'Primera ronda completa en este modo: ahora es tu referencia.' };
  if (value > best) return { tone: 'best', text: `Mejor marca en ${record.name} (antes ${best}).` };
  const delta = mean ? Math.round(((value - mean) / mean) * 100) : 0;
  const reference = `tu media (${Math.round(mean)} ${unit})`;
  if (Math.abs(delta) < EVEN_PERCENT) return { tone: 'even', text: `En ${reference}.` };
  return delta > 0
    ? { tone: 'up', text: `+${delta}% sobre ${reference}.` }
    : { tone: 'down', text: `${delta}% bajo ${reference}.`.replace('-', '−') };
}

/**
 * Compares a round with the previous complete rounds of the same mode and ammo rules.
 * Early or endless rounds get no percentage: they are not the same test.
 */
export function compareRound(record, history = [], { limit = TREND_ROUNDS } = {}) {
  const pool = history
    .filter((round) => round.date < record.date && sameRules(round, record) && isComplete(round))
    .toSorted((a, b) => a.date - b.date)
    .slice(-limit);
  const { value, unit } = primaryMetric(record);
  const values = pool.map((round) => primaryMetric(round).value);
  const best = values.length ? Math.max(...values) : null;
  const mean = average(values);
  const comparable = isComplete(record) && pool.length > 0 && mean > 0;
  const aimPool = pool.filter(isAimRound);
  const timedPool = pool.filter((round) => number(round.targetMs) > 0);
  return {
    pool,
    value,
    unit,
    best,
    average: mean,
    deltaPct: comparable ? Math.round(((value - mean) / mean) * 100) : null,
    averageAccuracy: aimPool.length
      ? Math.round(average(aimPool.map((round) => Math.min(100, number(round.accuracy)))))
      : null,
    averageTargetMs: timedPool.length
      ? Math.round(average(timedPool.map((round) => number(round.targetMs))))
      : null,
    verdict: verdictFor(record, value, unit, pool, best, mean),
  };
}
