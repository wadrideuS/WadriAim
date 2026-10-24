const POINT_MODES = new Set([2, 6, 7, 8, 9, 11, 12, 13]);
const PODIUM_SIZE = 3;

export const scoreUnit = (mode) => (POINT_MODES.has(mode) ? 'Puntos' : 'Aciertos');

/** Why the ranking can or cannot load: no Supabase project, no network, or ready. */
export function connectionState({ hasServer, isOnline }) {
  if (!hasServer) return 'no-server';
  if (!isOnline) return 'offline';
  return 'ready';
}

const decorate = (entry) => ({
  ...entry,
  isMe: Boolean(entry.me),
  podium: entry.position <= PODIUM_SIZE ? entry.position : null,
});

/** Table rows from global_leaderboard(), plus my row when it falls outside the list. */
export function rankingRows(data) {
  const rows = (data?.rows || [])
    .map(decorate)
    .toSorted((a, b) => a.position - b.position || a.username.localeCompare(b.username));
  const me = data?.me && !rows.some((row) => row.isMe) ? decorate(data.me) : null;
  return { rows, pinnedMe: me, players: Number(data?.players) || 0 };
}
