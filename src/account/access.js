import { read } from '../lib/storage.js';
import { chooseTeam, teamBadge } from './preferences.js';
import { teamById } from '../data/vct-teams.js';
import { summarizeHistory, statsTable } from './stats.js';
import { exercises } from '../data/exercises.js';
import {
  supabase,
  usernameAuth,
  loadAccount,
  normalizeUsername,
  usernamePattern,
  humanError,
  updateIdentity,
  uploadAvatar,
  avatarUrl,
  getFriends,
  requestFriend,
  acceptFriend,
  removeFriend,
  friendTrainingHistory,
  availableSocialProviders,
  signInSocial,
} from './service.js';
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, handler, className = 'secondary') {
  const b = el('button', className, text);
  b.type = 'button';
  b.onclick = handler;
  return b;
}
const FIELD_ICON = {
  user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.2 19.4c1.5-3 3.9-4.5 6.8-4.5s5.3 1.5 6.8 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4 7.5 12 13l8-5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5.5" y="10.5" width="13" height="9" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8.2 10.5V8.2a3.8 3.8 0 0 1 7.6 0v2.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  eye: '<svg class="icon-show" viewBox="0 0 24 24" aria-hidden="true"><path d="M2.8 12S6.2 6.8 12 6.8 21.2 12 21.2 12 17.8 17.2 12 17.2 2.8 12 2.8 12Z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
  eyeOff:
    '<svg class="icon-hide" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5 19.5 19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M9.2 7.2A8 8 0 0 1 12 6.8C17.8 6.8 21.2 12 21.2 12a16 16 0 0 1-3.1 3.4M14.4 14.6A2.6 2.6 0 0 1 9.6 12M6.2 8.4A16 16 0 0 0 2.8 12S6.2 17.2 12 17.2a9 9 0 0 0 2.6-.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  guest:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5.2 19.4c1.5-3 3.9-4.5 6.8-4.5s5.3 1.5 6.8 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
};
const SOCIAL_ICON = {
  google:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l.1.1 6.3 5.3C36.9 41.6 44 36 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>',
  discord:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#5865F2" d="M19.27 5.33A16.4 16.4 0 0 0 15.4 4l-.4.83a14.7 14.7 0 0 1 3.65 1.48 15.2 15.2 0 0 0-13.3 0A12.6 12.6 0 0 1 9 4.83L8.6 4a16.4 16.4 0 0 0-3.87 1.33C1.96 9.02 1.3 12.55 1.55 16.04A16.6 16.6 0 0 0 6.7 18.7l.64-1.07a10.7 10.7 0 0 1-1.68-.82l.42-.33a12.2 12.2 0 0 0 10.84 0l.42.33c-.53.33-1.1.61-1.68.82l.64 1.07a16.6 16.6 0 0 0 5.15-2.66c.48-4.06-.82-7.56-2.58-10.71ZM8.7 14.1c-.98 0-1.78-.92-1.78-2.04s.78-2.04 1.78-2.04 1.8.92 1.78 2.04c0 1.12-.78 2.04-1.78 2.04Zm6.6 0c-.98 0-1.78-.92-1.78-2.04s.78-2.04 1.78-2.04 1.8.92 1.78 2.04c0 1.12-.8 2.04-1.78 2.04Z"/></svg>',
  facebook:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#1877F2" d="M13.5 21v-7.2h2.4l.4-2.8h-2.8V9.2c0-.8.2-1.4 1.4-1.4H16.4V5.2c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 4v2h-2.6v2.8H10.3V21h3.2Z"/></svg>',
};
function accessField(blockId, inputId, label, icon, attrs) {
  return `<div class="field-block" id="${blockId}"><label for="${inputId}">${label}</label><span class="field">${FIELD_ICON[icon]}<input id="${inputId}" ${attrs}></span></div>`;
}
const GUEST_FLAG = 'wadriaim-guest-tab';
function guestRemembered() {
  try {
    return sessionStorage.getItem(GUEST_FLAG) === '1';
  } catch {
    return false;
  }
}
function rememberGuest(on) {
  try {
    if (on) sessionStorage.setItem(GUEST_FLAG, '1');
    else sessionStorage.removeItem(GUEST_FLAG);
  } catch {}
}
export async function bootAccess() {
  // Render the real gallery behind access without enabling training or onboarding.
  const gallery = document.getElementById('cards');
  for (const exercise of exercises) {
    const card = el('article', 'card access-preview-card');
    const thumb = el('div', 'thumb');
    thumb.append(el('i', 'orb'));
    const info = el('div', 'info');
    info.append(el('h3', '', exercise[0]), el('p', '', exercise[2]));
    card.append(thumb, info);
    gallery.append(card);
  }
  document.body.classList.add('access-open');
  const dialog = el('dialog', 'access-dialog');
  dialog.setAttribute('aria-labelledby', 'access-title');
  dialog.innerHTML =
    '<div class="access-brand">⌖ WadriAim</div><p class="eyebrow">TU ZONA. TU PERFIL. TU RITMO.</p><h1 id="access-title">Entra en tu zona.</h1><p class="access-intro">Guarda tu progreso, prepara tu equipo y encuentra a tus amigos.</p><div class="access-tabs" role="tablist" aria-label="Tipo de acceso"><button type="button" role="tab" data-mode="login" aria-selected="true">Iniciar sesión</button><button type="button" role="tab" data-mode="register" aria-selected="false">Crear cuenta</button></div><form id="access-form">' +
    accessField(
      'username-label',
      'access-username',
      'Usuario único',
      'user',
      'autocomplete="username" minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]{3,20}" placeholder="tu_usuario"',
    ) +
    accessField(
      'email-label',
      'access-email',
      'Correo electrónico',
      'mail',
      'type="email" autocomplete="email" required',
    ) +
    `<div class="field-block" id="password-label"><label for="access-password">Contraseña</label><span class="field">${FIELD_ICON.lock}<input id="access-password" type="password" autocomplete="current-password" minlength="8" required><button type="button" class="field-reveal" id="password-reveal" aria-label="Mostrar contraseña" aria-pressed="false">${FIELD_ICON.eye}${FIELD_ICON.eyeOff}</button></span></div>` +
    '<button type="button" class="text-action" id="forgot-password">Olvidé mi contraseña</button><button class="primary" id="access-submit">Iniciar sesión</button></form><p class="access-message" id="access-message" role="status" aria-live="polite"></p><div class="access-divider"><span>o calienta sin cuenta</span></div><button type="button" class="guest-entry" id="guest-entry">' +
    FIELD_ICON.guest +
    '<span>Entrar como invitado</span></button><p class="guest-note">La sesión de invitado dura mientras tengas abierta la pestaña: al cerrarla se restablece.</p>';
  const confirmation = el('section', 'access-confirmation');
  confirmation.hidden = true;
  confirmation.innerHTML =
    '<div class="confirmation-icon" aria-hidden="true">✉</div><h2 id="access-confirmation-title">Confirma tu cuenta</h2><p>Revisa tu correo y confirma tu cuenta. Después podrás iniciar sesión.</p><button type="button" class="primary">Volver a iniciar sesión</button>';
  const formContent = el('div', 'access-content');
  while (dialog.firstChild) formContent.append(dialog.firstChild);
  const social = el('div', 'social-options');
  social.setAttribute('aria-label', 'Accesos sociales');
  for (const [provider, name] of [
    ['google', 'Google'],
    ['discord', 'Discord'],
    ['facebook', 'Facebook'],
  ]) {
    const option = button('', () => run(() => signInSocial(provider)), 'social-login');
    option.innerHTML = SOCIAL_ICON[provider] + '<span>Continuar con ' + name + '</span>';
    option.dataset.provider = provider;
    option.disabled = true;
    option.title = 'No disponible todavía';
    social.append(option);
  }
  formContent.querySelector('.access-divider').before(social);
  dialog.append(formContent, confirmation);
  void availableSocialProviders()
    .then((providers) => {
      social.querySelectorAll('button').forEach((option) => {
        option.disabled = !providers[option.dataset.provider];
        option.title = option.disabled ? 'No disponible todavía' : '';
      });
    })
    .catch(() => {});
  confirmation.querySelector('button').onclick = () => {
    confirmation.hidden = true;
    formContent.hidden = false;
    dialog.classList.remove('confirming');
    dialog.setAttribute('aria-labelledby', 'access-title');
    setMode('login');
  };
  document.body.append(dialog);
  const $ = (id) => dialog.querySelector('#' + id);
  let mode = 'login',
    busy = false;
  let accessResolved = false, interacted = false;
  dialog.addEventListener('input', () => { interacted = true; });
  const recovery = new URL(location.href).searchParams.get('recovery') === '1';
  const setMode = (next) => {
    mode = next;
    social.hidden = !['login', 'register'].includes(mode);
    $('username-label').hidden = mode === 'recover';
    $('access-username').required = mode !== 'recover';
    $('email-label').hidden = mode !== 'register';
    $('access-email').required = mode === 'register';
    $('password-label').hidden = mode === 'request-recovery';
    $('access-password').required = mode !== 'request-recovery';
    $('access-password').minLength = mode === 'login' ? 1 : 8;
    $('access-password').autocomplete =
      mode === 'register' || mode === 'recover' ? 'new-password' : 'current-password';
    $('access-submit').textContent =
      mode === 'register'
        ? 'Crear mi cuenta'
        : mode === 'request-recovery'
          ? 'Recuperar contraseña'
          : mode === 'recover'
            ? 'Guardar nueva contraseña'
            : 'Iniciar sesión';
    $('forgot-password').hidden = mode === 'request-recovery' || mode === 'recover';
    $('access-password').type = 'password';
    $('password-reveal').setAttribute('aria-pressed', 'false');
    $('password-reveal').setAttribute('aria-label', 'Mostrar contraseña');
    dialog.querySelectorAll('[data-mode]').forEach((tab) => {
      const selected = tab.dataset.mode === mode;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
    });
    $('access-message').textContent = '';
    if (dialog.open) {
      ($('username-label').hidden ? $('access-password') : $('access-username')).focus();
    }
  };
  setMode('login');
  dialog
    .querySelectorAll('[data-mode]')
    .forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
  $('password-reveal').onclick = () => {
    const input = $('access-password');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    $('password-reveal').setAttribute('aria-pressed', String(!showing));
    $('password-reveal').setAttribute(
      'aria-label',
      showing ? 'Mostrar contraseña' : 'Ocultar contraseña',
    );
    input.focus();
  };
  dialog.addEventListener('cancel', (e) => e.preventDefault());
  let resolveAccess;
  const result = new Promise((resolve) => (resolveAccess = resolve));
  const finish = (account) => {
    if (accessResolved) return;
    accessResolved = true;
    // remember the guest choice for this tab, so a reload (or the browser
    // discarding a background tab) does not send the player back to the login
    rememberGuest(!account);
    document.body.classList.remove('access-open');
    gallery.replaceChildren();
    dialog.close();
    dialog.remove();
    resolveAccess(account);
  };
  const run = async (work) => {
    if (busy || accessResolved) return;
    interacted = true;
    busy = true;
    dialog.setAttribute('aria-busy', 'true');
    $('access-submit').disabled = true;
    const label = $('access-submit').textContent;
    $('access-submit').textContent = 'Conectando…';
    let timeout;
    try {
      await Promise.race([
        work(),
        new Promise((_, reject) => {
          timeout = setTimeout(
            () => reject(Error('La conexión tardó demasiado. Intenta iniciar sesión otra vez.')),
            20000,
          );
        }),
      ]);
    } catch (error) {
      $('access-message').textContent = humanError(error);
    } finally {
      clearTimeout(timeout);
      busy = false;
      if ($('access-submit').textContent === 'Conectando…') $('access-submit').textContent = label;
      dialog.removeAttribute('aria-busy');
      $('access-submit').disabled = !supabase;
    }
  };
  $('access-form').onsubmit = (e) => {
    e.preventDefault();
    if (!supabase) return;
    run(async () => {
      const email = $('access-email').value.trim(),
        password = $('access-password').value;
      if (mode === 'register') {
        const username = normalizeUsername($('access-username').value);
        if (!usernamePattern.test(username))
          throw Error('Elige de 3 a 20 letras, números o guion bajo.');
        const availability = await supabase.rpc('username_available', { candidate: username });
        if (availability.error) throw availability.error;
        if (!availability.data) throw Error('Ese usuario ya está ocupado. Prueba otro.');
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username }, emailRedirectTo: location.origin + '/' },
        });
        if (error) throw error;
        if (data.session) {
          finish(await loadAccount());
          return;
        }
        confirmation.querySelector('h2').textContent = 'Confirma tu cuenta';
        confirmation.querySelector('p').textContent =
          'Revisa tu correo y confirma tu cuenta. Después podrás iniciar sesión.';
        formContent.hidden = true;
        confirmation.hidden = false;
        dialog.classList.add('confirming');
        dialog.setAttribute('aria-labelledby', 'access-confirmation-title');
        confirmation.querySelector('button').focus();
        $('access-password').value = '';
      } else if (mode === 'request-recovery') {
        await usernameAuth('recover', $('access-username').value);
        showRecoveryConfirmation();
      } else if (mode === 'recover') {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        history.replaceState(null, '', location.pathname);
        finish(await loadAccount());
      } else {
        $('access-message').textContent = 'Verificando usuario y contraseña…';
        await usernameAuth('login', $('access-username').value, password);
        $('access-message').textContent = 'Abriendo tu perfil…';
        const account = await loadAccount();
        if (!account) throw Error('No se pudo recuperar tu sesión. Inténtalo otra vez.');
        finish(account);
      }
    });
  };
  function showRecoveryConfirmation() {
    formContent.hidden = true;
    confirmation.hidden = false;
    confirmation.querySelector('h2').textContent = 'Revisa tu correo';
    confirmation.querySelector('p').textContent =
      'Si el usuario coincide con una cuenta, recibirás un correo para restablecer tu contraseña.';
    dialog.classList.add('confirming');
    dialog.setAttribute('aria-labelledby', 'access-confirmation-title');
    confirmation.querySelector('button').focus();
  }
  $('forgot-password').onclick = () => {
    if (busy) return;
    setMode('request-recovery');
    $('access-username').focus();
  };
  $('guest-entry').onclick = () => {
    if (!busy) finish(null);
  };
  // Returning to the tab after the browser reloaded it: restore the saved
  // account (or the guest session) BEFORE showing the login.
  if (!recovery) {
    const existing = supabase
      ? await Promise.race([loadAccount().catch(() => null), new Promise((ok) => setTimeout(() => ok(undefined), 4000))])
      : null;
    if (existing) {
      finish(existing);
      return result;
    }
    if (guestRemembered() && existing !== undefined) {
      finish(null);
      return result;
    }
  }
  dialog.showModal();
  $('access-username').focus();
  if (!supabase) {
    $('access-message').textContent =
      'Las cuentas estarán disponibles al conectar el servidor. Ya puedes entrenar como invitado.';
    $('access-submit').disabled = true;
    $('forgot-password').disabled = true;
  } else {
    // Restoring a previous session must never disable the login form.
    // Ignore late restoration once the player starts using the form.
    void loadAccount().then((existing) => {
      if (accessResolved || interacted || busy || !existing) return;
      if (recovery) setMode('recover');
      else finish(existing);
    }).catch(() => {
      // An expired/unreachable saved session does not block a fresh sign-in.
    });
  }
  return result;
}
export function installAccountPanel(account, { page = false } = {}) {
  const guest = !account;
  const trigger = el(
    'span',
    'account-trigger',
    guest ? 'Invitado' : '@' + account.profile.username,
  );
  trigger.setAttribute('aria-label', guest ? 'Sesión de invitado' : 'Mi cuenta y amigos');
  document.getElementById('profile').before(trigger);
  const dialog = el(page ? 'section' : 'dialog', page ? 'profile-page' : 'account-dialog profile-dialog');
  document.getElementById('profile').onclick = () => { location.assign(location.origin + '/?view=profile'); };
  if (page) { document.body.classList.add('profile-view'); document.getElementById('profile').hidden = true; }
  dialog.innerHTML =
    '<div class="account-heading"><div><p class="eyebrow">TU IDENTIDAD</p><h2>Mi perfil</h2></div><button type="button" id="account-close" aria-label="Cerrar cuenta">✕</button></div><div id="account-content"></div><p id="account-message" role="status" aria-live="polite"></p><button type="button" class="account-logout">Salir de la sesión</button>';
  document.body.append(dialog);
  const content = dialog.querySelector('#account-content'),
    message = dialog.querySelector('#account-message');
  const status = (text) => {
    message.textContent = text;
  };
  const work = async (fn) => {
    try {
      await fn();
    } catch (error) {
      status(humanError(error));
    }
  };
  dialog.querySelector('#account-close').onclick = () => { if (page) location.href='/'; else dialog.close(); };
  if (page) dialog.querySelector('#account-close').textContent = 'Volver al entrenamiento ↗';
  dialog.querySelector('.account-logout').onclick = () =>
    work(async () => {
      if (!guest) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      rememberGuest(false);
      location.reload();
    });
  async function paintIdentity() {
    const old = trigger.querySelector('img');
    old?.remove();
    if (guest || !account.profile.avatar_path) return;
    const image = el('img', 'mini-avatar');
    image.alt = '';
    image.src = await avatarUrl(account.profile.avatar_path);
    trigger.prepend(image);
  }
  async function openPanel() {
    message.textContent = '';
    content.replaceChildren();
    if (!page && !dialog.open) dialog.showModal();
    if (guest) {
      content.append(
        el(
          'p',
          'guest-description',
          'Estás entrenando como invitado. Tu configuración y resultados se borran al salir. Crea una cuenta para guardar tu progreso, subir tu foto y añadir amigos.',
        ),
      );
      content.append(button('Crear cuenta / iniciar sesión', () => location.reload(), 'primary'));
    } else {
      const team = teamById(account.profile.favorite_team);
      const hero = el('section', 'profile-hero');
      hero.append(teamBadge(team, 'team-badge profile-team-logo'));
      const heading = el('div');
      heading.append(
        el('h3', '', account.profile.display_name || '@' + account.profile.username),
        el('p', '', team ? team.name : 'Elige tu equipo favorito'),
      );
      hero.append(
        heading,
        button(
          'Cambiar equipo',
          () =>
            work(async () => {
              await chooseTeam(account, { force: true });
              await openPanel();
            }),
          'secondary',
        ),
      );
      content.append(hero);
      const rows = summarizeHistory(read('wa-history', []));
      const summary = el('div','profile-summary');
      const aimRows = rows.filter(row => row.mode !== 2);
      const totalHits = aimRows.reduce((sum,row)=>sum+row.hits,0);
      const totalHeads = aimRows.reduce((sum,row)=>sum+row.headshots,0);
      const played = rows.filter(row=>row.sessions);
      for (const [title,value] of [['Sesiones',rows.reduce((sum,row)=>sum+row.sessions,0)],['Headshots',totalHits ? Math.round(totalHeads/totalHits*100)+'%' : '—'],['Precisión media',played.length ? Math.round(played.reduce((sum,row)=>sum+row.accuracy,0)/played.length)+'%' : '—']]) {
        const card=el('div');card.append(el('span','',title),el('strong','',String(value)));summary.append(card);
      }
      content.append(summary);
      const stats = el('section', 'profile-stats');
      stats.append(el('h3', '', 'Tus estadísticas por modo'));
      const tableWrap = el('div', 'profile-table-wrap');
      tableWrap.append(statsTable(summarizeHistory(read('wa-history', []))));
      stats.append(
        tableWrap,
        el(
          'small',
          '',
          'Últimas 100 sesiones guardadas · HS registrados desde esta actualización.',
        ),
      );
      content.append(stats);
      const editing = el('details', 'profile-edit');
      editing.append(el('summary', '', 'Editar foto y datos del perfil'));
      const identity = el('form', 'identity-form');
      const photo = el('div', 'avatar-editor'),
        image = el('img', 'profile-avatar');
      image.alt = 'Foto de perfil';
      const fallback = el(
        'div',
        'avatar-fallback',
        account.profile.username.slice(0, 2).toUpperCase(),
      );
      photo.append(fallback);
      if (account.profile.avatar_path) {
        image.src = await avatarUrl(account.profile.avatar_path);
        fallback.replaceWith(image);
      }
      const uploadLabel = el('label', 'secondary avatar-upload', 'Cambiar foto');
      const upload = el('input');
      upload.type = 'file';
      upload.accept = 'image/png,image/jpeg,image/webp';
      upload.setAttribute('aria-label', 'Cambiar foto de perfil');
      uploadLabel.append(upload);
      upload.onchange = () =>
        work(async () => {
          if (!upload.files[0]) return;
          status('Preparando foto…');
          account.profile.avatar_path = await uploadAvatar(account.user.id, upload.files[0]);
          await paintIdentity();
          status('Foto actualizada.');
          await openPanel();
        });
      photo.append(uploadLabel, el('small', '', 'JPG, PNG o WebP · hasta 2 MB'));
      identity.append(photo);
      const userLabel = el('label', '', 'Usuario único');
      const userInput = el('input');
      userInput.value = account.profile.username;
      userInput.minLength = 3;
      userInput.maxLength = 20;
      userInput.required = true;
      userInput.pattern = '[a-zA-Z0-9_]{3,20}';
      userLabel.append(userInput);
      const nameLabel = el('label', '', 'Nombre visible');
      const nameInput = el('input');
      nameInput.value = account.profile.display_name;
      nameInput.maxLength = 40;
      nameLabel.append(nameInput);
      const submit = el('button', 'primary', 'Guardar perfil');
      submit.type = 'submit';
      identity.append(userLabel, nameLabel, submit);
      identity.onsubmit = (e) => {
        e.preventDefault();
        work(async () => {
          account.profile = await updateIdentity(account.user.id, userInput.value, nameInput.value);
          trigger.textContent = '@' + account.profile.username;
          await paintIdentity();
          status('Perfil guardado.');
        });
      };
      editing.append(identity);
      content.append(editing);
      const friends = el('section', 'friends-panel');
      friends.append(el('h3', '', 'Tus amigos'));
      const addForm = el('form', 'friend-search'),
        search = el('input');
      search.placeholder = 'Usuario de tu amigo';
      search.required = true;
      search.minLength = 3;
      search.maxLength = 20;
      search.setAttribute('aria-label', 'Usuario de tu amigo');
      const add = el('button', 'secondary', 'Enviar solicitud');
      add.type = 'submit';
      addForm.append(search, add);
      friends.append(addForm);
      addForm.onsubmit = (e) => {
        e.preventDefault();
        work(async () => {
          await requestFriend(search.value);
          await renderFriends();
          status('Solicitud enviada.');
          search.value = '';
        });
      };
      const comparison = el('section', 'friend-comparison');
      const list = el('div', 'friend-list');
      friends.append(list);
      const renderFriends = async () => {
        list.replaceChildren();
        const rows = await getFriends(account.user.id);
        if (!rows.length) {
          list.append(el('p', 'empty-friends', 'Busca a tus amigos por su usuario único.'));
          return;
        }
        for (const row of rows) {
          const item = el('div', 'friend-row');
          item.append(el('span', '', '@' + (row.person?.username || 'usuario')));
          const incoming = row.recipient === account.user.id;
          item.append(
            el(
              'small',
              '',
              row.status === 'accepted'
                ? 'Amigos'
                : incoming
                  ? 'Quiere agregarte'
                  : 'Solicitud enviada',
            ),
          );
          if (row.status === 'accepted')
            item.append(
              button(
                'Comparar estadísticas',
                () =>
                  work(async () => {
                    comparison.replaceChildren(el('p', '', 'Cargando estadísticas…'));
                    const history = await friendTrainingHistory(row.person.id);
                    comparison.replaceChildren(el('h3', '', 'Tú vs @' + row.person.username));
                    const wrap = el('div', 'profile-table-wrap');
                    wrap.append(
                      statsTable(
                        summarizeHistory(read('wa-history', [])),
                        summarizeHistory(history),
                      ),
                    );
                    comparison.append(wrap);
                  }),
                'secondary',
              ),
            );
          if (row.status === 'pending' && incoming)
            item.append(
              button('Aceptar', () =>
                work(async () => {
                  await acceptFriend(row.id);
                  await renderFriends();
                }),
              ),
            );
          item.append(
            button(
              row.status === 'accepted' ? 'Quitar' : incoming ? 'Rechazar' : 'Cancelar',
              () =>
                work(async () => {
                  await removeFriend(row.id);
                  await renderFriends();
                }),
              'text-action',
            ),
          );
          list.append(item);
        }
      };
      content.append(friends, comparison);
      await renderFriends();
    }
    if (!page && !dialog.open) dialog.showModal();
  }
  work(paintIdentity);
  const reconnect = button('Volver a iniciar sesión', () => location.reload());
  reconnect.hidden = true;
  dialog.querySelector('#account-message').after(reconnect);
  const authSubscription = supabase?.auth.onAuthStateChange((event, session) => {
    if (guest) return;
    // Focus/refresh events must never navigate away from an active round.
    // A genuinely different identity still needs a fresh, isolated dashboard.
    if (session && session.user.id !== account.user.id) {
      location.reload();
      return;
    }
    if (event === 'SIGNED_OUT') {
      reconnect.hidden = false;
      trigger.dataset.sync = 'error';
      trigger.title = 'Vuelve a iniciar sesión para sincronizar tu progreso';
      status('Tu sesión necesita reconectarse para guardar el progreso en la nube.');
    } else if (session) {
      reconnect.hidden = true;
      delete trigger.dataset.sync;
      trigger.title = 'Perfil sincronizado';
    }
  });
  return {
    open: () => work(openPanel),
    reportSyncError: () => {
      trigger.dataset.sync = 'error';
      trigger.title = 'Hay cambios pendientes de sincronizar';
    },
    reportSynced: () => {
      delete trigger.dataset.sync;
      trigger.title = 'Perfil sincronizado';
    },
    dispose: () => {
      authSubscription?.data.subscription.unsubscribe();
      trigger.remove();
      dialog.remove();
    },
  };
}
