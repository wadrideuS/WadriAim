import { read, save } from '../lib/storage.js';
import { cross, parseCode } from './crosshair-code.js';
export function initCrosshairLibrary({ settings, preview, defaultCode }) {
  const $ = (id) => document.getElementById(id);
  // Biblioteca de diseños originales y miras personales guardadas en el navegador.
  function presetCode(color, len, gap, thickness = 1, dot = false, outline = false) {
    return `0;s;1;P;c;${color};h;${outline ? 1 : 0};d;${dot ? 1 : 0};z;2;0b;${len ? 1 : 0};0t;${thickness};0l;${len};0v;${len};0o;${gap};0a;1;0f;0;0m;0;1b;0;S;s;1`;
  }
  const miraPresets = [
    { name: 'Mira clásica', code: defaultCode },
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
  let personalMiras = read('wa-crosshairs', []);
  function renderMiras() {
    const root = $('crosshair-presets');
    root.innerHTML = '';
    [...miraPresets, ...personalMiras].forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'mira-card' + (m.code === $('code').value.trim() ? ' selected' : '');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'mira-select';
      b.setAttribute('aria-label', 'Elegir mira ' + m.name);
      b.setAttribute('aria-pressed', String(m.code === $('code').value.trim()));
      const cv = document.createElement('canvas');
      cv.width = 100;
      cv.height = 64;
      b.append(cv);
      const name = document.createElement('span');
      name.textContent = m.name;
      b.append(name);
      b.onclick = () => {
        $('code').value = m.code;
        preview();
        renderMiras();
        $('crosshair-status').textContent =
          'Vista previa: ' + m.name + '. Pulsa Guardar configuración para aplicarla.';
      };
      card.append(b);
      if (i >= miraPresets.length) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-mira';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Quitar de mi colección: ' + m.name);
        remove.onclick = () => {
          personalMiras.splice(i - miraPresets.length, 1);
          save('wa-crosshairs', personalMiras);
          renderMiras();
          $('crosshair-status').textContent =
            'Mira quitada de tu colección. Puedes volver a guardar su código.';
        };
        card.append(remove);
      }
      root.append(card);
      cross(cv.getContext('2d'), 50, 32, m.code);
    });
  }
  $('save-crosshair').onclick = () => {
    const code = $('code').value.trim();
    try {
      parseCode(code);
    } catch (e) {
      $('crosshair-status').textContent = e.message;
      return;
    }
    if (personalMiras.some((m) => m.code === code)) {
      $('crosshair-status').textContent = 'Esta mira ya está guardada en tu colección.';
      return;
    }
    if (personalMiras.length >= 30) {
      $('crosshair-status').textContent =
        'Tu colección tiene 30 miras. Quita alguna para guardar una nueva.';
      return;
    }
    personalMiras.push({
      name: $('crosshair-name').value.trim() || 'Mi mira ' + (personalMiras.length + 1),
      code,
    });
    save('wa-crosshairs', personalMiras);
    $('crosshair-name').value = '';
    renderMiras();
    $('crosshair-status').textContent = 'Mira guardada en tu colección.';
  };
  const originalSettings = settings;
  settings = function () {
    originalSettings();
    renderMiras();
  };
  $('profile').onclick = settings;
  $('configure').onclick = settings;
  $('code').addEventListener('input', renderMiras);
  if ($('settings').open) renderMiras();

  return settings;
}
