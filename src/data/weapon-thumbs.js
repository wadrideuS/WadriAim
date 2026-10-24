/**
 * Side-profile pictures of the playable weapons, pre-rendered from their GLB
 * models by scripts/render-weapon-thumbs.mjs into public/weapons/.
 */
export const WEAPON_THUMB_IDS = ['ghost', 'sheriff', 'phantom', 'vandal'];
export const WEAPON_THUMB_SIZE = { width: 560, height: 224 };

const BASE_URL = import.meta.env?.BASE_URL ?? '/';

export function weaponThumbPath(id) {
  return WEAPON_THUMB_IDS.includes(id) ? `weapons/${id}.webp` : null;
}

export function weaponThumbUrl(id) {
  const path = weaponThumbPath(id);
  return path && BASE_URL + path;
}
