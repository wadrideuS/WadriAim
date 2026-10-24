import { read, save } from '../lib/storage.js';
import { cross } from './crosshair-code.js';
import { crosshairChoices, readCollection } from './crosshair-collection.js';
import { palettes, applyPalette } from './palettes.js';
import { icon as musicIcon, SKIP_LABEL, SKIP_UNAVAILABLE } from '../audio/MusicControl.js';

const AMBIENT_GENRE = 'synth';

export const outlineChoices = { rojo: 'Rojo', amarillo: 'Amarillo', morado: 'Morado' };

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

let labelCount = 0;
/**
 * Label column + control column. A real <label for> when the control is a
 * single field; otherwise the label names the control group via aria-labelledby.
 */
function settingRow(text, controls, { labelFor } = {}) {
  const row = el('div', 'setting-row');
  const label = el(labelFor ? 'label' : 'span', 'setting-label', text);
  if (labelFor) label.htmlFor = labelFor;
  else {
    label.id = `arena-setting-${++labelCount}`;
    controls[0].setAttribute('aria-labelledby', label.id);
  }
  const control = el('div', 'setting-control');
  control.append(...controls);
  row.append(label, control);
  return row;
}

function settingsGroup(title, rows) {
  const group = el('div', 'settings-group');
  group.append(el('h4', '', title), ...rows);
  return group;
}

function segmented(label, choices, current, onPick) {
  const group = el('div', 'segmented');
  group.setAttribute('role', 'group');
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
  return { row: settingRow(label, [group]), paint };
}

function sensitivityRow(api) {
  const sens = el('input');
  Object.assign(sens, { type: 'number', min: '0.01', max: '10', step: '0.001', id: 'arena-sens' });
  const hint = el('small', 'setting-hint');
  const paint = () => {
    const profile = api.profile();
    const dpi = profile.dpi || 800;
    sens.value = profile.sens;
    hint.textContent = `eDPI ${Math.round(profile.sens * dpi)} · ${((360 / (0.07 * profile.sens * dpi)) * 2.54).toFixed(1)} cm/360°`;
  };
  sens.onchange = () => {
    const value = Number(sens.value);
    if (value >= 0.01 && value <= 10) api.updateProfile({ sens: value });
    paint();
  };
  return { row: settingRow('Sensibilidad', [sens, hint], { labelFor: 'arena-sens' }), paint };
}

function miraRow(api) {
  const strip = el('div', 'mira-strip');
  strip.setAttribute('role', 'group');
  const revealSelected = (scrollLeft) => {
    strip.scrollLeft = scrollLeft;
    const selected = strip.querySelector('.selected');
    if (!selected) return;
    const start = selected.offsetLeft - strip.scrollLeft;
    const isVisible = start >= 0 && start + selected.offsetWidth <= strip.clientWidth;
    if (!isVisible)
      strip.scrollLeft = selected.offsetLeft - (strip.clientWidth - selected.offsetWidth) / 2;
  };
  const paint = () => {
    const scrollLeft = strip.scrollLeft;
    strip.replaceChildren();
    const current = api.profile().code.trim();
    for (const mira of crosshairChoices(current, readCollection())) {
      const isCurrent = mira.code === current;
      const b = el('button', 'mira-chip' + (isCurrent ? ' selected' : ''));
      b.type = 'button';
      b.title = mira.name;
      b.setAttribute('aria-label', 'Mira ' + mira.name);
      b.setAttribute('aria-pressed', String(isCurrent));
      const canvas = el('canvas');
      canvas.width = 56;
      canvas.height = 36;
      try {
        cross(canvas.getContext('2d'), 28, 18, mira.code);
      } catch (error) {
        console.warn('Mira con código inválido:', mira.name, error);
      }
      b.append(canvas);
      b.onclick = () => {
        api.updateProfile({ code: mira.code });
        paint();
      };
      strip.append(b);
    }
    requestAnimationFrame(() => revealSelected(scrollLeft));
  };
  return { row: settingRow('Mira', [strip]), paint };
}

function interfaceRow() {
  const swatches = el('div', 'ui-swatches');
  swatches.setAttribute('role', 'group');
  const paint = () => {
    const current = document.body.dataset.palette;
    swatches.replaceChildren();
    const ids = [
      'rose',
      'blue',
      'green',
      'violet',
      ...(current?.startsWith('team-') ? [current] : []),
    ];
    for (const id of ids) {
      const p = palettes[id];
      if (!p) continue;
      const b = el('button', 'ui-swatch' + (id === current ? ' selected' : ''));
      b.type = 'button';
      b.title = p.label || p.name || id;
      b.setAttribute('aria-label', 'Interfaz ' + (p.label || id));
      b.setAttribute('aria-pressed', String(id === current));
      b.style.setProperty('--swatch', p.accent);
      b.onclick = () => {
        applyPalette(id);
        paint();
      };
      swatches.append(b);
    }
  };
  return { row: settingRow('Color de interfaz', [swatches]), paint };
}

/** Genre and "Otra emisora", driving the same AmbientMusic as the header control. */
function musicRow(music) {
  const select = music.genreSelect.cloneNode(true);
  select.className = 'music-genre arena-music';
  select.id = 'arena-music';
  select.removeAttribute('aria-label');
  const skip = el('button', 'arena-music-skip');
  skip.type = 'button';
  skip.append(musicIcon('skip'), el('span', '', SKIP_LABEL));
  const paint = () => {
    const isAvailable = music.genre !== AMBIENT_GENRE;
    select.value = music.genre;
    skip.setAttribute('aria-disabled', String(!isAvailable));
    skip.title = isAvailable ? SKIP_LABEL : SKIP_UNAVAILABLE;
  };
  select.onchange = async () => {
    music.genreSelect.value = select.value;
    const switching = music.setGenre(select.value);
    paint();
    await switching;
    if (!music.enabled) await music.setEnabled(true);
    paint();
  };
  skip.onclick = () => {
    if (skip.getAttribute('aria-disabled') !== 'true') music.skipStation();
  };
  return { row: settingRow('Música', [select, skip], { labelFor: 'arena-music' }), paint };
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
  pre.append(el('h3', 'entry-section-title', 'Antes de empezar'), ammo.row, timed.row);

  // --- always
  const sens = sensitivityRow(api);
  const miras = miraRow(api);
  const outline = segmented('Contorno enemigo', outlineChoices, api.outline(), (v) =>
    api.setOutline(v),
  );
  outline.row.classList.add('outline-row');
  const ui = interfaceRow();
  const side = segmented(
    'Lado del arma',
    { right: 'Derecha', left: 'Izquierda' },
    api.weaponSide(),
    (v) => api.setWeaponSide(v),
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
  const music = api.music?.()?.genreSelect ? musicRow(api.music()) : null;

  const general = el('div', 'settings-block');
  general.append(
    el('h3', 'entry-section-title', 'Ajustes'),
    settingsGroup('Puntería', [sens.row, miras.row]),
    settingsGroup('Visual', [outline.row, ui.row, side.row]),
    settingsGroup('Sistema', [quality.row, ...(music ? [music.row] : [])]),
  );
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
      sens.paint();
      miras.paint();
      ui.paint();
      music?.paint();
    },
    dispose() {
      root.remove();
    },
  };
}
