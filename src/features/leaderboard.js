import { exercises } from '../data/exercises.js';
import { rankFor } from '../data/ranks.js';
import { teamById } from '../data/vct-teams.js';
import { teamBadge } from '../account/preferences.js';
import { getLeaderboard, getTeamLeaderboard, humanError } from '../account/service.js';

/** Missing SQL functions mean leaderboards.sql was not run yet. */
const explain = (error) =>
  /could not find the function|schema cache|PGRST202/i.test(error?.message || '')
    ? 'Falta activarlo en Supabase: ejecuta supabase/queries/leaderboards.sql en el SQL Editor.'
    : humanError(error);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function rankBadge(mode, score) {
  const rank = rankFor(mode, score);
  const badge = el('span', 'rank-badge', rank.label);
  badge.style.setProperty('--rank', rank.color);
  return badge;
}

/** "Ranking" page: best score per player and mode, with ranks, plus team points. */
export function installLeaderboard(root, { account } = {}) {
  root.innerHTML = '';
  const head = el('div', 'section-head');
  const titleBox = el('div');
  titleBox.append(el('div', 'eyebrow', 'COMUNIDAD WADRIAIM'));
  const title = el('h2', '', 'Ranking global');
  title.id = 'ranking-title';
  titleBox.append(title);
  head.append(titleBox, el('p', '', 'La mejor marca de cada jugador. Las rondas sin límite de tiempo o con munición infinita no cuentan.'));
  const layout = el('div', 'ranking-layout');
  const board = el('article', 'ranking-board');
  const tabs = el('div', 'ranking-modes');
  tabs.setAttribute('role', 'tablist');
  const status = el('p', 'ranking-status');
  status.setAttribute('role', 'status');
  const table = el('table', 'ranking-table');
  const mine = el('div', 'ranking-me');
  board.append(tabs, status, table, mine);
  const teams = el('article', 'team-board');
  teams.append(el('h3', '', 'Top equipos'), el('p', 'team-note', 'Cada jugador que elige un equipo le suma +1 punto.'));
  const teamList = el('ol', 'team-list');
  teams.append(teamList);
  layout.append(board, teams);
  root.append(head, layout);

  let mode = 1;
  let token = 0;
  exercises.forEach(([name], i) => {
    const tab = el('button', '', name);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.dataset.mode = i;
    tab.onclick = () => {
      mode = i;
      load();
    };
    tabs.append(tab);
  });

  function row(entry) {
    const tr = el('tr', entry.me ? 'is-me' : '');
    const team = teamById(entry.team);
    const teamCell = el('td', 'team-cell');
    if (team) teamCell.append(teamBadge(team, 'team-badge mini'));
    tr.append(
      el('td', 'pos', '#' + entry.position),
      el('td', 'player', '@' + entry.username),
      teamCell,
    );
    const rankCell = el('td');
    rankCell.append(rankBadge(mode, Number(entry.score)));
    tr.append(rankCell, el('td', 'score', String(entry.score)), el('td', 'acc', entry.accuracy == null ? '—' : entry.accuracy + '%'));
    return tr;
  }

  async function load() {
    const current = ++token;
    tabs.querySelectorAll('button').forEach((b) => {
      const on = Number(b.dataset.mode) === mode;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-selected', String(on));
    });
    status.textContent = 'Cargando ranking…';
    table.replaceChildren();
    mine.replaceChildren();
    try {
      const data = await getLeaderboard(mode, 50);
      if (current !== token) return;
      const unit = [2, 6, 7, 8, 9, 11, 12, 13].includes(mode) ? 'Puntos' : 'Aciertos';
      const thead = el('thead');
      const hr = el('tr');
      for (const h of ['#', 'Jugador', 'Equipo', 'Rango', unit, 'Precisión']) hr.append(el('th', '', h));
      thead.append(hr);
      const body = el('tbody');
      (data.rows || []).forEach((entry) => body.append(row(entry)));
      table.append(thead, body);
      status.textContent = data.rows?.length
        ? `${data.players} jugadores con marca en ${exercises[mode][0]}.`
        : account
          ? 'Todavía nadie tiene marca en este modo. ¡Juega una ronda y sé el primero!'
          : 'Inicia sesión para aparecer en el ranking.';
      if (data.me && !data.rows.some((r) => r.me)) {
        mine.append(el('span', '', 'Tu posición'));
        const t = el('table', 'ranking-table');
        const b = el('tbody');
        b.append(row(data.me));
        t.append(b);
        mine.append(t);
      }
    } catch (error) {
      if (current === token) status.textContent = 'El ranking no está disponible. ' + explain(error);
    }
  }

  async function loadTeams() {
    teamList.replaceChildren(el('li', 'team-loading', 'Cargando…'));
    try {
      const rows = await getTeamLeaderboard();
      teamList.replaceChildren();
      if (!rows.length) teamList.append(el('li', 'team-loading', 'Aún no hay equipos elegidos.'));
      const top = rows[0]?.points || 1;
      rows.slice(0, 20).forEach((entry, i) => {
        const team = teamById(entry.team);
        const li = el('li', 'team-row' + (account?.profile.favorite_team === entry.team ? ' is-me' : ''));
        li.style.setProperty('--team-color', team?.color || '#888');
        li.style.setProperty('--share', Math.round((entry.points / top) * 100) + '%');
        li.append(el('span', 'pos', String(i + 1)));
        if (team) li.append(teamBadge(team, 'team-badge mini'));
        li.append(el('strong', '', team?.name || entry.team), el('span', 'points', `+${entry.points}`));
        teamList.append(li);
      });
    } catch (error) {
      teamList.replaceChildren(el('li', 'team-loading', 'No disponible. ' + explain(error)));
    }
  }

  return {
    show() {
      load();
      loadTeams();
    },
  };
}
