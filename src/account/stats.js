import { exercises } from '../data/exercises.js';
export function summarizeHistory(history = []) {
  const number = (value) => (Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  return exercises.map((exercise, mode) => {
    const rounds = history.filter(
      (round) => round.mode === mode || (round.mode == null && round.name === exercise[0]),
    );
    return {
      mode,
      name: exercise[0],
      sessions: rounds.length,
      best: Math.max(0, ...rounds.map((round) => number(round.score) || number(round.hits))),
      hits: rounds.reduce((sum, r) => sum + number(r.hits), 0),
      headshots: rounds.reduce((sum, r) => sum + number(r.headshots), 0),
      accuracy: rounds.length
        ? Math.round(
            rounds.reduce((sum, r) => sum + Math.min(100, number(r.accuracy)), 0) / rounds.length,
          )
        : 0,
    };
  });
}
export function statsTable(rows, other = null) {
  const table = document.createElement('table');
  table.className = 'profile-stat-table';
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  const labels = other
    ? ['Modo', 'Tu récord', 'Su récord', 'Tus HS', 'Sus HS']
    : ['Modo', 'Sesiones', 'Récord', 'HS', '% HS', 'Precisión media'];
  for (const label of labels) {
    const cell = document.createElement('th');
    cell.textContent = label;
    header.append(cell);
  }
  head.append(header);
  table.append(head);
  const body = document.createElement('tbody');
  rows.forEach((item, i) => {
    const row = document.createElement('tr');
    const values = other
      ? [item.name, item.best, other[i]?.best || 0, item.headshots, other[i]?.headshots || 0]
      : [
          item.name,
          item.sessions,
          item.best,
          item.headshots,
          item.hits ? Math.round(item.headshots / item.hits * 100) + '%' : '—',
          item.sessions ? item.accuracy + '%' : '—',
        ];
    for (const value of values) {
      const cell = document.createElement('td');
      cell.textContent = String(value);
      row.append(cell);
    }
    body.append(row);
  });
  table.append(body);
  return table;
}
