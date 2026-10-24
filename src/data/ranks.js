/**
 * Game-style competitive ranks for leaderboard scores. Each mode has a
 * "Radiante" mark; the rank is the share of that mark you reach.
 */
export const rankTiers = [
  { name: 'Hierro', color: '#6f6f73' },
  { name: 'Bronce', color: '#a8794a' },
  { name: 'Plata', color: '#b8c0c8' },
  { name: 'Oro', color: '#e5b94a' },
  { name: 'Platino', color: '#3fb4c6' },
  { name: 'Diamante', color: '#c48cf5' },
  { name: 'Ascendente', color: '#2fbf71' },
  { name: 'Inmortal', color: '#e0465f' },
  { name: 'Radiante', color: '#fff3a8' },
];
// Radiante mark per mode (same units the mode shows: aciertos o puntos).
export const radiantMarks = [125, 85, 5400, 95, 60, 110, 16000, 4500, 4500, 6000, 70, 1300, 9000, 4200, 75];

/** Returns {name, tier, color, label} for a score in a mode. */
export function rankFor(mode, score, best = 0) {
  const mark = radiantMarks[mode] || Math.max(best, 1);
  const ratio = Math.max(0, score) / mark;
  if (ratio >= 1) return { ...rankTiers[8], tier: 0, label: 'Radiante' };
  // 8 ranks × 3 divisions spread over 0 … 100 % of the mark
  const step = Math.min(23, Math.floor(ratio * 24));
  const rank = rankTiers[Math.floor(step / 3)];
  const tier = (step % 3) + 1;
  return { ...rank, tier, label: `${rank.name} ${tier}` };
}
