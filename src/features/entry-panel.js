/**
 * Turns the loose #overlay markup into the entry / pause panel: a header with
 * the mode, a scrolling body and an action bar that never scrolls away.
 * Nodes are moved, not recreated, so every id and handler stays intact.
 */
export function buildEntryPanel(overlay, { record }) {
  const element = (tag, className) => Object.assign(document.createElement(tag), { className });
  const panel = element('div', 'arena-entry-panel');
  const body = element('div', 'entry-body');
  const head = element('div', 'entry-head');
  const titleRow = element('div', 'entry-title');
  const actions = overlay.querySelector('.entry-buttons');
  const notice = overlay.querySelector('#entrynotice');

  titleRow.append(overlay.querySelector('#result'), overlay.querySelector('.eyebrow'));
  head.append(titleRow, overlay.querySelector('#instructions'), record);
  actions.prepend(overlay.querySelector('#exit-arena'));
  body.append(head, ...[...overlay.children].filter((node) => node !== actions && node !== notice));
  panel.append(body, notice, actions);
  overlay.append(panel);
  return panel;
}
