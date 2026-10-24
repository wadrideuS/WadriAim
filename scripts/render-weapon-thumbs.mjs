/**
 * Pre-renders the weapon pictures used by "Elige tu arma".
 *
 *   npm run dev                              (in another terminal)
 *   node scripts/render-weapon-thumbs.mjs [http://127.0.0.1:5173]
 *
 * Headless Chrome opens scripts/weapon-thumbs/index.html, which renders every
 * GLB in profile with a transparent background and leaves each WebP as a data
 * URL in the DOM. This script reads them over the DevTools protocol and writes
 * public/weapons/<id>.webp.
 */
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME_PATHS = {
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  linux: 'google-chrome',
  win32: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
};
const DEBUG_PORT = 9333;
const POLL_MS = 500;
const RENDER_TIMEOUT_MS = 120_000;
const OUTPUT_DIR = new URL('../public/weapons/', import.meta.url);

const origin = process.argv[2] ?? 'http://127.0.0.1:5173';
const chrome = process.env.CHROME_PATH ?? CHROME_PATHS[process.platform];

async function waitForDevtools() {
  for (let elapsed = 0; elapsed < RENDER_TIMEOUT_MS; elapsed += POLL_MS) {
    try {
      return await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
    } catch {
      await sleep(POLL_MS);
    }
  }
  throw new Error('Chrome no abrió el puerto de DevTools.');
}

function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let nextId = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, (message) =>
        message.error ? reject(new Error(message.error.message)) : resolve(message.result),
      );
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  return new Promise((resolve, reject) => {
    socket.onopen = () => resolve({ send, close: () => socket.close() });
    socket.onerror = () => reject(new Error('No se pudo conectar con Chrome.'));
  });
}

/** Returns { id: dataUrl } once the harness page reports it is done. */
async function renderThumbs(browser) {
  const { targetId } = await browser.send('Target.createTarget', {
    url: `${origin}/scripts/weapon-thumbs/index.html`,
  });
  const { sessionId } = await browser.send('Target.attachToTarget', { targetId, flatten: true });
  const evaluate = async (expression) =>
    (await browser.send('Runtime.evaluate', { expression, returnByValue: true }, sessionId)).result
      .value;
  for (let elapsed = 0; elapsed < RENDER_TIMEOUT_MS; elapsed += POLL_MS) {
    const state = await evaluate(
      '({ done: document.body?.dataset.done, error: document.body?.dataset.error })',
    );
    if (state?.error) throw new Error(`El render falló: ${state.error}`);
    if (state?.done)
      return evaluate(
        'Object.fromEntries([...document.querySelectorAll("output[data-weapon]")].map((o) => [o.dataset.weapon, o.textContent]))',
      );
    await sleep(POLL_MS);
  }
  throw new Error(
    `El render no terminó en ${RENDER_TIMEOUT_MS / 1000} s. ¿Está corriendo \`npm run dev\` en ${origin}?`,
  );
}

const profile = await mkdtemp(join(tmpdir(), 'wadriaim-thumbs-'));
const chromeProcess = spawn(chrome, [
  '--headless=new',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  'about:blank',
]);
const exited = new Promise((resolve) => chromeProcess.once('exit', resolve));
try {
  const { webSocketDebuggerUrl } = await waitForDevtools();
  const browser = await connect(webSocketDebuggerUrl);
  const thumbs = await renderThumbs(browser);
  browser.send('Browser.close').catch(() => {});
  await mkdir(OUTPUT_DIR, { recursive: true });
  for (const [id, dataUrl] of Object.entries(thumbs)) {
    const bytes = Buffer.from(dataUrl.replace(/^data:image\/webp;base64,/, ''), 'base64');
    await writeFile(new URL(`${id}.webp`, OUTPUT_DIR), bytes);
    console.log(`public/weapons/${id}.webp · ${(bytes.length / 1024).toFixed(1)} KB`);
  }
} finally {
  if (chromeProcess.exitCode === null) chromeProcess.kill();
  await exited;
  await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
