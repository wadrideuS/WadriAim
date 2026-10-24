import { save } from '../lib/storage.js';
import {
  saveTeamPreferences,
  updateIdentity,
  usernamePattern,
  normalizeUsername,
  humanError,
} from './service.js';
import { vctTeams, vctRegions, teamById, teamPalette } from '../data/vct-teams.js';
import { teamLogos } from '../data/team-logos.js';
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function teamBadge(team, className = 'team-badge') {
  const badge = el('div', className);
  if (team && teamLogos[team.id]) {
    const image = el('img');
    image.src = teamLogos[team.id];
    image.alt = team.name;
    image.loading = 'lazy';
    badge.append(image);
  } else badge.textContent = team?.tag || 'VCT';
  return badge;
}
function applyTeam(team) {
  const id = 'team-' + team.id,
    p = teamPalette(team);
  const select = document.querySelector('.palette-select');
  save('wa-palette', id);
  save('wa-palette-revision', 2);
  if (select) {
    select.value = id;
    select.dispatchEvent(new Event('change'));
    return;
  }
  document.body.dataset.palette = id;
  for (const [key, value] of Object.entries({
    '--palette-accent': p.accent,
    '--palette-secondary': p.secondary || p.accent,
    '--palette-bg': p.bg,
    '--palette-panel': p.panel,
    '--arena-bg': p.arena,
    '--arena-floor': p.floor,
  }))
    document.body.style.setProperty(key, value);
}
export async function chooseTeam(account, { force = false } = {}) {
  if (!account || (account.profile.team_setup_complete && !force)) return;
  return new Promise((resolve) => {
    const dialog = el('dialog', 'team-picker');
    dialog.setAttribute('aria-labelledby', 'team-picker-title');
    dialog.innerHTML =
      '<p class="eyebrow">TU EQUIPO. TUS COLORES.</p><h2 id="team-picker-title">¿A quién apoyas?</h2><p>Elige tu equipo favorito. Sus colores acompañarán tu entrenamiento y su logo aparecerá en tu perfil.</p><small>Socios oficiales VCT · temporada 2027</small><input class="team-search" type="search" placeholder="Buscar equipo o tag" aria-label="Buscar equipo"><div class="team-regions"></div><div class="team-grid"></div><p class="team-message" role="status"></p><div class="team-actions"><button type="button" class="text-action" data-skip>Omitir por ahora</button><button type="button" class="primary" data-save>Guardar y continuar</button></div>';
    let region = teamById(account.profile.favorite_team)?.region || 'americas';
    let chosen = account.profile.favorite_team || '',
      busy = false;
    const tabs = dialog.querySelector('.team-regions');
    for (const [id, label] of vctRegions) {
      const button = el('button', '', label);
      button.type = 'button';
      button.dataset.region = id;
      button.onclick = () => {
        region = id;
        render();
      };
      tabs.append(button);
    }
    const search = dialog.querySelector('.team-search');
    search.oninput = render;
    function render() {
      tabs.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('selected', button.dataset.region === region);
        button.setAttribute('aria-pressed', String(button.dataset.region === region));
      });
      const grid = dialog.querySelector('.team-grid');
      grid.replaceChildren();
      const term = search.value.trim().toLowerCase();
      const list = vctTeams.filter(
        (team) =>
          (term || team.region === region) &&
          `${team.name} ${team.tag}`.toLowerCase().includes(term),
      );
      for (const team of list) {
        const card = el('button', 'team-choice');
        card.type = 'button';
        card.style.setProperty('--team-color', team.color);
        card.classList.toggle('selected', chosen === team.id);
        card.setAttribute('aria-pressed', String(chosen === team.id));
        card.append(teamBadge(team), el('strong', '', team.name));
        card.onclick = () => {
          chosen = team.id;
          render();
        };
        grid.append(card);
      }
      if (!list.length) grid.append(el('p', '', 'No encontramos ese equipo.'));
      dialog.querySelector('[data-save]').disabled = !chosen || busy;
    }
    async function finish(skip) {
      if (busy) return;
      busy = true;
      render();
      const message = dialog.querySelector('.team-message');
      message.textContent = 'Guardando…';
      try {
        account.profile = await saveTeamPreferences(account.user.id, skip ? '' : chosen, '');
        if (!skip) applyTeam(teamById(chosen));
        dialog.close();
        dialog.remove();
        resolve();
      } catch (error) {
        message.textContent = humanError(error);
        busy = false;
        render();
      }
    }
    dialog.querySelector('[data-save]').onclick = () => finish(false);
    dialog.querySelector('[data-skip]').onclick = () => finish(true);
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    document.body.append(dialog);
    render();
    dialog.showModal();
  });
}
export async function chooseSocialUsername(account) {
  if (!account?.profile.needs_username) return;
  return new Promise((resolve) => {
    const dialog = el('dialog', 'account-dialog');
    dialog.innerHTML =
      '<h2>Elige tu usuario único</h2><p>Tu cuenta ya está conectada. Solo falta elegir cómo te encontrarán tus amigos.</p><form><label>Usuario<input required minlength="3" maxlength="20" pattern="[a-zA-Z0-9_]{3,20}" autocomplete="username"></label><button class="primary">Continuar</button></form><p role="status"></p>';
    dialog.querySelector('form').onsubmit = async (event) => {
      event.preventDefault();
      const button = dialog.querySelector('button');
      button.disabled = true;
      try {
        const username = normalizeUsername(dialog.querySelector('input').value);
        if (!usernamePattern.test(username))
          throw Error('Usa de 3 a 20 letras, números o guion bajo.');
        account.profile = await updateIdentity(
          account.user.id,
          username,
          account.profile.display_name || '',
        );
        dialog.close();
        dialog.remove();
        resolve();
      } catch (error) {
        dialog.querySelector('[role=status]').textContent = humanError(error);
        button.disabled = false;
      }
    };
    dialog.addEventListener('cancel', (event) => event.preventDefault());
    document.body.append(dialog);
    dialog.showModal();
  });
}
