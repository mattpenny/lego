/* The 13-joint contract of the brick-minifigure rig.
   Transcribed from src/game.js (const JOINTS, used by rigParts/rigGeometry
   and every animation clip). Phase-1 note: game.js keeps its own inline
   copy; this module is the canonical contract for new code.

   Each joint: n = name, p = parent joint index (-1 = root),
   o = offset from the parent's origin, in metres. Joint indices are part
   of the contract — figure parts and clips address joints BY INDEX
   (e.g. 5 = handL, 8 = handR, 2 = head). */

export const JOINTS = [
  { n: 'hips',      p: -1, o: [0, 0.95, 0] },
  { n: 'spine',     p: 0,  o: [0, 0.28, 0] },
  { n: 'head',      p: 1,  o: [0, 0.58, 0] },
  { n: 'upperArmL', p: 1,  o: [0.34, 0.34, 0] },
  { n: 'lowerArmL', p: 3,  o: [0, -0.42, 0] },
  { n: 'handL',     p: 4,  o: [0, -0.36, 0] },
  { n: 'upperArmR', p: 1,  o: [-0.34, 0.34, 0] },
  { n: 'lowerArmR', p: 6,  o: [0, -0.42, 0] },
  { n: 'handR',     p: 7,  o: [0, -0.36, 0] },
  { n: 'thighL',    p: 0,  o: [0.16, -0.12, 0] },
  { n: 'shinL',     p: 9,  o: [0, -0.46, 0] },
  { n: 'thighR',    p: 0,  o: [-0.16, -0.12, 0] },
  { n: 'shinR',     p: 11, o: [0, -0.46, 0] },
];

export const JOINT_COUNT = JOINTS.length; // 13

export const JOINT_NAMES = JOINTS.map((j) => j.n);

/* Name -> index lookup (HIPS, SPINE, HEAD, UPPER_ARM_L, ... HAND_R, ...). */
export const J = Object.freeze(
  Object.fromEntries(JOINTS.map((j, i) => [j.n.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase(), i])),
);

/* World-space rest origins, computed exactly as game.js computes ORIG:
   each joint's origin = parent's origin + its local offset. */
export const ORIG = [];
JOINTS.forEach((j) => {
  const b = j.p >= 0 ? ORIG[j.p] : [0, 0, 0];
  ORIG.push([b[0] + j.o[0], b[1] + j.o[1], b[2] + j.o[2]]);
});
