import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const code = (
  await readFile(new URL('../supabase/functions/username-auth/index.ts', import.meta.url), 'utf8')
).replace(/^\uFEFF?import[^\n]+\n/, '');
const { createUsernameHandler } = await import(
  'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
);
function fixture({ exists = true, valid = true, allowed = true, mailError = false } = {}) {
  const calls = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: (key, value) => ({
          maybeSingle: async () => {
            calls.push(['lookup', value]);
            return { data: exists ? { id: 'private-id' } : null };
          },
        }),
      }),
    }),
    auth: {
      admin: { getUserById: async () => ({ data: { user: { email: 'private@example.test' } } }) },
    },
  };
  const handler = createUsernameHandler({
    admin,
    origins: ['https://wadriaim.vercel.app'],
    allowAttempt: async () => allowed,
    pause: async () => {},
    createAuth: () => ({
      auth: {
        signInWithPassword: async (input) => {
          calls.push(['login', input]);
          return valid
            ? {
                data: {
                  session: {
                    access_token: 'test-access',
                    refresh_token: 'test-refresh',
                    user: { email: 'private@example.test' },
                  },
                },
              }
            : { data: {}, error: {} };
        },
        resetPasswordForEmail: async (email, opts) => {
          calls.push(['reset', email, opts]);
          return { error: mailError ? { code: 'rate_limit' } : null };
        },
      },
    }),
  });
  const send = (body, origin = 'https://wadriaim.vercel.app') =>
    handler(
      new Request('https://functions.test', {
        method: 'POST',
        headers: { origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  return { send, calls };
}
test('username login resolves email internally and returns only session tokens', async () => {
  const { send, calls } = fixture();
  const response = await send({ action: 'login', username: ' My_User ', password: 'secret123' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    session: { access_token: 'test-access', refresh_token: 'test-refresh' },
  });
  assert.deepEqual(calls[0], ['lookup', 'my_user']);
  assert.equal(calls[1][1].email, 'private@example.test');
});
test('missing usernames and bad passwords get the same login response', async () => {
  const missing = await fixture({ exists: false }).send({
    action: 'login',
    username: 'nobody',
    password: 'secret123',
  });
  const bad = await fixture({ valid: false }).send({
    action: 'login',
    username: 'somebody',
    password: 'secret123',
  });
  assert.equal(missing.status, 401);
  assert.equal(bad.status, 401);
  assert.deepEqual(await missing.json(), await bad.json());
});
test('recovery hides account existence and uses a fixed safe redirect', async () => {
  const known = fixture();
  const absent = fixture({ exists: false });
  const a = await known.send({
    action: 'recover',
    username: 'someone',
    redirectTo: 'https://attacker.test',
  });
  const b = await absent.send({ action: 'recover', username: 'nobody' });
  assert.deepEqual(await a.json(), await b.json());
  assert.equal(known.calls[1][2].redirectTo, 'https://wadriaim.vercel.app/?recovery=1');
  assert.equal(absent.calls.length, 1);
});
test('rate limits and untrusted origins prevent all private lookups', async () => {
  const f = fixture({ allowed: false });
  assert.equal(
    (await f.send({ action: 'login', username: 'someone', password: 'secret123' })).status,
    429,
  );
  assert.equal(f.calls.length, 0);
  const g = fixture();
  assert.equal(
    (await g.send({ action: 'recover', username: 'someone' }, 'https://attacker.test')).status,
    403,
  );
  assert.equal(g.calls.length, 0);
});
