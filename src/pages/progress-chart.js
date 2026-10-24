import { el, svg } from './dom.js';
import { relativeDate } from '../features/progress-summary.js';

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 16, bottom: 26, left: 40 };
const GRID_STEPS = [0, 25, 50, 75, 100];

const x = (index, count) =>
  PAD.left + (count === 1 ? 0.5 : index / (count - 1)) * (WIDTH - PAD.left - PAD.right);
const y = (accuracy) => PAD.top + (1 - accuracy / 100) * (HEIGHT - PAD.top - PAD.bottom);

function gridLines() {
  return GRID_STEPS.flatMap((step) => {
    const line = svg('line', {
      x1: PAD.left,
      x2: WIDTH - PAD.right,
      y1: y(step),
      y2: y(step),
      class: 'grid',
    });
    const label = svg('text', {
      x: PAD.left - 8,
      y: y(step) + 4,
      class: 'axis',
      'text-anchor': 'end',
    });
    label.textContent = step + '%';
    return [line, label];
  });
}

/** Accessible SVG line chart of accuracy per session (oldest left, newest right). */
export function accuracyChart(points, average) {
  const figure = el('figure', 'progress-chart');
  const chart = svg('svg', {
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: 'img',
    'aria-labelledby': 'trend-desc',
  });
  const desc = svg('desc', { id: 'trend-desc' });
  const first = points[0].accuracy;
  const last = points.at(-1).accuracy;
  desc.textContent = `Precisión de tus últimas ${points.length} rondas: de ${first}% a ${last}%. Media ${average}%.`;
  const coords = points.map((point, i) => [x(i, points.length), y(point.accuracy)]);
  const line = coords
    .map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`)
    .join(' ');
  const base = y(0).toFixed(1);
  const area = `${line} L${coords.at(-1)[0].toFixed(1)} ${base} L${coords[0][0].toFixed(1)} ${base} Z`;
  const gradient = svg('linearGradient', { id: 'trend-fill', x1: 0, x2: 0, y1: 0, y2: 1 });
  gradient.append(
    svg('stop', { offset: '0%', class: 'fill-top' }),
    svg('stop', { offset: '100%', class: 'fill-bottom' }),
  );
  const defs = svg('defs');
  defs.append(gradient);
  chart.append(desc, defs, ...gridLines());
  chart.append(
    svg('line', {
      x1: PAD.left,
      x2: WIDTH - PAD.right,
      y1: y(average),
      y2: y(average),
      class: 'average',
    }),
    svg('path', { d: area, class: 'area', fill: 'url(#trend-fill)' }),
    svg('path', { d: line, class: 'line' }),
  );
  points.forEach((point, i) => {
    const dot = svg('circle', {
      cx: coords[i][0],
      cy: coords[i][1],
      r: i === points.length - 1 ? 5 : 3.5,
      class: 'dot',
    });
    const tip = svg('title');
    tip.textContent = `${point.name} · ${point.accuracy}% · ${relativeDate(point.date)}`;
    dot.append(tip);
    chart.append(dot);
  });
  const legend = el('figcaption', 'chart-legend');
  legend.append(
    el('span', 'legend-line', 'Precisión por ronda'),
    el('span', 'legend-average', `Media ${average}%`),
  );
  figure.append(chart, legend);
  return figure;
}
