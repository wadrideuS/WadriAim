import { modeThumbnail } from '../features/mode-thumbnails.js';
import { initPalettes } from '../features/palettes.js';
import { read, save } from '../lib/storage.js';
import { exercises } from '../data/exercises.js';
import { cross, parseCode } from '../features/crosshair-code.js';
import { initCrosshairLibrary } from '../features/crosshair-library.js';
import { DEFAULT_CROSSHAIR_CODE } from '../features/crosshair-collection.js';
import { TrainingController } from '../game/TrainingController.js';
import { installProgressPage } from '../pages/progress.js';
import { installRankingPage } from '../pages/ranking.js';
import { installCrosshairPage } from '../pages/crosshairs.js';
export function mountDashboard({ music, account = null } = {}) {
  const $ = (id) => document.getElementById(id);
  let profile = read('wa-profile', { name: '', sens: 0.35, dpi: 800, code: DEFAULT_CROSSHAIR_CODE }),
    history = read('wa-history', []);
  document.body.classList.remove('light');
  save('wa-theme', 'dark');
  initPalettes();
  if (account) profile.name = account.profile.username;
  let filter = 'Todos';
  ['Todos', 'Precisión', 'Velocidad', 'Tracking', 'Utilidad', 'Movimiento', 'Defensa'].forEach((f) => {
    const b = document.createElement('button');
    b.textContent = f === 'Todos' ? 'Todos los ejercicios' : f;
    b.className = f === filter ? 'selected' : '';
    b.onclick = () => {
      filter = f;
      [...$('filters').children].forEach((x) => x.classList.toggle('selected', x === b));
      render();
    };
    $('filters').append(b);
  });
  function render() {
    const list = exercises
      .map((e, i) => ({ e, i }))
      .filter(
        ({ e }) =>
          (filter === 'Todos' || e[1] === filter) &&
          e[0].toLowerCase().includes($('search').value.toLowerCase()),
      );
    $('cards').innerHTML = '';
    list.forEach(({ e, i }) => {
      const card = document.createElement('button');
      card.className = 'card';
      card.innerHTML = `<div class="thumb mode-thumb"><span class="tag">${e[1].toUpperCase()}</span>${modeThumbnail(i)}</div><div class="info"><h3>${e[0]} <span>↗</span></h3><p>${e[2]}</p><div class="meta"><span>◷ ${e[5]==='∞'?'Sin límite':(e[5] || 60)+' segundos'}</span><b>◉ ${e[3]}</b></div></div>`;
      card.onclick = () => openGame(i);
      $('cards').append(card);
    });
    if (!list.length) $('cards').innerHTML = '<p>No encontramos ejercicios con ese nombre.</p>';
  }
  render();
  $('search').oninput = render;
  $('theme').hidden = true;
  function preview() {
    const ctx = $('preview').getContext('2d');
    ctx.clearRect(0, 0, 180, 80);
    try {
      parseCode($('code').value);
      $('error').textContent = '';
      cross(ctx, 90, 40, $('code').value);
    } catch (e) {
      $('error').textContent = e.message;
    }
  }
  let onboarding = !read('wa-onboarded', false);
  function settings() {
    if (account) profile.name = account.profile.username;
    ['name', 'sens', 'dpi', 'code'].forEach((k) => ($(k).value = profile[k]));
    $('name').closest('label').hidden = Boolean(account);
    $('close').hidden = onboarding;
    $('settings').querySelector('h2').textContent = onboarding
      ? 'Bienvenido a WadriAim'
      : 'Tu configuración';
    if (onboarding) {
      $('sens').value = '';
      $('dpi').value = '';
      $('sens').placeholder = 'Ej. 0.35';
      $('dpi').placeholder = 'Ej. 800';
    }
    $('settings').querySelector('form>p').textContent = onboarding
      ? account
        ? 'Configura el DPI de tu ratón, tu sensibilidad de VALORANT y tu mira. Tu usuario ya está vinculado a tu cuenta.'
        : 'Antes de entrenar, indica el DPI de tu ratón y tu sensibilidad de VALORANT. El nombre es opcional.'
      : account
        ? 'Tu configuración se sincroniza con tu cuenta.'
        : 'Sesión de invitado: la configuración se borra al salir.';
    $('settings').showModal();
    preview();
  }
  $('profile').onclick = settings;
  $('configure').onclick = settings;
  $('close').onclick = () => $('settings').close();
  $('code').oninput = preview;
  $('form').onsubmit = (e) => {
    e.preventDefault();
    try {
      parseCode($('code').value);
    } catch (e) {
      $('error').textContent = e.message;
      return;
    }
    profile = {
      name: account ? account.profile.username : $('name').value.trim(),
      sens: Number($('sens').value),
      dpi: Number($('dpi').value),
      code: $('code').value.trim(),
    };
    save('wa-profile', profile);
    save('wa-onboarded', true);
    onboarding = false;
    updateProfile();
    $('settings').close();
    refreshView();
  };
  function updateProfile() {
    $('profile').textContent = (profile.name || 'W') + ' · Mi perfil ↗';
  }
  updateProfile();
  function patchProfile(patch) {
    profile = { ...profile, ...patch };
    save('wa-profile', profile);
    updateProfile();
  }
  const pages = {
    home: { section: 'gallery', nav: 'home' },
    progress: {
      section: 'stats',
      nav: 'progress',
      page: installProgressPage($('stats'), {
        getHistory: () => history,
        onTrain: () => {
          navigate('home');
          $('gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
        },
      }),
    },
    ranking: { section: 'ranking', nav: 'rankingnav', page: installRankingPage($('ranking'), { account }) },
    crosshairs: {
      section: 'crosshairs',
      nav: 'crosshairsnav',
      page: installCrosshairPage($('crosshairs'), {
        getCode: () => profile.code,
        applyCode: (code) => patchProfile({ code }),
      }),
    },
  };
  let view = 'home';
  document.body.dataset.view = view;
  function navigate(next) {
    view = next;
    document.body.dataset.view = next;
    for (const [name, { section, nav }] of Object.entries(pages)) {
      $(section).hidden = name !== next;
      $(nav).classList.toggle('active', name === next);
      if (name === next) $(nav).setAttribute('aria-current', 'page');
      else $(nav).removeAttribute('aria-current');
    }
    pages[next].page?.show();
    scrollTo({ top: 0 });
  }
  function refreshView() {
    pages[view].page?.show();
  }
  for (const [name, { nav }] of Object.entries(pages)) $(nav).onclick = () => navigate(name);

  $('settings').addEventListener('cancel', (e) => {
    if (onboarding) e.preventDefault();
  });

  const game = new TrainingController({
    music,
    getProfile: () => profile,
    updateProfile: patchProfile,
    onComplete: (record) => {
      history = [...history, record].slice(-100);
      save('wa-history', history);
      if (view === 'progress') refreshView();
    },
    onShowTraining: () => navigate('home'),
    onShowProgress: () => navigate('progress'),
  });
  $('quick').onclick = () => openGame(0);
  function openGame(i) {
    if (onboarding) {
      settings();
      return;
    }
    game.open(i);
  }
  settings = initCrosshairLibrary({ settings, preview });
  if (onboarding) settings();
  return {
    dispose: () => {
      game.dispose();
      pages.ranking.page.dispose();
    },
  };
}
