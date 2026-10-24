import { supabase } from './service.js';
import { exercises } from '../data/exercises.js';
const stateNames = { playing: 'Jugando', browsing: 'Navegando', paused: 'En pausa' };
export function summarizeModes(people) {
  return exercises.map((exercise, mode) => ({
    mode,
    name: exercise[0],
    playing: people.filter((person) => person.activity === 'playing' && person.mode === mode)
      .length,
  }));
}
export async function installAdminDashboard(account) {
  const empty = { dispose() {} };
  if (!account || !supabase) return empty;
  const role = await supabase.rpc('is_app_admin');
  if (role.error || role.data !== true) return empty;
  const trigger = document.createElement('button');
  trigger.className = 'admin-trigger';
  trigger.textContent = 'Dashboard';
  trigger.type = 'button';
  document.getElementById('profile').before(trigger);
  const dialog = document.createElement('dialog');
  dialog.className = 'admin-dashboard';
  dialog.innerHTML =
    '<div class="admin-heading"><div><p class="eyebrow">ADMINISTRACIÓN · PRIVADO</p><h2>WadriAim en vivo</h2></div><button class="secondary" data-close type="button">Cerrar ✕</button></div><p class="admin-description">Actividad reciente de usuarios e invitados. Las cuentas con varias pestañas cuentan una vez; los invitados se cuentan por sesión.</p><div class="admin-counters"></div><h3>Jugadores por modo</h3><div class="admin-modes"></div><h3>Quién está conectado</h3><div class="admin-table-wrap"><table><thead><tr><th>Usuario</th><th>Estado</th><th>Modo</th></tr></thead><tbody></tbody></table></div><p class="admin-status" role="status"></p><small>Actualización cada 10 segundos · las conexiones sin respuesta se retiran tras 75 segundos.</small>';
  document.body.append(dialog);
  let timer = null,
    loading = false,
    destroyed = false;
  const status = dialog.querySelector('.admin-status');
  function node(tag, text) {
    const n = document.createElement(tag);
    n.textContent = text;
    return n;
  }
  async function refresh() {
    if (loading || !dialog.open || destroyed) return;
    loading = true;
    try {
      const { data, error } = await supabase.rpc('admin_activity_snapshot');
      if (destroyed || !dialog.open) return;
      if (error || !data) throw error || Error();
      const counters = dialog.querySelector('.admin-counters');
      counters.replaceChildren();
      for (const [title, count] of [
        ['Conectados', data.total],
        ['Jugando', data.playing],
        ['Navegando', data.browsing],
        ['En pausa', data.paused],
      ]) {
        const card = node('div', '');
        card.append(node('span', title), node('strong', String(count)));
        counters.append(card);
      }
      const modes = dialog.querySelector('.admin-modes');
      modes.replaceChildren();
      summarizeModes(data.people).forEach((mode) => {
        const row = node('div', '');
        row.append(node('span', mode.name), node('strong', String(mode.playing)));
        modes.append(row);
      });
      const body = dialog.querySelector('tbody');
      body.replaceChildren();
      data.people.forEach((person) => {
        const row = document.createElement('tr');
        row.append(
          node('td', person.username ? '@' + person.username : 'Invitado'),
          node('td', stateNames[person.activity] || 'Navegando'),
          node('td', person.mode === null ? '—' : exercises[person.mode]?.[0] || '—'),
        );
        body.append(row);
      });
      if (!data.people.length) {
        const row = document.createElement('tr');
        const cell = node('td', 'No hay conexiones recientes.');
        cell.colSpan = 3;
        row.append(cell);
        body.append(row);
      }
      status.textContent = `Actualizado ${new Date(data.updated_at).toLocaleTimeString()} · ${data.members} cuentas · ${data.guests} invitados`;
    } catch {
      status.textContent =
        'No se pudo actualizar la actividad. Los datos visibles pueden estar desactualizados.';
    } finally {
      loading = false;
    }
  }
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  trigger.onclick = () => {
    dialog.showModal();
    void refresh();
    stop();
    timer = setInterval(refresh, 10000);
  };
  dialog.querySelector('[data-close]').onclick = () => dialog.close();
  dialog.addEventListener('close', stop);
  return {
    dispose() {
      destroyed = true;
      stop();
      trigger.remove();
      dialog.remove();
    },
  };
}
