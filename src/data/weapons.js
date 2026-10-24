/**
 * Weapon stats taken from the in-game stat cards (Vandal, Phantom, Sheriff, Ghost).
 *
 * damage: ranges in metres → [head, body, legs]
 * spread: first-shot spread in degrees [hip, ads]
 * spray:  recoil pattern in degrees per bullet (x = right, y = up), applied to the
 *         bullet and, scaled by `viewKick`, to the camera so the view climbs a bit.
 * bloom:  extra spread per consecutive shot (deg), capped at `maxBloom`.
 * move:   extra spread while walking / running / in the air (deg).
 */
const rifleMove = { walk: 1.1, run: 3.9, air: 9 };
const pistolMove = { walk: 0.4, run: 1.2, air: 6 };

export const arsenal = {
  karambit: {
    name: 'Karambit Sport',
    type: 'Cuchillo · movilidad',
    auto: false,
    mag: 0,
    rate: 1,
    reload: 0,
    equip: 0.75,
    kick: 0,
    damage: [[Infinity, [0, 0, 0]]],
    speed: 6.75,
  },
  ghost: {
    name: 'Ghost',
    type: 'Pistola semiautomática · silenciador',
    auto: false,
    mag: 13,
    rate: 6.75,
    reload: 1.5,
    equip: 0.75,
    speed: 5.74,
    kick: 0.55,
    damage: [
      [30, [105, 30, 25]],
      [50, [87, 25, 21]],
    ],
    spread: [0.3, 0.3],
    bloom: 0.55,
    maxBloom: 3,
    recovery: 0.35,
    move: pistolMove,
    spray: [[0, 0], [0, 0.55], [0.08, 1.05], [-0.1, 1.45], [0.12, 1.8]],
    viewKick: 0.45,
    silenced: true,
  },
  sheriff: {
    name: 'Sheriff',
    type: 'Revólver semiautomático',
    auto: false,
    mag: 6,
    rate: 4,
    reload: 2.25,
    equip: 1,
    speed: 5.4,
    kick: 1.7,
    damage: [
      [30, [159, 55, 46]],
      [50, [145, 50, 42]],
    ],
    spread: [0.25, 0.25],
    bloom: 1.4,
    maxBloom: 5,
    recovery: 0.55,
    move: pistolMove,
    spray: [[0, 0], [0, 1.6], [0.15, 2.8], [-0.2, 3.6]],
    viewKick: 0.6,
  },
  phantom: {
    name: 'Phantom',
    type: 'Rifle automático · silenciador',
    auto: true,
    mag: 30,
    rate: 11,
    reload: 2.5,
    equip: 1,
    speed: 5.4,
    kick: 0.82,
    damage: [
      [20, [156, 39, 33]],
      [50, [140, 35, 29]],
    ],
    spread: [0.2, 0.11],
    bloom: 0.09,
    maxBloom: 1.6,
    recovery: 0.35,
    move: rifleMove,
    // first bullets stay tight, then climb and finally sway left/right
    spray: [
      [0, 0], [0, 0.15], [0.02, 0.4], [-0.03, 0.75], [0.04, 1.15], [-0.05, 1.6],
      [0.06, 2.05], [-0.1, 2.45], [0.18, 2.8], [0.35, 3.05], [0.5, 3.2], [0.35, 3.3],
      [0.05, 3.35], [-0.3, 3.4], [-0.6, 3.45], [-0.8, 3.45], [-0.6, 3.5], [-0.25, 3.5],
      [0.15, 3.55], [0.55, 3.55], [0.85, 3.6], [0.7, 3.6], [0.3, 3.6], [-0.15, 3.6],
      [-0.55, 3.65], [-0.85, 3.65], [-0.6, 3.65], [-0.2, 3.65], [0.2, 3.7], [0.5, 3.7],
    ],
    viewKick: 0.35,
    ads: { zoom: 1.25, rate: 0.9, move: 0.76 },
    silenced: true,
  },
  vandal: {
    name: 'Vandal',
    type: 'Rifle automático',
    auto: true,
    mag: 25,
    rate: 9.75,
    reload: 2.5,
    equip: 1,
    speed: 5.4,
    kick: 1.05,
    damage: [[50, [160, 40, 34]]],
    spread: [0.25, 0.157],
    bloom: 0.11,
    maxBloom: 1.9,
    recovery: 0.38,
    move: rifleMove,
    spray: [
      [0, 0], [0, 0.25], [0.02, 0.6], [-0.03, 1.05], [0.04, 1.6], [-0.05, 2.15],
      [0.08, 2.7], [-0.12, 3.15], [0.25, 3.5], [0.5, 3.75], [0.7, 3.9], [0.5, 4.0],
      [0.1, 4.05], [-0.35, 4.1], [-0.75, 4.15], [-0.95, 4.15], [-0.7, 4.2], [-0.3, 4.2],
      [0.2, 4.25], [0.65, 4.25], [0.95, 4.3], [0.75, 4.3], [0.3, 4.3], [-0.2, 4.35],
      [-0.6, 4.35],
    ],
    viewKick: 0.4,
    ads: { zoom: 1.25, rate: 0.9, move: 0.76 },
  },
};

/** Damage for a part ('head' | 'body' | 'legs') at a distance in metres. */
export function weaponDamage(weapon, part, distance = 0) {
  const ranges = weapon.damage;
  const row = (ranges.find(([max]) => distance <= max) || ranges.at(-1))[1];
  return part === 'head' ? row[0] : part === 'legs' ? row[2] : row[1];
}

// short-range head/body values, still read by other modules (spike co-op, summaries)
for (const weapon of Object.values(arsenal)) {
  const [head, body] = weapon.damage[0][1];
  weapon.head = head;
  weapon.body = body;
}

/** Agent bots: 100 health + 50 heavy shields, like a full buy. */
export const AGENT_HP = 150;
/** Modes whose targets are floating heads (one hit = one kill). */
export const headOnlyModes = [0, 2, 6];
