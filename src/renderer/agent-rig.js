import * as THREE from 'three';
import { gaitFor, strideAngle } from './agent-gait.js';

/**
 * Procedural body animation for the agent bots. The agent GLBs carry a full
 * skeleton but no clips, so legs, hips and spine are posed every frame from
 * the bot's real velocity (see agent-gait.js).
 */

/** Knee bend at mid-swing (radians): walking, and extra when running. */
const KNEE_LIFT = { walk: 0.7, run: 0.55 };
/** Hip yaw that follows the stepping leg, and how much of it the chest undoes. */
const HIP_TWIST = 0.12;
const CHEST_COUNTER = 0.7;
/** Side-to-side weight shift per stride (radians of spine roll). */
const STRIDE_SWAY = 0.035;
/** Chest lean into the movement: walking, and extra when running. */
const LEAN = { walk: 0.05, run: 0.14 };
/** Idle breathing and weight shift, so a standing bot is never a statue. */
const BREATH = { amplitude: 0.018, rate: 1.7 };
const IDLE_SHIFT = { amplitude: 0.03, rate: 0.55 };
/** Hit reaction: chest snaps back and recovers. */
const FLINCH = { pitch: 0.22, twist: 0.07, recovery: 9 };

export const findBone = (root, name) => {
  let found = null;
  const pattern = new RegExp('^' + name + '_\\d+$');
  root.traverse((node) => {
    if (!found && node.isBone && pattern.test(node.name)) found = node;
  });
  return found;
};
export const worldOf = (node) => node.getWorldPosition(new THREE.Vector3());

const X = new THREE.Vector3(1, 0, 0),
  Y = new THREE.Vector3(0, 1, 0),
  Z = new THREE.Vector3(0, 0, 1);

/** Axis given in bot space, expressed in the bone's parent space (rest pose). */
function axisFor(group, bone, axis) {
  const groupQuat = group.getWorldQuaternion(new THREE.Quaternion());
  const parentQuat = bone.parent.getWorldQuaternion(new THREE.Quaternion());
  return axis.clone().applyQuaternion(groupQuat).applyQuaternion(parentQuat.invert()).normalize();
}

/** Rotation sign so that turning `bone` about `axisLocal` moves `probe` along `direction` (bot space). */
function signFor(group, bone, axisLocal, probe, direction) {
  const before = group.worldToLocal(worldOf(probe));
  const rest = bone.quaternion.clone();
  bone.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axisLocal, 0.3));
  group.updateMatrixWorld(true);
  const after = group.worldToLocal(worldOf(probe));
  bone.quaternion.copy(rest);
  group.updateMatrixWorld(true);
  return after.sub(before).dot(direction) >= 0 ? 1 : -1;
}

function buildLeg(group, root, side) {
  const [hip, knee, foot] = ['Hip', 'Knee', 'Foot'].map((name) => findBone(root, side + '_' + name));
  if (!hip || !knee || !foot) return null;
  const hipX = axisFor(group, hip, X),
    hipZ = axisFor(group, hip, Z),
    kneeX = axisFor(group, knee, X);
  const outward = new THREE.Vector3(group.worldToLocal(worldOf(foot)).x >= 0 ? 1 : -1, 0, 0);
  return {
    hip,
    knee,
    foot,
    hipRest: hip.quaternion.clone(),
    kneeRest: knee.quaternion.clone(),
    hipX,
    hipZ,
    kneeX,
    length: group.worldToLocal(worldOf(hip)).distanceTo(group.worldToLocal(worldOf(foot))),
    forward: signFor(group, hip, hipX, knee, Z), // knee moves toward the front
    out: signFor(group, hip, hipZ, foot, outward), // foot moves away from the body
    bend: signFor(group, knee, kneeX, foot, Z.clone().negate()), // foot moves back
  };
}

function buildJoint(group, bone, head) {
  if (!bone) return null;
  const pitch = axisFor(group, bone, X);
  return {
    bone,
    rest: bone.quaternion.clone(),
    pitch,
    yaw: axisFor(group, bone, Y),
    roll: axisFor(group, bone, Z),
    lean: head ? signFor(group, bone, pitch, head, Z) : 1, // positive pitch leans toward the front
  };
}

/** Rig handles for one bot; null when the skeleton lacks legs. */
export function buildRig(root, group) {
  group.updateMatrixWorld(true);
  const left = buildLeg(group, root, 'L'),
    right = buildLeg(group, root, 'R');
  if (!left || !right) return null;
  const head = findBone(root, 'Head');
  const groundY = group.getWorldPosition(new THREE.Vector3()).y;
  return {
    restFeet: Math.min(worldOf(left.foot).y, worldOf(right.foot).y) - groundY,
    legs: { L: left, R: right },
    legLength: (left.length + right.length) / 2,
    pelvis: buildJoint(group, findBone(root, 'Pelvis'), null),
    chest: buildJoint(group, findBone(root, 'Spine1'), head),
    upperChest: buildJoint(group, findBone(root, 'Spine3'), head),
    root,
    phase: 0,
    clock: 0,
    moving: 0,
    run: 0,
    crouch: 0,
    flinch: 0,
    flinchSide: 1,
  };
}

/** Starts the hit reaction; `side` (-1/1) picks which way the chest twists. */
export function flinchAgent(group, side = 1) {
  const rig = group.userData.rig;
  if (!rig) return;
  rig.flinch = 1;
  rig.flinchSide = side;
}

const tmpQ = new THREE.Quaternion();
const turn = (quaternion, axis, angle) => (angle ? quaternion.premultiply(tmpQ.setFromAxisAngle(axis, angle)) : quaternion);

function poseJoint(joint, { pitch = 0, yaw = 0, roll = 0 }) {
  if (!joint) return;
  const q = joint.bone.quaternion.copy(joint.rest);
  turn(q, joint.yaw, yaw);
  turn(q, joint.pitch, pitch * joint.lean);
  turn(q, joint.roll, roll);
}

function poseLegs(rig, velocity, speed, gait) {
  const lateral = speed > 0.01 ? Math.abs(velocity.x) / speed : 0;
  const forwardShare = 1 - lateral;
  const direction = velocity.z < 0 && forwardShare > 0.5 ? -1 : 1; // backpedalling swings the other way
  const swing = strideAngle(gait.stride, rig.legLength) * rig.moving;
  const kneeLift = (KNEE_LIFT.walk + KNEE_LIFT.run * rig.run) * rig.moving;
  for (const side of ['L', 'R']) {
    const leg = rig.legs[side];
    const phase = rig.phase + (side === 'L' ? 0 : Math.PI);
    const wave = Math.sin(phase);
    // the leg travelling forward (swing) bends its knee to clear the floor
    const lift = Math.max(0, Math.cos(phase) * direction);
    const hipAngle = wave * swing * forwardShare + rig.crouch * 1.15 + lift * kneeLift * 0.35;
    const spread = Math.max(0, wave) * swing * 0.7 * lateral;
    leg.hip.quaternion.copy(leg.hipRest);
    turn(leg.hip.quaternion, leg.hipX, leg.forward * hipAngle);
    turn(leg.hip.quaternion, leg.hipZ, leg.out * spread);
    leg.knee.quaternion.copy(leg.kneeRest);
    turn(leg.knee.quaternion, leg.kneeX, leg.bend * (lift * kneeLift + rig.crouch * 1.9));
  }
  return forwardShare;
}

function poseTorso(rig, forwardShare) {
  const stride = Math.sin(rig.phase) * rig.moving;
  const idle = 1 - rig.moving;
  const hipTwist = stride * HIP_TWIST * forwardShare;
  const flinch = rig.flinch * rig.flinch; // sharp hit, quick recovery
  poseJoint(rig.pelvis, { yaw: hipTwist });
  poseJoint(rig.chest, {
    yaw: -hipTwist * CHEST_COUNTER + Math.sin(rig.clock * IDLE_SHIFT.rate) * IDLE_SHIFT.amplitude * idle,
    pitch: (LEAN.walk + LEAN.run * rig.run) * rig.moving + rig.crouch * 0.2,
    roll: stride * STRIDE_SWAY,
  });
  poseJoint(rig.upperChest, {
    pitch: Math.sin(rig.clock * BREATH.rate) * BREATH.amplitude - flinch * FLINCH.pitch,
    yaw: flinch * FLINCH.twist * rig.flinchSide,
  });
}

/** Keeps the lowest foot on the floor: the body bobs like a real stride. */
function plantFeet(group, rig) {
  rig.root.position.y = 0;
  group.updateMatrixWorld(true);
  const groundY = group.getWorldPosition(new THREE.Vector3()).y;
  const feet = Math.min(worldOf(rig.legs.L.foot).y, worldOf(rig.legs.R.foot).y) - groundY;
  rig.root.position.y = rig.restFeet - feet;
}

/**
 * velocity: bot-space metres/second ({x: right, z: forward}); crouch 0..1.
 */
export function animateAgent(group, dt, velocity = { x: 0, z: 0 }, crouch = 0) {
  const rig = group.userData.rig;
  if (!rig) return;
  const speed = Math.hypot(velocity.x, velocity.z);
  const gait = gaitFor(speed);
  const ease = (current, target, rate) => current + (target - current) * Math.min(1, dt * rate);
  rig.moving = ease(rig.moving, gait.state === 'idle' ? 0 : 1, 8);
  rig.run = ease(rig.run, gait.run, 5);
  rig.crouch = ease(rig.crouch, crouch, 12);
  rig.flinch *= Math.exp(-FLINCH.recovery * dt);
  rig.clock += dt;
  rig.phase += Math.PI * gait.cadence * dt; // half a cycle per step
  const forwardShare = poseLegs(rig, velocity, speed, gait);
  poseTorso(rig, forwardShare);
  plantFeet(group, rig);
}
