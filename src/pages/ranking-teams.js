import { el } from './dom.js';
import { teamById } from '../data/vct-teams.js';
import { teamBadge } from '../account/preferences.js';

const TOP_TEAMS = 20;

/** Side board: VCT teams ranked by players who picked them (+1 each). */
export function installTeamBoard({ account, api, explain }) {
  const root = el('aside', 'team-board');
  root.setAttribute('aria-labelledby', 'team-board-title');
  const title = el('h3', '', 'Top equipos');
  title.id = 'team-board-title';
  const list = el('ol', 'team-list');
  root.append(
    title,
    el('p', 'team-note', 'Cada jugador que elige un equipo le suma +1 punto.'),
    list,
  );
  const message = (text) => list.replaceChildren(el('li', 'team-loading', text));

  async function load() {
    if (!api.hasServer) return message('Necesita conexión con el servidor.');
    message('Cargando…');
    try {
      const rows = await api.getTeamLeaderboard();
      if (!rows.length) return message('Aún no hay equipos elegidos.');
      const top = rows[0].points || 1;
      list.replaceChildren(
        ...rows.slice(0, TOP_TEAMS).map((entry, i) => {
          const team = teamById(entry.team);
          const mine = account?.profile.favorite_team === entry.team;
          const row = el('li', 'team-row' + (mine ? ' is-me' : ''));
          row.style.setProperty('--team-color', team?.color || '#888');
          row.style.setProperty('--share', Math.round((entry.points / top) * 100) + '%');
          row.append(el('span', 'pos', String(i + 1)));
          if (team) row.append(teamBadge(team, 'team-badge mini'));
          row.append(
            el('strong', '', team?.name || entry.team),
            el('span', 'points', `+${entry.points}`),
          );
          return row;
        }),
      );
    } catch (error) {
      message('No disponible. ' + explain(error));
    }
  }
  return { root, load };
}
