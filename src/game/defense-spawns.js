/**
 * Where defenders stand and where attackers walk in from in the defence modes.
 *
 * Headings use the bot convention: atan2(dx, dz), 0 = +Z. The camera looks
 * down -Z, so its yaw is the heading turned half a circle.
 */

/** Attackers never spawn closer than this to the defender spawn (metres). */
export const MIN_ENTRY_DISTANCE = 9;
/** Attackers spawn within this angle of the defender's starting view (±60°). */
export const MAX_ENTRY_ANGLE = Math.PI / 3;
/** Gap between defenders standing side by side (metres). */
export const DEFENDER_SPACING = 1.4;
/** Defender line, in spacings to the right of the player: player, right, left, far right… */
const DEFENDER_LINE = [0, 1, -1, 2, -2, 3];

const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

export const headingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
export const cameraYawFor = (heading) => wrap(heading + Math.PI);
export const headingOfView = (cameraYaw) => wrap(cameraYaw + Math.PI);
export const forwardOf = (yaw) => ({ x: -Math.sin(yaw), z: -Math.cos(yaw) });

/** Angle between the camera view and the direction to `point`: 0 straight ahead, π behind. */
export function angleFromView(from, yaw, point) {
  const forward = forwardOf(yaw);
  const dx = point.x - from.x,
    dz = point.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  return Math.acos(Math.max(-1, Math.min(1, (dx * forward.x + dz * forward.z) / length)));
}

/** Heading to the middle of the narrowest arc that holds every point. */
export function facingHeading(from, points) {
  const headings = points.map((point) => headingTo(from, point)).sort((a, b) => a - b);
  let widestGap = -1,
    arcStart = 0;
  headings.forEach((heading, i) => {
    const next = i + 1 < headings.length ? headings[i + 1] : headings[0] + 2 * Math.PI;
    if (next - heading > widestGap) {
      widestGap = next - heading;
      arcStart = headings[(i + 1) % headings.length];
    }
  });
  return wrap(arcStart + (2 * Math.PI - widestGap) / 2);
}

/** Spawn points for one wave: bots alternate entries and each wave another entry leads. */
export function waveSpawnPoints(entries, wave, count) {
  return Array.from({ length: count }, (_, i) => {
    const entry = entries[(wave - 1 + i) % entries.length];
    const slot = entry.slots[Math.floor(i / entries.length) % entry.slots.length];
    return { x: slot.x, z: slot.z, entry: entry.name };
  });
}

/** Defenders side by side, all facing the camera yaw; `nearest` snaps each place to the walkable grid. */
export function defenderLine(spawn, yaw, count, nearest) {
  const right = { x: Math.cos(yaw), z: -Math.sin(yaw) };
  const line = [];
  for (const step of DEFENDER_LINE) {
    if (line.length === count) break;
    const place = nearest(spawn.x + right.x * step * DEFENDER_SPACING, spawn.z + right.z * step * DEFENDER_SPACING);
    if (line.every((taken) => Math.hypot(taken.x - place.x, taken.z - place.z) >= DEFENDER_SPACING * 0.7))
      line.push(place);
  }
  return line;
}
