import '../styles/crosshairs.css';
import { button, el, pageHead } from './dom.js';
import { crosshairCard, crosshairStage, paintStage } from './crosshair-card.js';
import { parseCode } from '../features/crosshair-code.js';
import {
  COLLECTION_LIMIT,
  CROSSHAIR_PRESETS,
  addCrosshair,
  copyCrosshairCode,
  crosshairName,
  readCollection,
  removeCrosshair,
  saveCollection,
} from '../features/crosshair-collection.js';

const TOAST_MS = 3200;

function activePanel(code, collection, onCopy) {
  const panel = el('article', 'xh-active');
  const name = crosshairName(code, collection);
  const info = el('div', 'xh-active-info');
  const codeRow = el('div', 'xh-code-row');
  codeRow.append(
    el('code', 'xh-code', code),
    button('Copiar código', 'secondary', () => onCopy({ name, code })),
  );
  info.append(el('p', 'eyebrow', 'EN USO EN LA ARENA'), el('h3', '', name), codeRow);
  panel.append(crosshairStage(code, { label: `Tu mira activa: ${name}` }), info);
  return panel;
}

function importForm({ onSave, onUse }) {
  const form = el('form', 'xh-import');
  form.noValidate = true;
  const title = el('h3', '', 'Importar desde VALORANT');
  title.id = 'xh-import-title';
  form.setAttribute('aria-labelledby', title.id);
  const hint = el(
    'p',
    'xh-hint',
    'En VALORANT: Ajustes → Mira → Importar perfil de mira. Copia el código y pégalo aquí.',
  );
  const codeLabel = el('label', '', 'Código de mira');
  const code = el('textarea');
  code.id = codeLabel.htmlFor = 'xh-import-code';
  code.rows = 2;
  code.spellcheck = false;
  code.placeholder = '0;P;c;5;h;0;0l;4;0o;2;0a;1;0f;0;1b;0';
  const nameLabel = el('label', '', 'Nombre (opcional)');
  const name = el('input');
  name.id = nameLabel.htmlFor = 'xh-import-name';
  name.maxLength = 24;
  name.placeholder = 'Mi mira de rankeds';
  const feedback = el('p', 'xh-feedback');
  feedback.id = 'xh-import-feedback';
  feedback.setAttribute('aria-live', 'polite');
  code.setAttribute('aria-describedby', feedback.id);
  const preview = crosshairStage('', { label: 'Vista previa del código pegado' });
  const save = button('Guardar en mi colección', 'secondary');
  save.type = 'submit';
  const use = button('Usar esta mira', 'primary', () =>
    onUse({ name: name.value.trim(), code: code.value.trim() }),
  );

  function validate() {
    const value = code.value.trim();
    paintStage(preview.querySelector('canvas'), value);
    let error = '';
    try {
      if (value) parseCode(value);
    } catch (problem) {
      error = problem.message;
    }
    const isReady = Boolean(value) && !error;
    save.disabled = use.disabled = !isReady;
    code.setAttribute('aria-invalid', String(Boolean(error)));
    feedback.classList.toggle('is-error', Boolean(error));
    feedback.textContent =
      error ||
      (isReady
        ? 'Código válido. Así se verá en la arena.'
        : 'Pega un código para ver la vista previa.');
  }
  code.oninput = validate;
  form.onsubmit = (event) => {
    event.preventDefault();
    try {
      onSave({ name: name.value, code: code.value });
      form.reset();
      validate();
    } catch (problem) {
      feedback.classList.add('is-error');
      feedback.textContent = problem.message;
    }
  };
  const fields = el('div', 'xh-import-fields');
  const row = el('div', 'xh-import-actions');
  row.append(save, use);
  fields.append(codeLabel, code, feedback, nameLabel, name, row);
  const body = el('div', 'xh-import-body');
  body.append(fields, preview);
  form.append(title, hint, body);
  validate();
  return { form, code };
}

function gallerySection(title, count, cards, empty) {
  const section = el('section', 'xh-section');
  const heading = el('h3', '', title);
  heading.tabIndex = -1;
  if (count) heading.append(el('span', 'xh-count', count));
  const grid = el('div', 'xh-grid');
  grid.append(...cards);
  section.append(heading, cards.length ? grid : el('p', 'xh-empty', empty));
  return section;
}

/** "Miras": active crosshair, VALORANT import and the preset + personal gallery. */
export function installCrosshairPage(root, { getCode, applyCode }) {
  const toast = el('p', 'xh-toast');
  toast.setAttribute('role', 'status');
  let toastTimer = 0;
  let importField = null;
  const say = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), TOAST_MS);
  };

  const use = ({ name, code }) => {
    applyCode(code);
    render();
    say(
      `«${name || crosshairName(code, readCollection())}» es tu mira activa. Ya la verás en la arena.`,
    );
  };
  const copy = async ({ code }) => {
    if (await copyCrosshairCode(code)) return say('Código copiado.');
    importField.value = code;
    importField.dispatchEvent(new Event('input'));
    importField.focus();
    importField.select();
    say('Tu navegador no dejó copiar solo: el código quedó seleccionado en Importar.');
  };
  const saveToCollection = ({ name, code }) => {
    saveCollection(addCrosshair(readCollection(), { name, code }));
    render();
    say('Mira guardada en tu colección.');
  };
  const remove = ({ code }) => {
    saveCollection(removeCrosshair(readCollection(), code));
    render();
    root.querySelector('.xh-collection h3')?.focus();
    say('Mira borrada de tu colección.');
  };

  function render() {
    const active = getCode().trim();
    const collection = readCollection();
    const cardFor = (mira, own) =>
      crosshairCard(mira, {
        isActive: mira.code === active,
        onUse: use,
        onCopy: copy,
        onRemove: own ? remove : null,
      });
    const { form, code } = importForm({ onSave: saveToCollection, onUse: use });
    importField = code;
    const top = el('div', 'xh-top');
    top.append(activePanel(active, collection, copy), form);
    const mine = gallerySection(
      'Tu colección',
      `${collection.length}/${COLLECTION_LIMIT}`,
      collection.map((mira) => cardFor(mira, true)),
      'Aún no guardas miras propias. Importa tu código de VALORANT arriba y guárdalo aquí.',
    );
    mine.classList.add('xh-collection');
    const presets = gallerySection(
      'Diseños WadriAim',
      '',
      CROSSHAIR_PRESETS.map((mira) => cardFor(mira, false)),
    );
    root.replaceChildren(
      pageHead({
        eyebrow: 'TU MIRA, TU ESTILO',
        title: 'Miras',
        titleId: 'crosshairs-title',
        lead: 'Elige la mira que usarás en la arena, importa la tuya de VALORANT y guarda tus favoritas.',
      }),
      top,
      mine,
      presets,
      toast,
    );
  }
  return { show: render };
}
