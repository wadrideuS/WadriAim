import '../styles/pages.css';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function svg(tag, attributes = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value));
  return node;
}

export function button(text, className = '', onClick = null) {
  const node = el('button', className, text);
  node.type = 'button';
  if (onClick) node.onclick = onClick;
  return node;
}

/** Shared header for the nav pages: eyebrow, title (id for aria-labelledby) and a short lead. */
export function pageHead({ eyebrow, title, titleId, lead }) {
  const head = el('div', 'page-head');
  const heading = el('h2', '', title);
  heading.id = titleId;
  head.append(el('p', 'eyebrow', eyebrow), heading, el('p', 'page-lead', lead));
  return head;
}

export const formatNumber = (value) => Number(value).toLocaleString('es');
