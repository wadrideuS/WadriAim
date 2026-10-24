import { el, formatNumber } from '../../pages/dom.js';
import { isAimRound } from '../progress-summary.js';
import { accuracyGauge, timelineChart } from './charts-round.js';
import { dispersionChart, reactionChart, trendChart } from './charts-detail.js';
import { primaryMetric } from './history-compare.js';
import { formatMs } from './round-stats.js';

const TRACKING_MODE = 2;

export const clock = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

function card(title, className = '') {
  const node = el('article', `summary-card ${className}`.trim());
  node.append(el('h2', '', title));
  return node;
}

function facts(rows) {
  const list = el('dl', 'summary-facts');
  for (const [term, value] of rows) {
    const item = el('div');
    item.append(el('dt', '', term), el('dd', '', String(value)));
    list.append(item);
  }
  return list;
}

const note = (text) => el('p', 'summary-note', text);

function earlyAccuracyNote(record, comparison) {
  if (
    comparison.verdict.tone !== 'incomplete' ||
    !isAimRound(record) ||
    comparison.averageAccuracy == null
  )
    return null;
  return `La precisión sí es comparable: ${record.accuracy}% en esta ronda, ${comparison.averageAccuracy}% de media en tus rondas completas.`;
}

/** Big result, verdict against your history and the four numbers that explain it. */
export function heroPanel(record, stats, comparison) {
  const hero = el('article', 'summary-card summary-hero');
  hero.dataset.tone = comparison.verdict.tone;
  const { value, unit } = primaryMetric(record);
  const result = el('p', 'summary-result');
  result.append(el('strong', '', formatNumber(value)), el('span', '', unit));
  hero.append(
    el('h2', 'sr-only', 'Resultado'),
    result,
    el('p', 'summary-verdict', comparison.verdict.text),
  );
  const early = earlyAccuracyNote(record, comparison);
  if (early) hero.append(note(early));
  const rows = stats.shots
    ? [
        ['Disparos', formatNumber(stats.shots)],
        ['Fallos', formatNumber(stats.misses)],
        [
          'Bajas por segundo',
          stats.killsPerSecond.toLocaleString('es', { maximumFractionDigits: 2 }),
        ],
        ['Tiempo activo', clock(stats.seconds)],
      ]
    : [['Tiempo activo', clock(stats.seconds)]];
  hero.append(facts(rows));
  return hero;
}

export function accuracyPanel(record, stats) {
  const panel = card('Precisión', 'summary-accuracy');
  const showHeadshots = !stats.orbTargets && record.hits > 0;
  const body = el('div', 'summary-gauge');
  body.append(
    accuracyGauge({
      accuracy: Math.min(100, record.accuracy || 0),
      headshotRate: stats.headshotRate,
      showHeadshots,
    }),
  );
  const rows =
    record.mode === TRACKING_MODE
      ? [['Sobre el objetivo', `${record.accuracy}% del tiempo`]]
      : [
          [
            'Aciertos',
            `${formatNumber(record.hits || 0)} de ${formatNumber(stats.shots)} disparos`,
          ],
        ];
  if (showHeadshots)
    rows.push([
      'Headshots',
      `${stats.headshotRate}% · ${record.headshots || 0} de ${record.hits} bajas`,
    ]);
  const legend = facts(rows);
  legend.classList.add('summary-legend');
  body.append(legend);
  panel.append(body);
  return panel;
}

export function insightsPanel(lines) {
  const panel = card('Qué mejorar', 'summary-insights');
  if (!lines.length) {
    panel.append(
      note(
        'Con estos datos no hay nada claro que corregir. Repite la ronda para confirmar tu ritmo.',
      ),
    );
    return panel;
  }
  const list = el('ul');
  for (const line of lines) list.append(el('li', '', line));
  panel.append(list);
  return panel;
}

export function timelinePanel(stats) {
  const panel = card('Ritmo de la ronda', 'summary-timeline');
  panel.append(timelineChart(stats.timeline, stats.seconds, stats.orbTargets));
  return panel;
}

export function reactionPanel(reaction) {
  const panel = card('Tiempo por objetivo', 'summary-reaction');
  if (!reaction) {
    panel.append(note('Sin bajas en esta ronda: no hay tiempos que medir.'));
    return panel;
  }
  panel.append(
    facts([
      ['Media', formatMs(reaction.average)],
      ['Mejor', formatMs(reaction.best)],
      ['Mediana', formatMs(reaction.median)],
    ]),
    reactionChart(reaction),
  );
  return panel;
}

export function dispersionPanel(stats) {
  const panel = card(
    stats.orbTargets ? 'Dónde caen tus disparos' : 'Dónde caen respecto a la cabeza',
    'summary-dispersion',
  );
  panel.append(
    stats.dispersion
      ? dispersionChart(stats.dispersion, stats.orbTargets)
      : note('Hacen falta al menos 3 disparos cerca de un objetivo para dibujar la dispersión.'),
  );
  return panel;
}

export function trendPanel(record, comparison) {
  const panel = card('Tendencia en este modo', 'summary-trend');
  const aim = isAimRound(record);
  const pool = aim ? comparison.pool.filter(isAimRound) : comparison.pool;
  if (!pool.length) {
    panel.append(
      note(`Juega otra ronda completa de ${record.name} y aquí verás cómo evolucionas.`),
    );
    return panel;
  }
  const metric = (round) => (aim ? Math.min(100, round.accuracy || 0) : primaryMetric(round).value);
  panel.append(
    el(
      'p',
      'summary-note',
      aim
        ? 'Precisión de tus últimas rondas completas.'
        : `Tus últimas rondas completas, en ${comparison.unit}.`,
    ),
    trendChart({
      values: pool.map(metric),
      current: metric(record),
      unit: aim ? '%' : '',
      isIncomplete: comparison.verdict.tone === 'incomplete',
    }),
  );
  return panel;
}

/** Movement rounds have no shots; their own counters tell the story. */
export function movementPanel(record, stats) {
  const panel = card('Resumen de la sesión', 'summary-movement');
  panel.append(
    facts([
      ['Circuitos completados', record.completedCourses || 0],
      ['Nivel alcanzado', record.courseLevel || 1],
      ['Saltos', record.jumps || 0],
      ['Caídas', record.falls || 0],
      ['Vidas restantes', record.lives ?? 0],
      ['Mejor racha bunny', record.bestBunnyChain || 0],
      ['Tiempo activo', clock(stats.seconds)],
    ]),
  );
  return panel;
}
