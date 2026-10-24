const TRACKING_MODE = 2;
const DAY_MS = 86_400_000;
const RECENT_DAYS = 7;
const relativeFormat = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const number = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
const average = (values) =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const startOfDay = (time) => {
  const day = new Date(time);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
};
const daysBetween = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);

/**
 * Movement rounds have no shots and report 0 % accuracy; counting them would
 * hide real aim progress. Old records lack `shots`, so their accuracy decides.
 */
export function isAimRound(round) {
  if (round.mode === TRACKING_MODE) return true;
  if (round.shots == null) return number(round.accuracy) > 0;
  return number(round.shots) > 0;
}

function bestMark(history) {
  const scored = history.filter((round) => number(round.score) > 0);
  const pool = scored.length ? scored : history.filter((round) => number(round.hits) > 0);
  if (!pool.length) return null;
  const field = scored.length ? 'score' : 'hits';
  const top = pool.reduce((best, round) =>
    number(round[field]) > number(best[field]) ? round : best,
  );
  return { value: number(top[field]), unit: scored.length ? 'puntos' : 'aciertos', name: top.name };
}

function streakDays(history, now) {
  const days = new Set(history.map((round) => startOfDay(number(round.date))));
  let cursor = startOfDay(now);
  if (!days.has(cursor)) cursor = startOfDay(cursor - DAY_MS / 2);
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = startOfDay(cursor - DAY_MS / 2);
  }
  return streak;
}

/** Overall numbers for the "Mi progreso" header, using only what each round recorded. */
export function summarizeProgress(history = [], now = Date.now()) {
  const aimRounds = history.filter(isAimRound);
  const hits = history.reduce((sum, round) => sum + number(round.hits), 0);
  const headshots = history.reduce((sum, round) => sum + number(round.headshots), 0);
  return {
    sessions: history.length,
    averageAccuracy: average(aimRounds.map((round) => Math.min(100, number(round.accuracy)))),
    headshotRate: hits ? Math.round((headshots / hits) * 100) : null,
    best: bestMark(history),
    streakDays: streakDays(history, now),
    trainingSeconds: Math.round(
      history.reduce((sum, round) => sum + number(round.activeDuration ?? round.duration), 0),
    ),
  };
}

/** Latest aim rounds, oldest first, ready to plot. */
export function accuracyTrend(history = [], limit = 20) {
  return history
    .filter(isAimRound)
    .toSorted((a, b) => number(a.date) - number(b.date))
    .slice(-limit)
    .map((round) => ({
      accuracy: Math.min(100, number(round.accuracy)),
      date: number(round.date),
      name: round.name,
    }));
}

export function relativeDate(time, now = Date.now()) {
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 60) return 'ahora mismo';
  const days = daysBetween(time, now);
  if (days === 0) {
    const minutes = Math.round(seconds / 60);
    return minutes < 60
      ? relativeFormat.format(-minutes, 'minute')
      : relativeFormat.format(-Math.round(minutes / 60), 'hour');
  }
  if (days < RECENT_DAYS) return relativeFormat.format(-days, 'day');
  return new Date(time)
    .toLocaleDateString('es', { day: 'numeric', month: 'short' })
    .replace('.', '');
}

export function formatTrainingTime(seconds) {
  const minutes = Math.ceil(number(seconds) / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}
