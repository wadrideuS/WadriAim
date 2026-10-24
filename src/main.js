import './styles/app.css';
import './styles/game.css';
import './styles/account.css';
import './styles/arena-entry.css';
import { AmbientMusic } from './audio/AmbientMusic.js';
import { mountDashboard } from './app/dashboard.js';
import { bootAccess, installAccountPanel } from './account/access.js';
import { saveSetting } from './account/service.js';
import { createSyncQueue } from './account/sync.js';
import { installActivityPresence } from './features/live-activity.js';
import { chooseTeam, chooseSocialUsername } from './account/preferences.js';
import { installAdminDashboard } from './account/admin.js';
import { configureStorage } from './lib/storage.js';

import { initPalettes } from './features/palettes.js';
import { installLivingBackground } from './features/living-background.js';
import { installHeroArt } from './features/hero-art.js';

async function start() {
  const background = installLivingBackground();
  const presence = installActivityPresence();
  const account = await bootAccess();
  let panel;
  const queue = account
    ? createSyncQueue({
        write: (key, value) => saveSetting(account.user.id, key, value),
        onError: () => panel?.reportSyncError(),
        onSuccess: () => panel?.reportSynced(),
      })
    : null;
  configureStorage({
    id: account?.user.id,
    initial: account?.settings || {},
    onSave: (key, value) => queue?.save(key, value),
  });
  await chooseSocialUsername(account);
  await chooseTeam(account);
  const profileView = new URL(location.href).searchParams.get('view') === 'profile';
  const music = profileView ? null : new AmbientMusic();
  const app = profileView ? null : mountDashboard({ music, account });
  const heroArt = profileView ? null : installHeroArt();
  if (profileView) initPalettes();
  panel = installAccountPanel(account, { page: profileView });
  if (profileView) await panel.open();
  const admin = await installAdminDashboard(account);
  const online = () => queue?.retry();
  window.addEventListener('online', online);
  if (import.meta.hot)
    import.meta.hot.dispose(() => {
      window.removeEventListener('online', online);
      queue?.dispose();
      panel.dispose();
      app?.dispose();
      heroArt?.dispose();
      music?.dispose();
      background.dispose();
      presence.dispose();
      admin.dispose();
    });
}
start().catch((error) => {
  const notice = document.createElement('p');
  notice.className = 'startup-error';
  notice.textContent = 'No pudimos iniciar WadriAim. Recarga la página para intentarlo de nuevo.';
  document.body.append(notice);
  console.error('WadriAim startup failed', error?.message);
});
