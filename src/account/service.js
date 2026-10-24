import { createClient } from '@supabase/supabase-js';
const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase =
  url && key
    ? createClient(url, key, {
        global: {
          fetch: (input, options = {}) =>
            fetch(input, {
              ...options,
              signal: options.signal
                ? AbortSignal.any([options.signal, AbortSignal.timeout(12000)])
                : AbortSignal.timeout(12000),
            }),
        },
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          lockAcquireTimeout: 8000,
        },
      })
    : null;
export const usernamePattern = /^[a-z0-9_]{3,20}$/;
export function normalizeUsername(value) {
  return value.trim().toLowerCase();
}
export function validateAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw Error('Usa una foto JPG, PNG o WebP.');
  if (file.size > 2 * 1024 * 1024) throw Error('La foto debe pesar menos de 2 MB.');
}
function checked(result) {
  if (result.error) throw result.error;
  return result.data;
}
export async function loadAccount() {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  const profile = checked(
    await supabase
      .from('profiles')
      .select(
        'id,username,display_name,avatar_path,favorite_team,country,team_setup_complete,needs_username',
      )
      .eq('id', data.user.id)
      .single(),
  );
  const settings = checked(
    await supabase.from('player_settings').select('key,value').eq('user_id', data.user.id),
  );
  return {
    user: data.user,
    profile,
    settings: Object.fromEntries(settings.map((row) => [row.key, row.value])),
  };
}
export async function saveSetting(userId, key, value) {
  checked(await supabase.from('player_settings').upsert({ user_id: userId, key, value }));
}
export async function updateIdentity(userId, username, displayName) {
  username = normalizeUsername(username);
  if (!usernamePattern.test(username)) throw Error('Usuario: 3–20 letras, números o guion bajo.');
  return checked(
    await supabase
      .from('profiles')
      .update({ username, display_name: displayName.trim().slice(0, 40), needs_username: false })
      .eq('id', userId)
      .select(
        'id,username,display_name,avatar_path,favorite_team,country,team_setup_complete,needs_username',
      )
      .single(),
  );
}
export async function avatarUrl(path) {
  if (!path) return null;
  return checked(await supabase.storage.from('avatars').createSignedUrl(path, 3600)).signedUrl;
}
export async function uploadAvatar(userId, file) {
  validateAvatar(file);
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const size = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - size) / 2,
    (bitmap.height - size) / 2,
    size,
    size,
    0,
    0,
    256,
    256,
  );
  bitmap.close();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
  if (!blob) throw Error('No pudimos preparar la foto.');
  const path = userId + '/avatar.webp';
  checked(
    await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '0' }),
  );
  checked(await supabase.from('profiles').update({ avatar_path: path }).eq('id', userId));
  return path;
}
export async function getFriends(userId) {
  const rows = checked(
    await supabase
      .from('friendships')
      .select('id,requester,recipient,status')
      .or('requester.eq.' + userId + ',recipient.eq.' + userId),
  );
  const ids = [
    ...new Set(rows.map((row) => (row.requester === userId ? row.recipient : row.requester))),
  ];
  if (!ids.length) return [];
  const profiles = checked(
    await supabase
      .from('profiles')
      .select(
        'id,username,display_name,avatar_path,favorite_team,country,team_setup_complete,needs_username',
      )
      .in('id', ids),
  );
  return rows.map((row) => ({
    ...row,
    person: profiles.find(
      (p) => p.id === (row.requester === userId ? row.recipient : row.requester),
    ),
  }));
}
export async function requestFriend(username) {
  checked(await supabase.rpc('request_friend', { friend_username: normalizeUsername(username) }));
}
export async function acceptFriend(id) {
  checked(await supabase.rpc('accept_friend', { request_id: id }));
}
export async function removeFriend(id) {
  checked(await supabase.from('friendships').delete().eq('id', id));
}
export function humanError(error) {
  const message = error?.message || String(error);
  if (/unique|duplicate|already.*registered|Database error saving new user/i.test(message))
    return 'Ese usuario o correo ya está registrado. Prueba otro o inicia sesión.';
  if (
    error?.code === 'over_email_send_rate_limit' ||
    /email.*rate.*limit|límite de frecuencia de correo/i.test(message)
  )
    return 'Se alcanzó el límite de envío de correos. Espera antes de solicitar otro; repetir el registro no resolverá el bloqueo.';
  if (/invalid login credentials/i.test(message)) return 'El usuario o la contraseña no coinciden.';
  if (/email not confirmed/i.test(message)) return 'Confirma tu correo antes de iniciar sesión.';
  if (/timeout|timed out|aborted|lock.*acqui/i.test(message) || error?.name === 'TimeoutError')
    return 'La conexión tardó demasiado. Intenta iniciar sesión otra vez.';
  if (/fetch|network|Failed to/i.test(message))
    return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
  return message;
}

export async function usernameAuth(action, username, password) {
  if (!supabase) throw Error('El servidor de cuentas no está conectado.');
  const response = await fetch(`${url}/functions/v1/username-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key },
    signal: AbortSignal.timeout(12000),
    body: JSON.stringify({
      action,
      username: normalizeUsername(username),
      ...(action === 'login' ? { password } : {}),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(payload.error || 'No pudimos conectar con el servidor de cuentas.');
  if (action === 'login') {
    if (!payload.session?.access_token || !payload.session?.refresh_token)
      throw Error('No pudimos iniciar la sesión.');
    const { error } = await supabase.auth.setSession(payload.session);
    if (error) throw error;
  }
  return payload;
}

export async function saveTeamPreferences(userId, team, country = '') {
  return checked(
    await supabase
      .from('profiles')
      .update({ favorite_team: team, country, team_setup_complete: true })
      .eq('id', userId)
      .select(
        'id,username,display_name,avatar_path,favorite_team,country,team_setup_complete,needs_username',
      )
      .single(),
  );
}
export async function availableSocialProviders() {
  if (!supabase) return {};
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw Error('No se pudieron cargar los accesos sociales.');
  return (await response.json()).external || {};
}
export async function signInSocial(provider) {
  if (!['google', 'discord', 'facebook'].includes(provider)) throw Error('Proveedor no válido.');
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: location.origin + '/' },
  });
  if (error) throw error;
}

export async function friendTrainingHistory(userId) {
  return checked(await supabase.rpc('friend_training_history', { friend_id: userId }));
}

export async function getModeRecords(mode) {
  if (!supabase) return [];
  return checked(await supabase.rpc('mode_records', { mode_id:mode }));
}

/** Global top for a mode ({rows, me, players}); empty when the server is not connected. */
export async function getLeaderboard(mode, maxRows = 50) {
  if (!supabase) return { rows: [], me: null, players: 0 };
  return checked(await supabase.rpc('global_leaderboard', { mode_id: mode, max_rows: maxRows }));
}
/** Teams ranked by players who picked them (+1 each). */
export async function getTeamLeaderboard() {
  if (!supabase) return [];
  return checked(await supabase.rpc('team_leaderboard'));
}
