import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WeaponAudio } from '../src/audio/WeaponAudio.js';
function fake() {
  const created = [];
  const context = {
    createGain: () => ({
      gain: { value: 1 },
      connect() {
        return this;
      },
    }),
    createBufferSource() {
      const source = {
        connect() {
          return this;
        },
        start() {},
        stop() {
          this.stopped = true;
        },
      };
      created.push(source);
      return source;
    },
  };
  const a = new WeaponAudio();
  a.context = context;
  a.master = {};
  return { a, created };
}
test('shot samples retain the requested short clip and smooth end', () => {
  for (const id of ['phantom', 'vandal', 'ghost', 'sheriff', 'guardian']) {
    const packs = JSON.parse(
      fs.readFileSync(new URL('../src/data/sound-packs.json', import.meta.url)),
    );
    const b = fs.readFileSync(new URL('../public/' + packs[id].shot, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    const duration = b.readUInt32LE(40) / b.readUInt32LE(28);
    assert(Math.abs(duration - (id === 'phantom' ? 0.72 : 0.48)) < 0.001);
    assert.equal(b.readInt16LE(b.length - 2), 0);
  }
});
test('shots do not cancel earlier shots; release/pause can preserve tails', () => {
  const { a, created } = fake();
  a.buffers.set('vandalshot', {});
  a.sample('vandal', 'shot');
  a.sample('vandal', 'shot');
  assert(!created[0].stopped);
  a.stop({ preserveTails: true });
  assert(created.every((s) => !s.stopped));
});
test('default kill sound cycles 1..5 then 1 on every weapon without cutting the fifth', () => {
  const { a, created } = fake();
  const buffers = [];
  for (let n = 1; n <= 5; n++) {
    const b = { number: n };
    buffers.push(b);
    a.buffers.set('sharedkill' + n, b);
  }
  for (let n = 1; n <= 7; n++) a.confirm(false, 'ghost', n);
  assert.deepEqual(
    created.map((s) => s.buffer.number),
    [1, 2, 3, 4, 5, 1, 2],
  );
  assert(!created[4].stopped);
  a.stop({ preserveTails: true });
  assert(!created[4].stopped);
});

test('weapon-specific kills and impacts stay isolated to Vandal', () => {
  const { a, created } = fake();
  for (let n = 1; n <= 5; n++) {
    a.buffers.set('vandalkill' + n, { owner: 'vandal', n });
    a.buffers.set('sharedkill' + n, { owner: 'shared', n });
  }
  a.buffers.set('vandalbodyhit', { kind: 'body' });
  a.buffers.set('vandalheadshot', { kind: 'head' });
  for (let n = 1; n <= 6; n++) a.confirm(false, 'vandal', n);
  for (const id of ['phantom', 'ghost', 'sheriff', 'guardian']) {
    a.confirm(false, id, 1);
    a.impact('head', id);
  }
  a.impact('body', 'vandal');
  a.impact('head', 'vandal');
  assert.deepEqual(
    created.slice(0, 6).map((s) => s.buffer.n),
    [1, 2, 3, 4, 5, 1],
  );
  assert(created.slice(0, 6).every((s) => s.buffer.owner === 'vandal'));
  assert(created.slice(6, 10).every((s) => s.buffer.owner === 'shared'));
  assert.deepEqual(
    created.slice(10).map((s) => s.buffer.kind),
    ['body', 'head'],
  );
});

test('active Vandal effects begin at their attack without leading silence', () => {
  const packs = JSON.parse(
    fs.readFileSync(new URL('../src/data/sound-packs.json', import.meta.url)),
  );
  for (const kind of [
    'shot',
    'bodyhit',
    'headshot',
    'kill1',
    'kill2',
    'kill3',
    'kill4',
    'kill5',
    'reload',
  ]) {
    const b = fs.readFileSync(
      new URL('../public/' + (packs.vandal[kind] || packs.shared[kind]), import.meta.url),
    );
    const rate = b.readUInt32LE(24);
    let energy = 0;
    for (let i = 0; i < Math.floor(rate * 0.025); i++)
      energy += (b.readInt16LE(44 + i * 2) / 32768) ** 2;
    assert(Math.sqrt(energy / (rate * 0.025)) > 0.005, kind + ' has a late attack');
  }
});

test('Vandal selects the showcase only for hits, and isolated taps only for air shots', () => {
  const { a, created } = fake();
  a.buffers.set('vandalshot', { kind: 'air' });
  a.buffers.set('vandalbodyhit', { kind: 'body' });
  for (let n = 1; n <= 5; n++) a.buffers.set('vandalkill' + n, { kind: 'kill', n });
  const miss = [];
  assert.equal(a.combinedHitAvailable('vandal', miss), false);
  for (let n = 1; n <= 6; n++) {
    const events = [
      { type: 'impact', part: 'body' },
      { type: 'kill', killCount: n },
    ];
    assert.equal(a.combinedHitAvailable('vandal', events), true);
    assert.equal(a.combinedHitAvailable('phantom', events), false);
    // The controller suppresses the air shot and duplicate impact for fatal hits.
    a.confirm(false, 'vandal', n);
    events.forEach((e) => (e.sounded = true));
    assert.equal(a.combinedHitAvailable('vandal', events), false);
  }
  assert.deepEqual(
    created.map((s) => s.buffer.n),
    [1, 2, 3, 4, 5, 1],
  );
  assert.equal(a.combinedHitAvailable('vandal', [{ type: 'impact', part: 'body' }]), true);
});

test('Sheriff Singularity cycles five exclusive clips and replaces the extra shot on a kill', () => {
  const { a, created } = fake();
  const packs = JSON.parse(
    fs.readFileSync(new URL('../src/data/sound-packs.json', import.meta.url)),
  );
  for (let n = 1; n <= 5; n++) {
    const file = packs.sheriff['kill' + n];
    assert(file.startsWith('audio/sheriff/showcase-'));
    const b = fs.readFileSync(new URL('../public/' + file, import.meta.url));
    assert.equal(b.toString('ascii', 0, 4), 'RIFF');
    a.buffers.set('sheriffkill' + n, { n });
  }
  for (let n = 1; n <= 7; n++) {
    const events = [{ type: 'kill', killCount: n }];
    assert.equal(a.combinedHitAvailable('sheriff', events), true);
    assert.equal(a.combinedHitAvailable('ghost', events), false);
    a.confirm(false, 'sheriff', n);
  }
  assert.deepEqual(
    created.map((s) => s.buffer.n),
    [1, 2, 3, 4, 5, 1, 2],
  );
  assert.equal(a.combinedHitAvailable('sheriff', []), false);
});

test('Phantom tap and held fire emit one sample per simulated bullet, with no extra voice on release', async () => {
  const { TrainingSession } = await import('../src/game/TrainingSession.js');
  const { a, created } = fake();
  a.buffers.set('phantomshot', {});
  const session = new TrainingSession();
  session.reset(0, 'phantom');
  session.start();
  if (session.shoot()) a.shot('phantom');
  assert.equal(created.length, 1);
  for (let i = 0; i < 60; i++) {
    const before = session.shots;
    session.tick(1 / 120, { keys: new Set(), fire: true });
    if (session.shots > before) a.shot('phantom');
  }
  assert(session.shots >= 5);
  assert.equal(created.length, session.shots);
  const afterRelease = created.length;
  session.tick(0.05, { keys: new Set(), fire: false });
  assert.equal(created.length, afterRelease);
});

test('Phantom automatic fire keeps the isolated tap tail instead of slicing burst fragments', () => {
  const {a,created}=fake();
  a.buffers.set('phantomshot',{isolated:true});
  a.buffers.set('phantomburst0',{fragment:true});
  a.shot('phantom'); a.shot('phantom',true); a.shot('phantom',true);
  assert.equal(created.length,3);
  assert(created.every(s=>s.buffer.isolated && !s.stopped));
  a.stop({preserveTails:true});
  assert(created.every(s=>!s.stopped));
});
