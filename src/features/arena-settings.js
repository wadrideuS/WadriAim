import { read, save } from '../lib/storage.js';
import { cross } from './crosshair-code.js';
import { palettes, applyPalette } from './palettes.js';

/** Small crosshair presets (same code format as the gallery). */
function presetCode(color, len, gap, thickness = 1, dot = false, outline = false) {
  return `0;s;1;P;c;${color};h;${outline ? 1 : 0};d;${dot ? 1 : 0};z;2;0b;${len ? 1 : 0};0t;${thickness};0l;${len};0v;${len};0o;${gap};0a;1;0f;0;0m;0;1b;0;S;s;1`;
}
const quickMiras = [
  { name: 'Cian compacta', code: presetCode(5, 4, 2) },
  { name: 'Punto blanco', code: presetCode(0, 0, 0, 1, true, true) },
  { name: 'Verde precisa', code: presetCode(1, 3, 1) },
  { name: 'Blanca clásica', code: presetCode(0, 5, 3, 1, false, true) },
  { name: 'Amarilla visible', code: presetCode(4, 5, 2, 2, false, true) },
  { name: 'Cruz con punto', code: presetCode(1, 4, 3, 1, true) },
];

export const outlineChoices = { rojo: 'Rojo', amarillo: 'Amarillo', morado: 'Morado' };

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

function segmented(label, choices, current, onPick) {
  const row = el('div', 'setting-row');
  const title = el('span', 'setting-label', label);
  const group = el('div', 'segmented');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', label);
  const paint = (value) =>
    group.querySelectorAll('button').forEach((b) => {
      const on = b.dataset.value === value;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    });
  for (const [value, text] of Object.entries(choices)) {
    const b = el('button', '', text);
    b.type = 'button';
    b.dataset.value = value;
    b.onclick = () => {
      onPick(value);
      paint(value);
    };
    group.append(b);
  }
  paint(current);
  row.append(title, group);
  return { row, paint };
}

/**
 * In-arena settings, available before the round and from the pause menu.
 * `api` connects to the controller: profile, renderer and session options.
 */
export function installArenaSettings(container, api) {
  const root = el('section', 'arena-settings');
  root.setAttribute('aria-label', 'Ajustes de la arena');

  // --- before the round
  const pre = el('div', 'settings-block pre-round');
  pre.append(el('h3', '', 'Antes de empezar'));
  const ammo = segmented(
    'Munición',
    { reload: 'Recargable', infinite: 'Infinita' },
    api.options().ammo,
    (value) => api.setOption('ammo', value),
  );
  const timed = segmented(
    'Tiempo',
    { timed: 'Con límite', endless: 'Sin límite' },
    api.options().timed ? 'timed' : 'endless',
    (value) => api.setOption('timed', value === 'timed'),
  );
  pre.append(ammo.row, timed.row);

  // --- always
  const general = el('div', 'settings-block');
  general.append(el('h3', '', 'Ajustes'));

  const sensRow = el('div', 'setting-row');
  const sensLabel = el('label', 'setting-label', 'Sensibilidad');
  const sens = el('input');
  sens.type = 'number';
  sens.min = '0.01';
  sens.max = '10';
  sens.step = '0.001';
  sens.id = 'arena-sens';
  sensLabel.htmlFor = 'arena-sens';
  const sensHint = el('small', 'setting-hint');
  const paintSens = () => {
    const profile = api.profile();
    sens.value = profile.sens;
    const edpi = Math.round(profile.sens * (profile.dpi || 800));
    sensHint.textContent = `eDPI ${edpi} · ${((360 / (0.07 * profile.sens * (profile.dpi || 800))) * 2.54).toFixed(1)} cm/360°`;
  };
  sens.onchange = () => {
    const value = Number(sens.value);
    if (value >= 0.01 && value <= 10) api.updateProfile({ sens: value });
    paintSens();
  };
  sensRow.append(sensLabel, sens, sensHint);

  const miraRow = el('div', 'setting-row mira-row');
  miraRow.append(el('span', 'setting-label', 'Mira'));
  const miras = el('div', 'mira-strip');
  const paintMiras = () => {
    miras.replaceChildren();
    const current = api.profile().code;
    const list = [
      { name: 'Tu mira', code: current },
      ...quickMiras,
      ...read('wa-crosshairs', []),
    ].filter((m, i, all) => all.findIndex((n) => n.code === m.code) === i);
    for (const mira of list.slice(0, 12)) {
      const b = el('button', 'mira-chip' + (mira.code === current ? ' selected' : ''));
      b.type = 'button';
      b.title = mira.name;
      b.setAttribute('aria-label', 'Mira ' + mira.name);
      b.setAttribute('aria-pressed', String(mira.code === current));
      const canvas = el('canvas');
      canvas.width = 56;
      canvas.height = 36;
      try {
        cross(canvas.getContext('2d'), 28, 18, mira.code);
      } catch {}
      b.append(canvas);
      b.onclick = () => {
        api.updateProfile({ code: mira.code });
        paintMiras();
      };
      miras.append(b);
    }
  };
  miraRow.append(miras);

  const outline = segmented('Contorno enemigo', outlineChoices, api.outline(), (v) => api.setOutline(v));
  outline.row.classList.add('outline-row');

  const uiRow = el('div', 'setting-row');
  uiRow.append(el('span', 'setting-label', 'Color de interfaz'));
  const swatches = el('div', 'ui-swatches');
  const paintUi = () => {
    const current = document.body.dataset.palette;
    swatches.replaceChildren();
    const ids = ['rose', 'blue', 'green', 'violet', ...(current?.startsWith('team-') ? [current] : [])];
    for (const id of ids) {
      const p = palettes[id];
      if (!p) continue;
      const b = el('button', 'ui-swatch' + (id === current ? ' selected' : ''));
      b.type = 'button';
      b.title = p.label || p.name || id;
      b.setAttribute('aria-label', 'Interfaz ' + (p.label || id));
      b.style.setProperty('--swatch', p.accent);
      b.onclick = () => {
        applyPalette(id);
        paintUi();
      };
      swatches.append(b);
    }
  };
  uiRow.append(swatches);

  const side = segmented('Lado del arma', { right: 'Derecha', left: 'Izquierda' }, api.weaponSide(), (v) =>
    api.setWeaponSide(v),
  );
  const quality = segmented(
    'Rendimiento',
    { quality: 'Calidad', performance: 'Baja latencia' },
    read('wa-quality', 'quality'),
    (v) => {
      save('wa-quality', v);
      api.setQuality(v);
    },
  );

  const rows = [sensRow, miraRow, outline.row, uiRow, side.row, quality.row];
  const music = api.music?.();
  let musicSelect = null;
  if (music?.genreSelect) {
    const musicRow = el('div', 'setting-row');
    musicRow.append(el('span', 'setting-label', 'Música'));
    musicSelect = music.genreSelect.cloneNode(true);
    musicSelect.className = 'music-genre arena-music';
    musicSelect.onchange = () => {
      music.genreSelect.value = musicSelect.value;
      if (!music.enabled) music.button.click();
      music.setGenre(musicSelect.value);
    };
    const skip = el('button', 'music-skip', '⏭');
    skip.type = 'button';
    skip.title = 'Otra emisora';
    skip.setAttribute('aria-label', 'Otra emisora');
    skip.onclick = () => music.nextStation();
    musicRow.append(musicSelect, skip);
    rows.push(musicRow);
  }
  general.append(...rows);
  root.append(pre, general);
  container.append(root);

  return {
    root,
    /** state: 'ready' shows the pre-round options; 'paused' hides them. */
    refresh(state) {
      pre.hidden = state !== 'ready';
      ammo.paint(api.options().ammo);
      timed.paint(api.options().timed ? 'timed' : 'endless');
      outline.paint(api.outline());
      side.paint(api.weaponSide());
      paintSens();
      paintMiras();
      paintUi();
      if (musicSelect) musicSelect.value = api.music().genre;
    },
    dispose() {
      root.remove();
    },
  };
}
