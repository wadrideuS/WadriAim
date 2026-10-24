import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLECTION_LIMIT,
  CROSSHAIR_PRESETS,
  DEFAULT_CROSSHAIR_CODE,
  addCrosshair,
  crosshairChoices,
  crosshairName,
  removeCrosshair,
} from '../src/features/crosshair-collection.js';
import { parseCode } from '../src/features/crosshair-code.js';

const VALID = '0;s;1;P;c;1;h;0;0l;3;0o;1;0a;1;0f;0;1b;0';

test('every preset is a valid VALORANT code and the first one is the default', () => {
  for (const preset of CROSSHAIR_PRESETS) assert.doesNotThrow(() => parseCode(preset.code));
  assert.equal(CROSSHAIR_PRESETS[0].code, DEFAULT_CROSSHAIR_CODE);
});

test('adds a crosshair with a trimmed name and leaves the original list untouched', () => {
  const original = [];
  const next = addCrosshair(original, { name: '  Mi verde  ', code: ` ${VALID} ` });
  assert.deepEqual(next, [{ name: 'Mi verde', code: VALID }]);
  assert.deepEqual(original, []);
});

test('names an unnamed crosshair after its place in the collection', () => {
  const next = addCrosshair([{ name: 'Otra', code: DEFAULT_CROSSHAIR_CODE }], {
    name: '',
    code: VALID,
  });
  assert.equal(next[1].name, 'Mi mira 2');
});

test('rejects invalid codes with the parser message', () => {
  assert.throws(() => addCrosshair([], { name: 'x', code: 'hola' }), /código de mira de VALORANT/);
});

test('rejects a code that is already saved', () => {
  assert.throws(
    () => addCrosshair([{ name: 'Ya', code: VALID }], { name: 'Otra', code: VALID }),
    /ya está guardada/,
  );
});

test('rejects new crosshairs once the collection is full', () => {
  const full = Array.from({ length: COLLECTION_LIMIT }, (_, i) => ({
    name: 'm' + i,
    code: VALID + ';z;' + i,
  }));
  assert.throws(() => addCrosshair(full, { name: 'n', code: DEFAULT_CROSSHAIR_CODE }), /30 miras/);
});

test('removes a crosshair by code without mutating the list', () => {
  const list = [
    { name: 'A', code: VALID },
    { name: 'B', code: DEFAULT_CROSSHAIR_CODE },
  ];
  assert.deepEqual(removeCrosshair(list, VALID), [{ name: 'B', code: DEFAULT_CROSSHAIR_CODE }]);
  assert.equal(list.length, 2);
});

test('names the active code from presets, then the collection, then a fallback', () => {
  assert.equal(crosshairName(DEFAULT_CROSSHAIR_CODE, []), 'Mira clásica');
  assert.equal(crosshairName(VALID, [{ name: 'Mi verde', code: VALID }]), 'Mi verde');
  assert.equal(crosshairName('0;P;c;3', []), 'Mira personalizada');
});

test('quick choices list every preset and then the collection, without duplicates', () => {
  const collection = [
    { name: 'Mi verde', code: VALID },
    { name: 'Copia', code: DEFAULT_CROSSHAIR_CODE },
  ];
  const choices = crosshairChoices(DEFAULT_CROSSHAIR_CODE, collection);
  assert.deepEqual(
    choices.map((choice) => choice.name),
    [...CROSSHAIR_PRESETS.map((preset) => preset.name), 'Mi verde'],
  );
});

test('quick choices put a custom active code first so it stays selectable', () => {
  const custom = '0;P;c;3;0l;2';
  const choices = crosshairChoices(` ${custom} `, []);
  assert.deepEqual(choices[0], { name: 'Tu mira', code: custom });
  assert.equal(choices.length, CROSSHAIR_PRESETS.length + 1);
});
