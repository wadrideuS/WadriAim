import { button, el } from './dom.js';
import { cross, parseCode } from '../features/crosshair-code.js';

const STAGE_WIDTH = 240;
const STAGE_HEIGHT = 136;
const PIXEL_DENSITY = 2;
const MAGNIFY = 2;

/** Crosshair drawn over a map-like backdrop, magnified so thin designs stay readable. */
export function crosshairStage(code, { label = '' } = {}) {
  const stage = el('div', 'xh-stage');
  const canvas = el('canvas');
  canvas.width = STAGE_WIDTH * PIXEL_DENSITY;
  canvas.height = STAGE_HEIGHT * PIXEL_DENSITY;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', label || 'Vista previa de la mira');
  paintStage(canvas, code);
  stage.append(canvas);
  return stage;
}

/** Leaves the stage empty for missing or invalid codes instead of drawing cross()'s fallback. */
export function paintStage(canvas, code) {
  const ctx = canvas.getContext('2d');
  const scale = PIXEL_DENSITY * MAGNIFY;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  try {
    parseCode(code);
  } catch {
    return;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  cross(ctx, canvas.width / 2 / scale, canvas.height / 2 / scale, code);
}

/**
 * Gallery card. `onRemove` only exists for the player's own crosshairs; removing
 * asks for an inline confirmation instead of a blocking browser dialog.
 */
export function crosshairCard(mira, { isActive, onUse, onCopy, onRemove }) {
  const card = el('article', 'xh-card' + (isActive ? ' is-active' : ''));
  const title = el('h4', '', mira.name);
  const head = el('div', 'xh-card-head');
  head.append(title);
  if (isActive) head.append(el('span', 'xh-badge', 'En uso'));
  const actions = el('div', 'xh-actions');
  const use = button(isActive ? 'En uso' : 'Usar esta mira', 'xh-use', () => onUse(mira));
  use.disabled = isActive;
  use.setAttribute(
    'aria-label',
    isActive ? `${mira.name} está en uso` : `Usar la mira ${mira.name}`,
  );
  const copy = button('Copiar código', 'xh-ghost', () => onCopy(mira));
  copy.setAttribute('aria-label', `Copiar el código de ${mira.name}`);
  actions.append(use, copy);
  if (onRemove) {
    const remove = button('Borrar', 'xh-ghost xh-danger', () => confirmRemoval());
    remove.setAttribute('aria-label', `Borrar ${mira.name} de tu colección`);
    actions.append(remove);
  }
  card.append(crosshairStage(mira.code, { label: `Vista previa de ${mira.name}` }), head, actions);

  function confirmRemoval() {
    const confirm = el('div', 'xh-confirm');
    confirm.setAttribute('role', 'group');
    confirm.setAttribute('aria-label', 'Confirmar borrado');
    const cancel = button('Cancelar', 'xh-ghost', () => {
      confirm.replaceWith(actions);
      actions.querySelector('.xh-danger').focus();
    });
    confirm.append(
      el('p', '', `¿Borrar «${mira.name}»? No se puede deshacer.`),
      button('Sí, borrar', 'xh-danger-solid', () => onRemove(mira)),
      cancel,
    );
    actions.replaceWith(confirm);
    cancel.focus();
  }
  return card;
}
