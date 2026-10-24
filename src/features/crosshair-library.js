import { cross } from './crosshair-code.js';
import {
  CROSSHAIR_PRESETS,
  addCrosshair,
  copyCrosshairCode,
  readCollection,
  removeCrosshair,
  saveCollection,
} from './crosshair-collection.js';

/** Quick crosshair picker inside Configuración; the full gallery lives on the Miras page. */
export function initCrosshairLibrary({ settings, preview }) {
  const $ = (id) => document.getElementById(id);
  const status = (message) => ($('crosshair-status').textContent = message);
  function renderMiras() {
    const root = $('crosshair-presets');
    const personalMiras = readCollection();
    root.replaceChildren();
    [...CROSSHAIR_PRESETS, ...personalMiras].forEach((m, i) => {
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
        status('Vista previa: ' + m.name + '. Pulsa Guardar configuración para aplicarla.');
      };
      card.append(b);
      if (i >= CROSSHAIR_PRESETS.length) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'remove-mira';
        remove.textContent = '×';
        remove.setAttribute('aria-label', 'Quitar de mi colección: ' + m.name);
        remove.onclick = () => {
          saveCollection(removeCrosshair(readCollection(), m.code));
          renderMiras();
          status('Mira quitada de tu colección. Puedes volver a guardar su código.');
        };
        card.append(remove);
      }
      root.append(card);
      cross(cv.getContext('2d'), 50, 32, m.code);
    });
  }
  $('save-crosshair').onclick = () => {
    try {
      saveCollection(
        addCrosshair(readCollection(), { name: $('crosshair-name').value, code: $('code').value }),
      );
    } catch (e) {
      status(e.message);
      return;
    }
    $('crosshair-name').value = '';
    renderMiras();
    status('Mira guardada en tu colección.');
  };
  const originalSettings = settings;
  settings = function () {
    originalSettings();
    renderMiras();
  };
  $('profile').onclick = settings;
  $('configure').onclick = settings;
  $('code').addEventListener('input', renderMiras);
  $('copy-code').onclick = async () => {
    if (await copyCrosshairCode($('code').value)) return status('Código copiado.');
    $('code').focus();
    $('code').select();
    status('No se pudo copiar solo. El código quedó seleccionado.');
  };
  if ($('settings').open) renderMiras();

  return settings;
}
