import { formatMs } from './round-stats.js';

const MAX_INSIGHTS = 3;
const MIN_SHOTS = 10;
const LOW_ACCURACY = 35;
const HIGH_ACCURACY = 85;
const MIN_BURST_MISSES = 8;
const BURST_SHARE = 0.5;
const MIN_BIAS_POINTS = 8;
const BIAS_DEGREES = 0.4;
const MIN_HEADSHOT_KILLS = 8;
const LOW_HEADSHOT_RATE = 25;
const ACCURACY_DROP = 15;
const MIN_EXPIRED = 3;
const FASTER_PERCENT = 10;
const SLOWER_PERCENT = 15;

const degrees = (value) =>
  Math.abs(value).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) +
  '°';

function lowAccuracy(record, stats) {
  if (stats.shots < MIN_SHOTS || record.accuracy >= LOW_ACCURACY) return null;
  return `Precisión baja: ${stats.misses} fallos en ${Math.round(stats.seconds)} s. Baja el ritmo y dispara cuando la mira ya esté sobre el objetivo.`;
}

function sprayMisses(stats) {
  if (stats.misses < MIN_BURST_MISSES || stats.burstShare < BURST_SHARE) return null;
  return `El ${Math.round(stats.burstShare * 100)}% de tus fallos llegaron en ráfaga (menos de 0,15 s entre disparos): suelta el gatillo entre objetivos.`;
}

function aimBias(stats) {
  const spread = stats.dispersion;
  if (!spread || spread.points.length < MIN_BIAS_POINTS) return null;
  const { x, y } = spread.mean;
  if (Math.max(Math.abs(x), Math.abs(y)) < BIAS_DEGREES) return null;
  if (Math.abs(y) >= Math.abs(x)) {
    const centre = stats.orbTargets ? 'del centro' : 'de la cabeza';
    return y < 0
      ? `Tus disparos quedan por debajo ${centre} (${degrees(y)} de media): sube un poco la altura de tu mira.`
      : `Tus disparos quedan por encima ${centre} (${degrees(y)} de media): baja un poco la altura de tu mira.`;
  }
  const side = x < 0 ? 'a la izquierda' : 'a la derecha';
  return `Tus disparos se desvían ${side} del objetivo (${degrees(x)} de media): termina el ajuste antes de disparar.`;
}

function headshotRate(record, stats) {
  if (stats.orbTargets || (record.hits || 0) < MIN_HEADSHOT_KILLS) return null;
  const rate = Math.round(((record.headshots || 0) / record.hits) * 100);
  if (rate >= LOW_HEADSHOT_RATE) return null;
  return `Solo el ${rate}% de tus bajas fueron headshots: coloca la mira a la altura de la cabeza.`;
}

function fatigue(stats) {
  const halves = stats.halves;
  if (!halves || halves.first - halves.second < ACCURACY_DROP) return null;
  return `Tu precisión cayó de ${halves.first}% a ${halves.second}% en la segunda mitad: respira y mantén el mismo ritmo hasta el final.`;
}

function expiredTargets(record) {
  if ((record.expired || 0) < MIN_EXPIRED) return null;
  return `Se te escaparon ${record.expired} objetivos por tiempo: confía antes en tu primer disparo.`;
}

function targetPace(record, comparison) {
  const mean = comparison?.averageTargetMs;
  if (!mean || !record.targetMs) return null;
  const delta = Math.round(((mean - record.targetMs) / mean) * 100);
  if (delta >= FASTER_PERCENT)
    return `Tardaste ${formatMs(record.targetMs)} por objetivo, un ${delta}% más rápido que tu media.`;
  if (-delta >= SLOWER_PERCENT)
    return `Tardaste ${formatMs(record.targetMs)} por objetivo, un ${-delta}% más lento que tu media (${formatMs(mean)}).`;
  return null;
}

function highAccuracy(record, stats) {
  if (stats.shots < MIN_SHOTS || record.accuracy < HIGH_ACCURACY) return null;
  return `Precisión de ${record.accuracy}%: tienes margen para disparar más rápido.`;
}

/** Up to three short, actionable lines, most important first. Only rules backed by this round's data. */
export function roundInsights(record, stats, comparison) {
  return [
    lowAccuracy(record, stats),
    sprayMisses(stats),
    aimBias(stats),
    headshotRate(record, stats),
    fatigue(stats),
    expiredTargets(record),
    targetPace(record, comparison),
    highAccuracy(record, stats),
  ]
    .filter(Boolean)
    .slice(0, MAX_INSIGHTS);
}
