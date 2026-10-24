import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

export function createUsernameHandler({ admin, createAuth, allowAttempt, origins, pause = ms => new Promise(r => setTimeout(r, ms)) }) {
  return async request => {
    const origin = request.headers.get('origin') || '';
    const allowed = origins.includes(origin);
    const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(allowed ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers });
    if (!allowed) return reply({ error: 'Origen no permitido.' }, 403);
    if (request.method !== 'POST') return reply({ error: 'Método no permitido.' }, 405);
    if (Number(request.headers.get('content-length')) > 4096) return reply({ error: 'Solicitud demasiado grande.' }, 413);
    const started = Date.now();
    try {
      const raw = await request.text();
      if (raw.length > 4096) return reply({ error: 'Solicitud demasiado grande.' }, 413);
      const body = JSON.parse(raw);
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
      const recovery = body.action === 'recover';
      if (!['login', 'recover'].includes(body.action) || !/^[a-z0-9_]{3,20}$/.test(username)) return reply({ error: 'Escribe un usuario válido.' }, 400);
      if (!recovery && (typeof body.password !== 'string' || !body.password.length || body.password.length > 1024)) return reply({ error: 'Usuario o contraseña incorrectos.' }, 400);
      // Persistent service-only gate; never reveal addresses through the public API.
      if (!await allowAttempt(username, recovery)) return reply({ error: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }, 429);
      const profile = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
      if (profile.error) throw profile.error;
      let email = null;
      if (profile.data) {
        const result = await admin.auth.admin.getUserById(profile.data.id);
        if (result.error) throw result.error;
        email = result.data.user?.email || null;
      }
      const auth = createAuth();
      if (recovery) {
        if (email) {
          const redirectTo = `${origin}/?recovery=1`;
          const { error } = await auth.auth.resetPasswordForEmail(email, { redirectTo });
          // Do not vary the public recovery response according to account existence.
          if (error) console.error('Password recovery delivery failed:', error.code || error.status || 'mail');
        }
        await pause(Math.max(0, 900 - (Date.now() - started)));
        return reply({ message: 'Si el usuario coincide con una cuenta, recibirás un correo para restablecer tu contraseña.' });
      }
      // Even missing usernames take the Auth route, with an unreachable placeholder.
      const { data, error } = await auth.auth.signInWithPassword({ email: email || 'unknown@invalid.invalid', password: body.password });
      await pause(Math.max(0, 700 - (Date.now() - started)));
      if (error || !email || !data.session) return reply({ error: 'Usuario o contraseña incorrectos, o cuenta pendiente de confirmar.' }, 401);
      return reply({ session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token } });
    } catch {
      return reply({ error: 'No pudimos completar la solicitud. Inténtalo de nuevo.' }, 503);
    }
  };
}

if (typeof Deno !== 'undefined') {
  const url = Deno.env.get('SUPABASE_URL');
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), options);
  const handler = createUsernameHandler({
    admin,
    createAuth: () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY'), options),
    origins: ['https://wadriaim.vercel.app', 'http://127.0.0.1:8772', 'http://127.0.0.1:8773', 'http://127.0.0.1:5173'],
    allowAttempt: async (username, recovery) => {
      const { data, error } = await admin.rpc('allow_username_auth_attempt', { candidate: username, recovery });
      if (error) throw error;
      return data === true;
    },
  });
  Deno.serve(handler);
}
