const VOLUME_ICON = {
  music: [
    ['path', { d: 'M9 17.5V6.2L19 4v11.2', 'stroke-linejoin': 'round' }],
    ['circle', { cx: '7.2', cy: '17.5', r: '2.1' }],
    ['circle', { cx: '17.2', cy: '15.2', r: '2.1' }],
  ],
  effects: [
    ['path', { d: 'M4.5 10v4h2.8l3.7 3V7l-3.7 3H4.5z', 'stroke-linejoin': 'round' }],
    ['path', { d: 'M14.2 9.2a3.6 3.6 0 0 1 0 5.6M16.8 7a6.2 6.2 0 0 1 0 10', 'stroke-linecap': 'round' }],
  ],
};

function volumeIcon(kind) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of VOLUME_ICON[kind]) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    node.setAttribute('fill', 'none');
    node.setAttribute('stroke', 'currentColor');
    node.setAttribute('stroke-width', '1.8');
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

export function decorateVolumeField(label, slider, icon, caption) {
  const title = document.createElement('span');
  title.className = 'volume-title';
  title.append(volumeIcon(icon), document.createTextNode(caption));
  const readout = document.createElement('output');
  readout.className = 'volume-readout';
  const paint = () => {
    const max = Number(slider.max) || 100;
    const value = Number(slider.value);
    readout.textContent = `${slider.value}%`;
    slider.setAttribute('aria-valuetext', `${slider.value} por ciento`);
    slider.style.setProperty('--fill', `${(value / max) * 100}%`);
  };
  paint();
  slider.addEventListener('input', paint);
  label.className = 'volume-field';
  label.replaceChildren(title, readout, slider);
}
