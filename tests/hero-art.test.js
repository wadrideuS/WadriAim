import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatHits, pointerToParallax } from '../src/features/hero-art.js';
import {
  CAMERA_Z,
  HERO_ORB_COUNT,
  HERO_ORB_SLOTS,
  pairedSlot,
} from '../src/renderer/heroOrbScene.js';

const onScreen = (slot) => {
  const scale = CAMERA_Z / (CAMERA_Z - slot.z);
  return { x: slot.x * scale, y: slot.y * scale, radius: slot.radius * scale };
};
const slotsOfOrb = (orb) => [orb, pairedSlot(orb)].map((index) => onScreen(HERO_ORB_SLOTS[index]));

const card = { left: 100, top: 50, width: 400, height: 200 };

test('the pointer at the centre of the card produces no parallax', () => {
  assert.deepEqual(pointerToParallax(card, 300, 150), { x: 0, y: 0 });
});

test('the pointer on the right and top edges reaches full parallax', () => {
  assert.deepEqual(pointerToParallax(card, 500, 50), { x: 1, y: -1 });
});

test('a pointer far outside the card is clamped to the edge value', () => {
  assert.deepEqual(pointerToParallax(card, -900, 2000), { x: -1, y: 1 });
});

test('the hit counter always shows three digits and wraps after 999', () => {
  assert.deepEqual([0, 7, 42, 1234].map(formatHits), ['000', '007', '042', '234']);
});

test('a hit orb respawns in the other slot of its own pair and comes back after two hits', () => {
  for (let orb = 0; orb < HERO_ORB_COUNT; orb++) {
    assert.notEqual(pairedSlot(orb), orb);
    assert.equal(pairedSlot(pairedSlot(orb)), orb);
  }
});

test('respawning keeps each orb at a similar on-screen size, so the near orb stays near', () => {
  for (let orb = 0; orb < HERO_ORB_COUNT; orb++) {
    const [first, second] = slotsOfOrb(orb);
    const ratio = first.radius / second.radius;
    assert.equal(ratio > 0.8 && ratio < 1.25, true, `orb ${orb} ratio ${ratio}`);
  }
});

test('two orbs never overlap on screen, whichever slots they occupy', () => {
  for (let a = 0; a < HERO_ORB_COUNT; a++) {
    for (let b = a + 1; b < HERO_ORB_COUNT; b++) {
      for (const first of slotsOfOrb(a)) {
        for (const second of slotsOfOrb(b)) {
          const gap = Math.hypot(first.x - second.x, first.y - second.y);
          assert.equal(gap > (first.radius + second.radius) * 1.4, true, `orbs ${a} and ${b}`);
        }
      }
    }
  }
});

test('no orb slot covers the crosshair, which sits at the scene origin', () => {
  for (const slot of HERO_ORB_SLOTS) {
    assert.equal(Math.hypot(slot.x, slot.y) > slot.radius * 2.2, true);
  }
});
