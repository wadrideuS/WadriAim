const DEGREES = 180 / Math.PI;
/** Enough for an endless round at full auto; the log only lives in memory until the summary. */
export const MAX_LOGGED_SHOTS = 3000;
/** Misses further than this from every target say nothing about aim error. */
const MISS_SEARCH_DEGREES = 10;

const round2 = (value) => Math.round(value * 100) / 100;

/**
 * Where a target sits relative to the view centre, in degrees (x right, y up).
 * Same camera convention as the renderer: yaw 0 looks down -z, pitch up is positive.
 */
export function targetAngles(view, target) {
  const dx = target.x - view.position.x;
  const dy = target.y - view.position.y;
  const dz = target.z - view.position.z;
  const sinYaw = Math.sin(view.yaw);
  const cosYaw = Math.cos(view.yaw);
  const sinPitch = Math.sin(view.pitch);
  const cosPitch = Math.cos(view.pitch);
  const forward = -dx * cosPitch * sinYaw + dy * sinPitch - dz * cosPitch * cosYaw;
  if (forward <= 0) return null;
  const right = dx * cosYaw - dz * sinYaw;
  const up = dx * sinPitch * sinYaw + dy * cosPitch + dz * sinPitch * cosYaw;
  return { x: Math.atan2(right, forward) * DEGREES, y: Math.atan2(up, forward) * DEGREES };
}

function offsetFrom(view, target, aim) {
  if (![target.x, target.y, target.z].every(Number.isFinite)) return null;
  const angles = targetAngles(view, target);
  return angles ? { dx: round2(aim.x - angles.x), dy: round2(aim.y - angles.y) } : null;
}

/** Bullet error relative to the struck target, or to the closest live target for a miss. */
export function shotOffset(view, struck, targets, aim) {
  if (struck) return offsetFrom(view, struck, aim);
  let closest = null;
  for (const target of targets) {
    if (target.dead) continue;
    const offset = offsetFrom(view, target, aim);
    if (
      offset &&
      (!closest || Math.hypot(offset.dx, offset.dy) < Math.hypot(closest.dx, closest.dy))
    )
      closest = offset;
  }
  return closest && Math.hypot(closest.dx, closest.dy) <= MISS_SEARCH_DEGREES ? closest : null;
}

export function medianKillMs(log) {
  const times = log.filter((shot) => shot.result === 'kill').map((shot) => shot.ms);
  if (!times.length) return null;
  const sorted = times.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}
