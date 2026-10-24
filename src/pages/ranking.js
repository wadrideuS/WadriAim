import '../styles/ranking.css';
import { button, el, formatNumber, pageHead } from './dom.js';
import { installTeamBoard } from './ranking-teams.js';
import { exercises } from '../data/exercises.js';
import { rankFor } from '../data/ranks.js';
import { teamById } from '../data/vct-teams.js';
import { teamBadge } from '../account/preferences.js';
import { getLeaderboard, getTeamLeaderboard, humanError, supabase } from '../account/service.js';
import { connectionState, rankingRows, scoreUnit } from '../features/ranking-model.js';

const DEFAULT_MODE = 1;
const SKELETON_ROWS = 5;
const MAX_ROWS = 50;

/** Missing SQL functions mean leaderboards.sql was not run yet. */
const explainRankingError = (error) =>
  /could not find the function|schema cache|PGRST202/i.test(error?.message || '')
    ? 'Falta activar el ranking en el servidor (supabase/queries/leaderboards.sql).'
    : humanError(error);

function rankBadge(mode, score) {
  const rank = rankFor(mode, score);
  const badge = el('span', 'rank-badge', rank.label);
  badge.style.setProperty('--rank', rank.color);
  return badge;
}

function playerRow(entry, mode) {
  const row = el(
    'tr',
    [entry.isMe && 'is-me', entry.podium && 'podium-' + entry.podium].filter(Boolean).join(' '),
  );
  const position = el('td', 'pos');
  position.append(el('span', 'pos-chip', String(entry.position)));
  const player = el('th', 'player');
  player.scope = 'row';
  player.append(el('span', '', '@' + entry.username));
  if (entry.isMe) player.append(el('span', 'me-tag', 'Tú'));
  const team = el('td', 'team-cell');
  const club = teamById(entry.team);
  if (club) team.append(teamBadge(club, 'team-badge mini'));
  const rank = el('td', 'rank-cell');
  rank.append(rankBadge(mode, Number(entry.score)));
  row.append(
    position,
    player,
    team,
    rank,
    el('td', 'num score', formatNumber(entry.score)),
    el('td', 'num', entry.accuracy == null ? '—' : entry.accuracy + '%'),
  );
  return row;
}

function tableHead(mode) {
  const thead = el('thead');
  const row = el('tr');
  ['#', 'Jugador', 'Equipo', 'Rango', scoreUnit(mode), 'Precisión'].forEach((label, i) => {
    const cell = el('th', i === 0 || i > 3 ? 'num' : '', label);
    cell.scope = 'col';
    row.append(cell);
  });
  thead.append(row);
  return thead;
}

function skeleton() {
  const body = el('tbody', 'skeleton');
  body.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < SKELETON_ROWS; i++) {
    const row = el('tr');
    for (let c = 0; c < 6; c++) row.append(el('td', '', '\u00a0'));
    body.append(row);
  }
  return body;
}

function notice(title, text, action = null) {
  const box = el('div', 'ranking-notice');
  box.append(el('strong', '', title), el('p', '', text));
  if (action) box.append(action);
  return box;
}

const serverApi = {
  hasServer: Boolean(supabase),
  getLeaderboard,
  getTeamLeaderboard,
};

/**
 * "Ranking" page: best mark per player and mode, with ranks, plus team points.
 * `api` defaults to Supabase; passing another one lets the page run without a server.
 */
export function installRankingPage(root, { account, api = serverApi } = {}) {
  const tabs = el('div', 'ranking-modes');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Modo de juego');
  const panel = el('div', 'ranking-panel');
  panel.id = 'ranking-panel';
  panel.setAttribute('role', 'tabpanel');
  const status = el('p', 'ranking-status');
  status.setAttribute('role', 'status');
  const body = el('div', 'ranking-body');
  panel.append(status, body);
  const board = el('article', 'ranking-board');
  board.append(tabs, panel);
  const guestNote = el(
    'p',
    'ranking-guest',
    'Juegas como invitado: puedes ver el ranking, pero tus rondas no entran. Inicia sesión desde Mi perfil para competir.',
  );
  guestNote.hidden = true;
  board.append(guestNote);
  const teams = installTeamBoard({ account, api, explain: explainRankingError });
  const layout = el('div', 'ranking-layout');
  layout.append(board, teams.root);
  root.replaceChildren(
    pageHead({
      eyebrow: 'COMUNIDAD WADRIAIM',
      title: 'Ranking global',
      titleId: 'ranking-title',
      lead: 'La mejor marca de cada jugador por modo. Las rondas sin límite de tiempo o con munición infinita no cuentan.',
    }),
    layout,
  );

  let mode = DEFAULT_MODE;
  let token = 0;
  const tabButtons = exercises.map(([name], i) => {
    const tab = button(name);
    tab.id = 'ranking-tab-' + i;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.onclick = () => select(i);
    tabs.append(tab);
    return tab;
  });
  tabs.onkeydown = (event) => {
    const moves = {
      ArrowRight: mode + 1,
      ArrowLeft: mode - 1,
      Home: 0,
      End: tabButtons.length - 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select((moves[event.key] + tabButtons.length) % tabButtons.length, { focus: true });
  };

  function select(next, { focus = false } = {}) {
    mode = next;
    tabButtons.forEach((tab, i) => {
      const selected = i === mode;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    if (focus) tabButtons[mode].focus();
    panel.setAttribute('aria-labelledby', tabButtons[mode].id);
    load();
  }

  const retry = () => button('Reintentar', 'secondary', () => load());

  function renderTable(data) {
    const { rows, pinnedMe, players } = rankingRows(data);
    const modeName = exercises[mode][0];
    if (!rows.length) {
      status.textContent = '';
      body.replaceChildren(
        notice(
          `Nadie tiene marca en ${modeName} todavía`,
          account
            ? 'Juega una ronda de este modo y estrena el podio.'
            : 'Crea una cuenta, juega una ronda y estrena el podio.',
        ),
      );
      return;
    }
    status.textContent = `${formatNumber(players)} ${players === 1 ? 'jugador' : 'jugadores'} con marca en ${modeName}.`;
    const table = el('table', 'ranking-table');
    table.append(el('caption', 'sr-only', `Ranking de ${modeName}`), tableHead(mode));
    const list = el('tbody');
    rows.forEach((entry) => list.append(playerRow(entry, mode)));
    table.append(list);
    if (pinnedMe) {
      const mine = el('tbody', 'ranking-pinned');
      mine.append(playerRow(pinnedMe, mode));
      table.append(mine);
    }
    body.replaceChildren(table);
    if (account && !pinnedMe && !rows.some((row) => row.isMe))
      body.append(
        el(
          'p',
          'ranking-hint',
          'Aún no tienes marca en este modo. Termina una ronda con tiempo y munición normales para entrar.',
        ),
      );
  }

  async function load() {
    const current = ++token;
    const state = connectionState({ hasServer: api.hasServer, isOnline: navigator.onLine });
    guestNote.hidden = Boolean(account) || state !== 'ready';
    if (state === 'no-server') {
      status.textContent = '';
      body.replaceChildren(
        notice(
          'El ranking necesita conexión',
          'Esta versión de WadriAim no está conectada al servidor, así que no hay marcas globales que mostrar. Tu progreso sigue guardado en Mi progreso.',
        ),
      );
      return;
    }
    if (state === 'offline') {
      status.textContent = '';
      body.replaceChildren(
        notice(
          'Sin conexión a internet',
          'El ranking vuelve en cuanto te conectes. Mientras tanto, puedes seguir entrenando.',
          retry(),
        ),
      );
      return;
    }
    status.textContent = `Cargando ranking de ${exercises[mode][0]}…`;
    panel.setAttribute('aria-busy', 'true');
    const table = el('table', 'ranking-table is-loading');
    table.append(tableHead(mode), skeleton());
    body.replaceChildren(table);
    try {
      const data = await api.getLeaderboard(mode, MAX_ROWS);
      if (current === token) renderTable(data);
    } catch (error) {
      if (current !== token) return;
      status.textContent = '';
      body.replaceChildren(
        notice('No pudimos cargar el ranking', explainRankingError(error), retry()),
      );
    } finally {
      if (current === token) panel.removeAttribute('aria-busy');
    }
  }

  const reconnect = () => {
    if (!root.hidden) load();
  };
  window.addEventListener('online', reconnect);
  return {
    show() {
      select(mode);
      teams.load();
    },
    dispose() {
      window.removeEventListener('online', reconnect);
    },
  };
}
