import { supabase } from '../account/service.js';
let reporter = null;
export function setLiveActivity(activity = 'browsing', mode = null) {
  reporter?.set(activity, mode);
}
export function installActivityPresence() {
  if (!supabase) return { dispose() {} };
  const token = crypto.randomUUID();
  let state = { current_activity: 'browsing', current_mode: null },
    accessToken = null;
  let sending = false,
    pending = false,
    disposed = false;
  async function ping() {
    if (disposed) return;
    if (sending) {
      pending = true;
      return;
    }
    sending = true;
    try {
      const { data } = await supabase.auth.getSession();
      accessToken = data.session?.access_token || null;
      await supabase.rpc('activity_ping', { session_token: token, ...state });
    } catch {
      /* Presence never blocks training. Stale sessions expire on the server. */
    } finally {
      sending = false;
      if (pending && !disposed) {
        pending = false;
        void ping();
      }
    }
  }
  const leave = () => {
    const env = import.meta.env;
    void fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/activity_ping`, {
      method: 'POST',
      keepalive: true,
      headers: {
        apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ session_token: token, ...state, leaving: true }),
    }).catch(() => {});
  };
  const visibility = () => {
    if (!document.hidden) void ping();
  };
  reporter = {
    set(activity, mode) {
      state = { current_activity: activity, current_mode: activity === 'browsing' ? null : mode };
      void ping();
    },
  };
  const interval = setInterval(ping, 20000);
  const subscription = supabase.auth.onAuthStateChange(() => {
    setTimeout(ping, 0);
  });
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', visibility);
  void ping();
  return {
    dispose() {
      leave();
      disposed = true;
      reporter = null;
      clearInterval(interval);
      subscription.data.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', leave);
      window.removeEventListener('pageshow', visibility);
    },
  };
}
