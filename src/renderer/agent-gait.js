/**
 * Procedural gait for the agent rigs. The agent GLBs ship a skeleton but no
 * animation clips, so the walk cycle is driven from the bot's real speed:
 * one step per stride length travelled keeps the feet planted.
 */

/** Below this speed (m/s) the bot stands and only breathes. */
export const IDLE_SPEED = 0.15;
/** From this speed (m/s) the walk turns into a run. */
export const RUN_SPEED = 2.6;
/** Distance covered by one walking step (metres). */
export const WALK_STRIDE = 0.72;
/** Running steps are this much longer than walking ones. */
const RUN_STRIDE_GAIN = 0.35;
/** Speed band over which the walk blends into the run. */
const RUN_BLEND = 0.6;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

/** Gait for a speed: state, blend toward running (0..1), stride (m) and cadence (steps/s). */
export function gaitFor(speed) {
  if (speed < IDLE_SPEED) return { state: 'idle', run: 0, stride: WALK_STRIDE, cadence: 0 };
  const run = smoothstep(RUN_SPEED - RUN_BLEND, RUN_SPEED + RUN_BLEND / 2, speed);
  const stride = WALK_STRIDE * (1 + run * RUN_STRIDE_GAIN);
  return { state: speed >= RUN_SPEED ? 'run' : 'walk', run, stride, cadence: speed / stride };
}

/** Hip swing (radians) that puts the feet one stride apart for a leg of `legLength`. */
export function strideAngle(stride, legLength) {
  return Math.asin(Math.min(0.95, stride / (2 * legLength)));
}

/** Eases a heading toward `target` along the short way round; `rate` is 1/s. */
export function approachAngle(current, target, rate, dt) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * (1 - Math.exp(-rate * dt));
}
