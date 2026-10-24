import { el, svg } from '../../pages/dom.js';

let chartCount = 0;

/** Accessible SVG root: role img, a <title> and a <desc> that screen readers announce. */
export function chartSvg(width, height, title, description) {
  chartCount += 1;
  const id = `summary-chart-${chartCount}`;
  const root = svg('svg', {
    viewBox: `0 0 ${width} ${height}`,
    role: 'img',
    'aria-labelledby': `${id}-title`,
    'aria-describedby': `${id}-desc`,
  });
  const titleNode = svg('title', { id: `${id}-title` });
  titleNode.textContent = title;
  const descNode = svg('desc', { id: `${id}-desc` });
  descNode.textContent = description;
  root.append(titleNode, descNode);
  return root;
}

export function label(x, y, text, attributes = {}) {
  const node = svg('text', { x, y, class: 'chart-label', ...attributes });
  node.textContent = text;
  return node;
}

export function withTip(node, text) {
  const tip = svg('title');
  tip.textContent = text;
  node.append(tip);
  return node;
}

/** Figure with the chart and a visible one-line reading of it. */
export function figure(chart, caption, className = '') {
  const node = el('figure', `summary-figure ${className}`.trim());
  node.append(chart, el('figcaption', 'summary-caption', caption));
  return node;
}

export const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;
