import { read, save } from '../lib/storage.js';
import { parseCode } from './crosshair-code.js';

const COLLECTION_KEY = 'wa-crosshairs';
export const COLLECTION_LIMIT = 30;
export const DEFAULT_CROSSHAIR_CODE = '0;s;1;P;c;5;h;1;d;0;0b;1;0t;1;0l;4;0v;4;0o;2;0a;1;0f;0;1b;0';

function presetCode(color, len, gap, thickness = 1, dot = false, outline = false) {
  return `0;s;1;P;c;${color};h;${outline ? 1 : 0};d;${dot ? 1 : 0};z;2;0b;${len ? 1 : 0};0t;${thickness};0l;${len};0v;${len};0o;${gap};0a;1;0f;0;0m;0;1b;0;S;s;1`;
}

/** Original WadriAim designs, shared by Configuración, the Miras page and the arena. */
export const CROSSHAIR_PRESETS = [
  { name: 'Mira clásica', code: DEFAULT_CROSSHAIR_CODE },
  { name: 'Cian compacta', code: presetCode(5, 4, 2) },
  { name: 'Punto blanco', code: presetCode(0, 0, 0, 1, true, true) },
  { name: 'Cruz rosa', code: presetCode(6, 5, 2) },
  { name: 'Verde precisa', code: presetCode(1, 3, 1) },
  { name: 'Blanca clásica', code: presetCode(0, 5, 3, 1, false, true) },
  { name: 'Cruz cerrada', code: presetCode(5, 4, 0) },
  { name: 'Punto rojo', code: presetCode(7, 0, 0, 1, true, true) },
  { name: 'Amarilla visible', code: presetCode(4, 5, 2, 2, false, true) },
  { name: 'Micro rosa', code: presetCode(6, 2, 1) },
  { name: 'Cruz con punto', code: presetCode(1, 4, 3, 1, true) },
  { name: 'Cian gruesa', code: presetCode(5, 4, 2, 2) },
];

export const readCollection = () => read(COLLECTION_KEY, []);
export const saveCollection = (list) => save(COLLECTION_KEY, list);

/** Returns a new collection with the crosshair added; throws a user-facing message otherwise. */
export function addCrosshair(list, { name = '', code }) {
  const clean = code.trim();
  parseCode(clean);
  if (list.some((item) => item.code === clean))
    throw Error('Esta mira ya está guardada en tu colección.');
  if (list.length >= COLLECTION_LIMIT)
    throw Error(
      `Tu colección tiene ${COLLECTION_LIMIT} miras. Quita alguna para guardar una nueva.`,
    );
  return [...list, { name: name.trim() || 'Mi mira ' + (list.length + 1), code: clean }];
}

export const removeCrosshair = (list, code) => list.filter((item) => item.code !== code);

export function crosshairName(code, collection) {
  const match = [...CROSSHAIR_PRESETS, ...collection].find((item) => item.code === code.trim());
  return match?.name || 'Mira personalizada';
}

/** Quick-pick list for the arena: presets, then the collection, plus the active code if it is custom. */
export function crosshairChoices(activeCode, collection) {
  const active = activeCode.trim();
  const known = [...CROSSHAIR_PRESETS, ...collection].filter(
    (item, i, all) => all.findIndex((other) => other.code === item.code) === i,
  );
  return known.some((item) => item.code === active)
    ? known
    : [{ name: 'Tu mira', code: active }, ...known];
}

/** Clipboard write; resolves false when the browser blocks it so callers can offer a fallback. */
export async function copyCrosshairCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    return false;
  }
}
