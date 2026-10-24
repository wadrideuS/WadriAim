import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCode } from '../src/features/crosshair-code.js';
test('parses VALORANT code sections without reading zoom as primary parameters', () => {
  const p = parseCode('0;s;1;P;c;5;0l;4;0o;2;S;s;1.165');
  assert.equal(p.c, '5');
  assert.equal(p['0l'], '4');
  assert.equal(p.s, undefined);
});
test('rejects missing and incomplete primary crosshair codes', () => {
  for (const c of ['bad', '0;s;1', '0;P;c']) assert.throws(() => parseCode(c));
});
