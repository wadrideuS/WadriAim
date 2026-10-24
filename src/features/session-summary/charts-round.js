import { svg } from '../../pages/dom.js';
import { chartSvg, figure, label, plural, withTip } from './chart-svg.js';

const GAUGE = { size: 160, outer: 66, inner: 47 };
const TIMELINE = { width: 640, height: 190, left: 44, right: 8, top: 12, bottom: 26 };

function ring(radius, share, className) {
  const centre = GAUGE.size / 2;
  const length = 2 * Math.PI * radius;
  const track = svg('circle', {
    cx: centre,
    cy: centre,
    r: radius,
    class: `gauge-track ${className}`,
  });
  if (share <= 0) return [track];
  const value = svg('circle', {
    cx: centre,
    cy: centre,
    r: radius,
    class: `gauge-value ${className}`,
    'stroke-dasharray': `${(length * Math.min(100, share)) / 100} ${length}`,
    transform: `rotate(-90 ${centre} ${centre})`,
  });
  return [track, value];
}

/** Two concentric rings: accuracy outside, headshots of your kills inside (not for orbs). */
export function accuracyGauge({ accuracy, headshotRate, showHeadshots }) {
  const description = showHeadshots
    ? `Precisión ${accuracy}%. Headshots: ${headshotRate ?? 0}% de tus bajas.`
    : `Precisión ${accuracy}%.`;
  const chart = chartSvg(GAUGE.size, GAUGE.size, 'Precisión de la ronda', description);
  chart.append(...ring(GAUGE.outer, accuracy, 'is-accuracy'));
  if (showHeadshots) chart.append(...ring(GAUGE.inner, headshotRate ?? 0, 'is-headshots'));
  const centre = GAUGE.size / 2;
  chart.append(
    label(centre, centre + 6, `${accuracy}%`, { class: 'gauge-number', 'text-anchor': 'middle' }),
  );
  return chart;
}

function bucketTip(bucket, size, orbTargets) {
  const end = bucket.start + size;
  const parts = [plural(bucket.kills, 'baja', 'bajas')];
  if (bucket.heads && !orbTargets) parts[0] += ` (${bucket.heads} HS)`;
  if (bucket.impacts) parts.push(plural(bucket.impacts, 'impacto sin baja', 'impactos sin baja'));
  parts.push(plural(bucket.misses, 'fallo', 'fallos'));
  return `${bucket.start}–${end} s: ${parts.join(', ')}`;
}

function stack(x, width, baseline, unit, segments) {
  let cursor = baseline;
  return segments
    .filter(([count]) => count > 0)
    .map(([count, className, direction]) => {
      const height = count * unit;
      const y = direction === 'up' ? cursor - height : cursor;
      cursor = direction === 'up' ? y : cursor + height;
      return svg('rect', { x, y, width, height, rx: 1.5, class: className });
    });
}

function totals(buckets) {
  return buckets.reduce(
    (sum, b) => ({
      kills: sum.kills + b.kills,
      impacts: sum.impacts + b.impacts,
      misses: sum.misses + b.misses,
    }),
    { kills: 0, impacts: 0, misses: 0 },
  );
}

/** Kills stacked above the axis, misses below, one bar per time bucket. */
export function timelineChart({ size, buckets }, seconds, orbTargets) {
  const { width, height, left, right, top, bottom } = TIMELINE;
  const up = Math.max(1, ...buckets.map((b) => b.kills + b.impacts));
  const down = Math.max(...buckets.map((b) => b.misses));
  const unit = (height - top - bottom) / (up + down);
  const baseline = top + up * unit;
  const step = (width - left - right) / buckets.length;
  const barWidth = Math.max(1, step * 0.72);
  const sum = totals(buckets);
  const chart = chartSvg(
    width,
    height,
    'Ritmo de la ronda',
    `En ${Math.round(seconds)} s: ${plural(sum.kills, 'baja', 'bajas')}, ${plural(sum.impacts, 'impacto sin baja', 'impactos sin baja')} y ${plural(sum.misses, 'fallo', 'fallos')}.`,
  );
  chart.append(
    label(left - 8, top + 8, 'Bajas', { 'text-anchor': 'end' }),
    label(left - 8, height - bottom, 'Fallos', { 'text-anchor': 'end' }),
  );
  buckets.forEach((bucket, i) => {
    const x = left + i * step + (step - barWidth) / 2;
    const heads = orbTargets ? bucket.kills : bucket.heads;
    const group = withTip(svg('g'), bucketTip(bucket, size, orbTargets));
    group.append(
      ...stack(x, barWidth, baseline, unit, [
        [heads, 'bar-head', 'up'],
        [bucket.kills - heads, 'bar-kill', 'up'],
        [bucket.impacts, 'bar-impact', 'up'],
      ]),
      ...stack(x, barWidth, baseline, unit, [[bucket.misses, 'bar-miss', 'down']]),
    );
    chart.append(group);
  });
  chart.append(
    svg('line', { x1: left, x2: width - right, y1: baseline, y2: baseline, class: 'axis-line' }),
  );
  const end = Math.round(seconds);
  [0, Math.round(end / 2), end].forEach((tick, i) => {
    const x = left + (tick / (buckets.length * size)) * (width - left - right);
    chart.append(
      label(x, height - 6, `${tick} s`, { 'text-anchor': ['start', 'middle', 'end'][i] }),
    );
  });
  const legend = orbTargets
    ? `Arriba, bajas; abajo, fallos. Cada barra es ${size === 1 ? '1 segundo' : `${size} segundos`}.`
    : `Arriba, bajas (color sólido = headshot) e impactos sin baja; abajo, fallos. Cada barra es ${size === 1 ? '1 segundo' : `${size} segundos`}.`;
  return figure(chart, legend, 'is-timeline');
}
