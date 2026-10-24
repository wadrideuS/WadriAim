import '../styles/progress.css';
import { button, el, formatNumber, pageHead } from './dom.js';
import { accuracyChart } from './progress-chart.js';
import { summarizeHistory } from '../account/stats.js';
import { scoreUnit } from '../features/ranking-model.js';
import {
  accuracyTrend,
  formatTrainingTime,
  isAimRound,
  relativeDate,
  summarizeProgress,
} from '../features/progress-summary.js';

const RECENT_ROUNDS = 10;
const TREND_ROUNDS = 20;

function kpi(label, value, detail = '') {
  const item = el('div', 'kpi');
  const term = el('dt', '', label);
  const data = el('dd');
  data.append(el('strong', '', value));
  if (detail) data.append(el('span', '', detail));
  item.append(term, data);
  return item;
}

function summaryCards(summary) {
  const list = el('dl', 'progress-kpis');
  const percent = (value) => (value == null ? '—' : value + '%');
  list.append(
    kpi(
      'Sesiones',
      formatNumber(summary.sessions),
      formatTrainingTime(summary.trainingSeconds) + ' entrenando',
    ),
    kpi('Precisión media', percent(summary.averageAccuracy), 'En rondas con disparo'),
    kpi('Headshots', percent(summary.headshotRate), 'De tus aciertos'),
    kpi(
      'Mejor marca',
      summary.best ? formatNumber(summary.best.value) : '—',
      summary.best ? `${summary.best.unit} · ${summary.best.name}` : '',
    ),
    kpi(
      'Racha',
      summary.streakDays === 1 ? '1 día' : summary.streakDays + ' días',
      summary.streakDays ? 'Seguidos entrenando' : 'Entrena hoy para empezarla',
    ),
  );
  return list;
}

function trendPanel(history) {
  const panel = el('article', 'progress-panel progress-trend');
  const points = accuracyTrend(history, TREND_ROUNDS);
  panel.append(el('h3', '', 'Evolución de tu precisión'));
  if (points.length < 2) {
    panel.append(
      el('p', 'panel-note', 'Juega una ronda más con disparo y aquí verás tu tendencia.'),
    );
    return panel;
  }
  const average = Math.round(points.reduce((sum, p) => sum + p.accuracy, 0) / points.length);
  panel.append(
    el(
      'p',
      'panel-note',
      `Tus últimas ${points.length} rondas con disparo, de la más antigua a la más reciente.`,
    ),
  );
  panel.append(accuracyChart(points, average), trendFacts(points));
  return panel;
}

function trendFacts(points) {
  const first = points[0].accuracy;
  const last = points.at(-1).accuracy;
  const change = last - first;
  const facts = el('dl', 'trend-facts');
  [
    ['Primera ronda', first + '%'],
    ['Última ronda', last + '%'],
    ['Cambio', (change > 0 ? '+' : '') + change + ' pts'],
  ].forEach(([label, value]) => {
    const item = el('div');
    item.append(el('dt', '', label), el('dd', '', value));
    facts.append(item);
  });
  facts.lastChild.classList.toggle('is-up', change > 0);
  return facts;
}

function modesPanel(history) {
  const panel = el('article', 'progress-panel progress-modes');
  panel.append(el('h3', '', 'Por modo'));
  const list = el('ul', 'mode-list');
  summarizeHistory(history)
    .filter((mode) => mode.sessions)
    .toSorted((a, b) => b.sessions - a.sessions)
    .forEach((mode) => {
      const item = el('li', 'mode-row');
      item.style.setProperty('--accuracy', mode.accuracy + '%');
      const name = el('div', 'mode-name');
      name.append(
        el('strong', '', mode.name),
        el(
          'span',
          '',
          `${mode.sessions} ${mode.sessions === 1 ? 'sesión' : 'sesiones'} · récord ${formatNumber(mode.best)} ${scoreUnit(mode.mode).toLowerCase()}`,
        ),
      );
      const accuracy = el('span', 'mode-accuracy', mode.accuracy ? mode.accuracy + '%' : '—');
      accuracy.title = 'Precisión media';
      item.append(name, accuracy, el('span', 'mode-bar'));
      list.append(item);
    });
  panel.append(list);
  return panel;
}

function historyRow(round) {
  const row = el('tr');
  const mode = el('th', '', round.name);
  mode.scope = 'row';
  const when = el('td', 'when');
  const time = el('time', '', relativeDate(round.date));
  time.dateTime = new Date(round.date).toISOString();
  time.title = new Date(round.date).toLocaleString('es');
  when.append(time);
  const aim = isAimRound(round);
  const result = round.score
    ? `${formatNumber(round.score)} pts`
    : `${formatNumber(round.hits || 0)} aciertos`;
  row.append(
    mode,
    when,
    el('td', 'num', result),
    el('td', 'num', aim ? Math.min(100, round.accuracy || 0) + '%' : '—'),
    el('td', 'num', aim ? String(round.headshots || 0) : '—'),
  );
  return row;
}

function historyPanel(history) {
  const panel = el('article', 'progress-panel progress-history');
  const newest = history.toSorted((a, b) => b.date - a.date);
  const head = el('div', 'panel-head');
  head.append(el('h3', '', 'Historial reciente'));
  const table = el('table', 'history-table');
  const caption = el('caption', 'sr-only', 'Tus rondas, de la más reciente a la más antigua');
  const thead = el('thead');
  const headRow = el('tr');
  ['Modo', 'Cuándo', 'Resultado', 'Precisión', 'HS'].forEach((label, i) => {
    const cell = el('th', i > 1 ? 'num' : '', label);
    cell.scope = 'col';
    headRow.append(cell);
  });
  thead.append(headRow);
  const body = el('tbody');
  const paint = (rows) => body.replaceChildren(...rows.map(historyRow));
  paint(newest.slice(0, RECENT_ROUNDS));
  table.append(caption, thead, body);
  if (newest.length > RECENT_ROUNDS) {
    const toggle = button(`Ver las ${newest.length} rondas`, 'secondary');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.onclick = () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      paint(expanded ? newest.slice(0, RECENT_ROUNDS) : newest);
      toggle.setAttribute('aria-expanded', String(!expanded));
      toggle.textContent = expanded ? `Ver las ${newest.length} rondas` : 'Ver menos';
    };
    head.append(toggle);
  }
  panel.append(head, table);
  return panel;
}

function emptyState(onTrain) {
  const box = el('div', 'progress-empty');
  box.append(
    el('span', 'empty-mark', '⌖'),
    el('h3', '', 'Tu primera sesión te espera'),
    el(
      'p',
      '',
      'Termina un ejercicio y aquí verás tu precisión, tus headshots y cómo mejoras ronda a ronda.',
    ),
    button('Elegir un ejercicio ↗', 'primary', onTrain),
  );
  return box;
}

/** "Mi progreso": summary, accuracy trend, per-mode breakdown and recent rounds from wa-history. */
export function installProgressPage(root, { getHistory, onTrain }) {
  return {
    show() {
      const history = getHistory();
      const head = pageHead({
        eyebrow: 'TU EVOLUCIÓN',
        title: 'Mi progreso',
        titleId: 'progress-title',
        lead: 'Cada ronda que terminas cuenta aquí. Solo mostramos lo que jugaste.',
      });
      if (!history.length) {
        root.replaceChildren(head, emptyState(onTrain));
        return;
      }
      const grid = el('div', 'progress-grid');
      grid.append(trendPanel(history), modesPanel(history));
      root.replaceChildren(
        head,
        summaryCards(summarizeProgress(history)),
        grid,
        historyPanel(history),
      );
    },
  };
}
