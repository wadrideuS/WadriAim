/**
 * Storage is isolated per identity. Accounts use localStorage (+ cloud sync);
 * guests keep their data only for the current tab (sessionStorage), so a reload
 * does not wipe their settings but closing the tab does.
 */
const guestKey = (k) => 'wa-guest:' + k;
let scope = null;
let memory = new Map();
let sync = null;
export function configureStorage({ id = null, initial = {}, onSave = null } = {}) {
  scope = id;
  memory = new Map(Object.entries(initial));
  sync = onSave;
}
export function read(k, f) {
  if (memory.has(k)) return structuredClone(memory.get(k));
  if (!scope) {
    try {
      const raw = sessionStorage.getItem(guestKey(k));
      return raw === null ? f : JSON.parse(raw);
    } catch {
      return f;
    }
  }
  try {
    return JSON.parse(localStorage.getItem('wa-user:' + scope + ':' + k)) ?? f;
  } catch {
    return f;
  }
}
export function save(k, v) {
  memory.set(k, structuredClone(v));
  if (!scope) {
    try {
      sessionStorage.setItem(guestKey(k), JSON.stringify(v));
    } catch {}
  }
  if (scope) {
    try {
      localStorage.setItem('wa-user:' + scope + ':' + k, JSON.stringify(v));
    } catch {}
    sync?.(k, structuredClone(v));
  }
}
