import { svg } from '../../pages/dom.js';
import { chartSvg, figure, label, plural, withTip } from './chart-svg.js';
import { formatMs } from './round-stats.js';

const BARS = { width: 300, height: 150, left: 6, right: 6, top: 18, bottom: 24 };
const SCATTER = { size: 220, plot: 96 };
const SCATTER_STEP_DEGREES = 0.5;
const SCATTER_PERCENTILE = 0.9;

const oneDecimal = (value) =>
  Math.abs(value).toLocaleString('es', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function bars(chart, values, classNameFor) {
  const { width, height, left, right, top, bottom } = BARS;
  const max = Math.max(1, ...values);
  const step = (width - left - right) / values.length;
  const barWidth = step * 0.7;
  return values.map((value, i) => {
    const barHeight = ((height - top - bottom) * value) / max;
    const x = left + i * step + (step - barWidth) / 2;
    const y = height - bottom - barHeight;
    const rect = svg('rect', {
      x,
      y,
      width: barWidth,
      height: Math.max(value ? 2 : 0, barHeight),
      rx: 2,
      class: classNameFor(i),
    });
    chart.append(rect);
    return { rect, x: x + barWidth / 2, y };
  });
}

/** Histogram of time per target, 150 ms per bar; the median bar is highlighted. */
export function reactionChart(reaction) {
  const { width, height } = BARS;
  const chart = chartSvg(
    width,
    height,
    'Tiempo por objetivo',
    `${plural(reaction.count, 'baja', 'bajas')}. Media ${formatMs(reaction.average)}, mejor ${formatMs(reaction.best)}, mediana ${formatMs(reaction.median)}.`,
  );
  const medianBin = reaction.bins.findIndex(
    (bin) => reaction.median >= bin.from && reaction.median < bin.to,
  );
  const drawn = bars(
    chart,
    reaction.bins.map((bin) => bin.count),
    (i) => (i === medianBin ? 'bar-head' : 'bar-kill'),
  );
  drawn.forEach(({ rect }, i) => {
    const bin = reaction.bins[i];
    const range = Number.isFinite(bin.to) ? `${bin.from}–${bin.to} ms` : `${bin.from} ms o más`;
    withTip(rect, `${range}: ${plural(bin.count, 'baja', 'bajas')}`);
  });
  const baseline = height - BARS.bottom + 16;
  chart.append(
    label(BARS.left, baseline, '0 ms'),
    label(width / 2, baseline, '750', { 'text-anchor': 'middle' }),
    label(width - BARS.right, baseline, '1500+', { 'text-anchor': 'end' }),
  );
  return figure(
    chart,
    'Desde que aparece el objetivo (o desde tu baja anterior) hasta que cae. Resaltada, la barra de tu mediana.',
  );
}

function scatterRange(points) {
  const distances = points.map((p) => Math.hypot(p.x, p.y)).toSorted((a, b) => a - b);
  const reach = distances[Math.floor((distances.length - 1) * SCATTER_PERCENTILE)];
  return Math.max(1, Math.ceil(reach / SCATTER_STEP_DEGREES) * SCATTER_STEP_DEGREES);
}

function biasText(mean) {
  const parts = [];
  if (Math.abs(mean.x) >= 0.05)
    parts.push(`${oneDecimal(mean.x)}° ${mean.x < 0 ? 'a la izquierda' : 'a la derecha'}`);
  if (Math.abs(mean.y) >= 0.05)
    parts.push(`${oneDecimal(mean.y)}° ${mean.y < 0 ? 'abajo' : 'arriba'}`);
  return parts.length ? `Desvío medio: ${parts.join(' y ')}.` : 'Sin desvío medio apreciable.';
}

/** Where each shot landed around the target, in degrees; misses only near a live target. */
export function dispersionChart(spread, orbTargets) {
  const { size, plot } = SCATTER;
  const centre = size / 2;
  const range = scatterRange(spread.points);
  const scale = plot / range;
  const reference = orbTargets ? 'centro del objetivo' : 'cabeza del objetivo';
  const chart = chartSvg(
    size,
    size,
    `Dispersión respecto a la ${reference}`,
    `${plural(spread.points.length, 'disparo', 'disparos')}. ${biasText(spread.mean)}`,
  );
  chart.append(
    svg('circle', { cx: centre, cy: centre, r: plot, class: 'scatter-ring' }),
    svg('circle', { cx: centre, cy: centre, r: plot / 2, class: 'scatter-ring' }),
    svg('line', {
      x1: centre - plot,
      x2: centre + plot,
      y1: centre,
      y2: centre,
      class: 'scatter-axis',
    }),
    svg('line', {
      x1: centre,
      x2: centre,
      y1: centre - plot,
      y2: centre + plot,
      class: 'scatter-axis',
    }),
    label(centre + plot - 2, centre - 4, `${oneDecimal(range)}°`, { 'text-anchor': 'end' }),
  );
  for (const point of spread.points) {
    const distance = Math.hypot(point.x, point.y);
    const clamp = distance > range ? range / distance : 1;
    chart.append(
      svg('circle', {
        cx: centre + point.x * clamp * scale,
        cy: centre - point.y * clamp * scale,
        r: 3,
        class: point.result === 'miss' ? 'dot-miss' : 'dot-hit',
      }),
    );
  }
  const mean = svg('circle', {
    cx: centre + spread.mean.x * scale,
    cy: centre - spread.mean.y * scale,
    r: 6,
    class: 'dot-mean',
  });
  chart.append(withTip(mean, biasText(spread.mean)));
  return figure(
    chart,
    `Rellenos: aciertos. Huecos: fallos cerca de un objetivo. Anillo blanco: tu desvío medio. ${biasText(spread.mean)}`,
    'is-scatter',
  );
}

/** Previous complete rounds of the mode plus this one, with their average as a dashed line. */
export function trendChart({ values, current, unit, isIncomplete }) {
  const { width, height, left, right, bottom } = BARS;
  const all = [...values, current];
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const roundedMean = Math.round(mean);
  const chart = chartSvg(
    width,
    height,
    'Esta ronda frente a las anteriores',
    `Esta ronda: ${current}${unit}. Media de tus ${values.length} rondas completas anteriores: ${roundedMean}${unit}.`,
  );
  const drawn = bars(chart, all, (i) =>
    i === all.length - 1 ? `bar-current${isIncomplete ? ' is-incomplete' : ''}` : 'bar-past',
  );
  drawn.forEach(({ rect }, i) =>
    withTip(rect, i === all.length - 1 ? `Esta ronda: ${current}${unit}` : `${all[i]}${unit}`),
  );
  const max = Math.max(1, ...all);
  const meanY = height - bottom - ((height - BARS.top - bottom) * mean) / max;
  const last = drawn.at(-1);
  chart.append(
    svg('line', { x1: left, x2: width - right, y1: meanY, y2: meanY, class: 'trend-mean' }),
    label(last.x, last.y - 6, `${current}${unit}`, {
      'text-anchor': 'middle',
      class: 'chart-label is-strong',
    }),
    label(left, height - 6, `Hace ${values.length}`),
    label(width - right, height - 6, isIncomplete ? 'Esta (incompleta)' : 'Esta ronda', {
      'text-anchor': 'end',
    }),
  );
  return figure(chart, `Línea discontinua: tu media anterior (${roundedMean}${unit}).`);
}
