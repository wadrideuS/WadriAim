import { weaponThumbUrl, WEAPON_THUMB_SIZE } from '../data/weapon-thumbs.js';

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Picture, name and two chips (magazine and fire mode) for "Elige tu arma". */
export function weaponCard(id, weapon, isSelected) {
  const button = el('button', 'weapon-choice' + (isSelected ? ' selected' : ''));
  button.type = 'button';
  button.dataset.weapon = id;
  button.setAttribute('aria-pressed', String(isSelected));

  const media = el('span', 'weapon-media');
  const src = weaponThumbUrl(id);
  if (src) {
    const image = new Image(WEAPON_THUMB_SIZE.width, WEAPON_THUMB_SIZE.height);
    image.src = src;
    image.alt = '';
    image.decoding = 'async';
    media.append(image);
  } else media.classList.add('is-empty');

  const chips = el('span', 'weapon-chips');
  if (weapon.mag) chips.append(el('span', 'weapon-chip', `${weapon.mag} balas`));
  chips.append(
    el('span', 'weapon-chip', weapon.mag ? (weapon.auto ? 'AUTO' : 'SEMI') : 'Cuerpo a cuerpo'),
  );

  button.append(media, el('strong', 'weapon-name', weapon.name), chips);
  return button;
}

/** One line under the cards: the chosen weapon, its finish and its type. */
export function paintWeaponInfo(node, { name, details }) {
  node.replaceChildren(el('strong', '', name), el('span', '', details.join(' · ')));
}
