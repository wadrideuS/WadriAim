import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionState, rankingRows, scoreUnit } from '../src/features/ranking-model.js';

const entry = (position, username, patch = {}) => ({
  position,
  username,
  team: '',
  score: 100 - position,
  accuracy: 60,
  me: false,
  ...patch,
});

test('orders rows by position and then by username', () => {
  const { rows } = rankingRows({
    rows: [entry(2, 'zeta'), entry(1, 'beta'), entry(2, 'alfa')],
    players: 3,
  });
  assert.deepEqual(
    rows.map((row) => row.username),
    ['beta', 'alfa', 'zeta'],
  );
});

test('marks podium places only for positions one to three, ties included', () => {
  const { rows } = rankingRows({
    rows: [entry(1, 'a'), entry(1, 'b'), entry(3, 'c'), entry(4, 'd')],
  });
  assert.deepEqual(
    rows.map((row) => row.podium),
    [1, 1, 3, null],
  );
});

test('highlights my row and does not pin it again when I am in the list', () => {
  const me = entry(2, 'crisjo', { me: true });
  const result = rankingRows({ rows: [entry(1, 'a'), me], me, players: 2 });
  assert.equal(result.rows[1].isMe, true);
  assert.equal(result.rows[0].isMe, false);
  assert.equal(result.pinnedMe, null);
});

test('pins my position below the table when I am outside the top list', () => {
  const me = entry(73, 'crisjo', { me: true });
  const result = rankingRows({ rows: [entry(1, 'a')], me, players: 90 });
  assert.equal(result.pinnedMe.position, 73);
  assert.equal(result.pinnedMe.isMe, true);
  assert.equal(result.players, 90);
});

test('tolerates an empty or missing response', () => {
  assert.deepEqual(rankingRows(null), { rows: [], pinnedMe: null, players: 0 });
});

test('score unit follows the modes that award points', () => {
  assert.equal(scoreUnit(1), 'Aciertos');
  assert.equal(scoreUnit(6), 'Puntos');
  assert.equal(scoreUnit(14), 'Aciertos');
});

test('connection state explains why the ranking cannot load', () => {
  assert.equal(connectionState({ hasServer: false, isOnline: true }), 'no-server');
  assert.equal(connectionState({ hasServer: true, isOnline: false }), 'offline');
  assert.equal(connectionState({ hasServer: true, isOnline: true }), 'ready');
});
