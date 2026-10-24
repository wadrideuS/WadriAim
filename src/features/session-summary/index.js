import '../../styles/session-summary.css';
import { button, el } from '../../pages/dom.js';
import { exercises } from '../../data/exercises.js';
import { arsenal } from '../../data/weapons.js';
import { summarizeRound } from './round-stats.js';
import { compareRound } from './history-compare.js';
import { roundInsights } from './insights.js';
import {
  accuracyPanel,
  clock,
  dispersionPanel,
  heroPanel,
  insightsPanel,
  movementPanel,
  reactionPanel,
  timelinePanel,
  trendPanel,
} from './panels.js';

const MOVEMENT_MODES = [7, 8, 9];

const OUTCOME_TITLES = {
  defended: '¡Spike defendida!',
  exploded: 'DERROTA · La spike explotó',
  defused: 'Han desactivado la spike',
  eliminated: 'Equipo eliminado',
  'no-lives': 'Sin vidas · Buen intento',
  completed: '¡10 niveles completados!',
  time: 'Tiempo terminado',
};

function outcomeTitle(record) {
  if (record.early) return 'Terminada antes de tiempo';
  return (
    OUTCOME_TITLES[record.defenseOutcome] ||
    OUTCOME_TITLES[record.courseOutcome] ||
    'Entrenamiento completado'
  );
}

function header(record, stats, actions) {
  const modeName = exercises[record.mode][0];
  const head = el('div', 'summary-head');
  const titles = el('div', 'summary-titles');
  const heading = el('h1', '', outcomeTitle(record));
  heading.tabIndex = -1;
  titles.append(
    el('p', 'summary-breadcrumb', `Inicio › Entrenamiento › ${modeName} › Resumen de rendimiento`),
    el('p', 'eyebrow', `WADRIAIM · ${modeName.toUpperCase()}`),
    heading,
    el(
      'p',
      'summary-subtitle',
      `${arsenal[record.weapon]?.name ?? 'Sin arma'} · ${clock(stats.seconds)} activos`,
    ),
  );
  head.append(titles, actions);
  return { head, heading };
}

function actionBar(clear, { onReplay, onHome, onProgress }) {
  const bar = el('div', 'summary-actions');
  const then = (callback) => () => {
    clear();
    callback?.();
  };
  bar.append(
    button('▶ Jugar de nuevo', 'primary', then(onReplay)),
    button('Ver progreso ↗', 'secondary', then(onProgress)),
    button('← Volver al entrenamiento', 'summary-back', then(onHome)),
  );
  return bar;
}

function aimSections(record, stats, comparison) {
  const top = el('section', 'summary-grid summary-top');
  top.setAttribute('aria-label', 'Resultado y precisión');
  top.append(
    heroPanel(record, stats, comparison),
    accuracyPanel(record, stats),
    insightsPanel(roundInsights(record, stats, comparison)),
  );
  const charts = el('section', 'summary-grid summary-charts');
  charts.setAttribute('aria-label', 'Gráficos de la ronda');
  if (stats.timeline)
    charts.append(timelinePanel(stats), reactionPanel(stats.reaction), dispersionPanel(stats));
  charts.append(trendPanel(record, comparison));
  return [top, charts];
}

function movementSections(record, stats, comparison) {
  const top = el('section', 'summary-grid summary-top');
  top.setAttribute('aria-label', 'Resultado de la ronda');
  top.append(
    heroPanel(record, stats, comparison),
    movementPanel(record, stats),
    trendPanel(record, comparison),
  );
  return [top];
}

/**
 * End-of-round page. `shots` is the in-memory log of this round only; `history`
 * is wa-history (already including this record, which the comparison skips by date).
 */
export function showSessionSummary(
  record,
  { shots = [], history = [], onReplay, onHome, onProgress } = {},
) {
  document.querySelector('.session-summary')?.remove();
  const page = el('section', 'session-summary');
  page.setAttribute('aria-label', 'Resumen de rendimiento');
  const clear = () => {
    page.remove();
    document.body.classList.remove('show-session-summary');
  };
  const stats = summarizeRound(record, shots);
  const comparison = compareRound(record, history);
  const { head, heading } = header(
    record,
    stats,
    actionBar(clear, { onReplay, onHome, onProgress }),
  );
  const sections = MOVEMENT_MODES.includes(record.mode)
    ? movementSections(record, stats, comparison)
    : aimSections(record, stats, comparison);
  page.append(head, ...sections);
  document.body.append(page);
  document.body.classList.add('show-session-summary');
  heading.focus();
  window.scrollTo(0, 0);
  return clear;
}
