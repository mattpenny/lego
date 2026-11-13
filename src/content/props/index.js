/* Prop registry — one file per placed prop family.
   Collider numbers here ARE simulation input (buildMapData writes them into
   sim.map.colliders), so changing one moves the digest. View fields do not. */

import { deepFreeze } from '../schema.js';
import { ground } from './ground.js';
import { sky } from './sky.js';
import { pond } from './pond.js';
import { trunk } from './trunk.js';
import { canopy } from './canopy.js';
import { rock } from './rock.js';
import { pillar } from './pillar.js';
import { fence } from './fence.js';
import { stone } from './stone.js';
import { hill } from './hill.js';
import { block } from './block.js';
import { torch } from './torch.js';
import { lava } from './lava.js';
import { reeds } from './reeds.js';

export const PROPS = deepFreeze({
  ground, sky, pond, trunk, canopy, rock, pillar, fence,
  stone, hill, block, torch, lava, reeds,
});
export const PROP_IDS = deepFreeze(Object.keys(PROPS));

/** tryPlace() body radii — these become disc colliders in SIM state. */
export const PLACE_RADII = deepFreeze({
  trunk: trunk.collider.radius,
  rock: rock.collider.radius,
  pillar: pillar.collider.radius,
  stone: stone.collider.radius,
});

/** The SOLID PROPS pass in buildMapData(). */
export const BLOCK_R = deepFreeze(block.collider.radii.slice());
export const BLOCK_FALLBACK_R = block.collider.fallback;
export const WALL_KIND = block.collider.wallKind;
export const WALL_HALF_LENGTH = block.collider.wallHalfLength;
export const WALL_RADIUS = block.collider.wallRadius;
export const POND_PAD = pond.collider.pad;
export const FENCE_RADIUS = fence.collider.radius;
export const TORCH_RADIUS = torch.collider.radius;
