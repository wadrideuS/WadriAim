import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { arsenal } from '../src/data/weapons.js';
import { weaponThumbPath, weaponThumbUrl } from '../src/data/weapon-thumbs.js';

const playable = Object.keys(arsenal).filter((id) => id !== 'karambit');

test('every playable weapon maps to its own pre-rendered WebP in public/', () => {
  const paths = playable.map(weaponThumbPath);
  assert.deepEqual(
    paths,
    playable.map((id) => `weapons/${id}.webp`),
  );
  for (const path of paths) {
    const bytes = fs.readFileSync(new URL('../public/' + path, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', path);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', path);
    assert(bytes.length > 2_000 && bytes.length < 120_000, `${path} pesa ${bytes.length} bytes`);
  }
});

test('the knife and unknown ids have no thumbnail, so the card falls back to text', () => {
  assert.equal(weaponThumbPath('karambit'), null);
  assert.equal(weaponThumbPath('operator'), null);
  assert.equal(weaponThumbUrl('karambit'), null);
});

test('thumbnail URLs are served from the app base path', () => {
  assert.equal(weaponThumbUrl('vandal'), '/weapons/vandal.webp');
});
