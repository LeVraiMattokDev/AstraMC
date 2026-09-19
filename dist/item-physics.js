import { solid, blockHeight, raycast } from './world.js';

const RADIUS = .12;
const EPSILON = 1e-7;

function overlapsTerrain(world, position) {
  for (let y = Math.floor(position.y - RADIUS + EPSILON); y <= Math.floor(position.y + RADIUS - EPSILON); y++) {
    for (let z = Math.floor(position.z - RADIUS + EPSILON); z <= Math.floor(position.z + RADIUS - EPSILON); z++) {
      for (let x = Math.floor(position.x - RADIUS + EPSILON); x <= Math.floor(position.x + RADIUS - EPSILON); x++) {
        const id = world.get(x, y, z);
        if (solid(id) && position.y - RADIUS < y + blockHeight(id) - EPSILON) return true;
      }
    }
  }
  return false;
}

/** Move a drop's center with gravity and a .12-block collision half extent. */
export function advanceDrop(world, position, velocity, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return { grounded: false };
  if (![position.x, position.y, position.z, velocity.x, velocity.y, velocity.z].every(Number.isFinite)) return { grounded: false };
  velocity.y -= 12 * dt;
  const delta = { x: velocity.x * dt, y: velocity.y * dt, z: velocity.z * dt };
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)) / .15));
  let grounded = false;
  for (let step = 0; step < steps; step++) {
    for (const axis of ['x', 'z', 'y']) {
      if (!delta[axis]) continue;
      const start = position[axis], amount = delta[axis] / steps;
      position[axis] = start + amount;
      if (!overlapsTerrain(world, position)) continue;
      let low = 0, high = 1;
      for (let i = 0; i < 18; i++) {
        const fraction = (low + high) / 2;
        position[axis] = start + amount * fraction;
        if (overlapsTerrain(world, position)) high = fraction;
        else low = fraction;
      }
      position[axis] = start + amount * low;
      if (axis === 'y' && amount < 0) grounded = true;
      velocity[axis] = 0;
      delta[axis] = 0;
    }
  }
  return { grounded };
}

/** True when an item and the player can see each other through nonsolid cells. */
export function canReachDrop(world, from, to) {
  const x = to.x - from.x, y = to.y - from.y, z = to.z - from.z;
  const length = Math.hypot(x, y, z);
  if (!Number.isFinite(length)) return false;
  if (length < EPSILON) return true;
  // Torches and water do not obstruct collection. Exclude partial blocks when
  // the segment only crosses the empty space above their actual top face.
  const obstacles = { get: (bx, by, bz) => {
    const id = world.get(bx, by, bz);
    if (!solid(id)) return 0;
    if (blockHeight(id) < 1) {
      let enter = 0, leave = 1;
      for (const [axis, delta, min, max] of [['x', x, bx, bx + 1], ['y', y, by, by + blockHeight(id)], ['z', z, bz, bz + 1]]) {
        if (Math.abs(delta) < EPSILON) {
          if (from[axis] < min || from[axis] > max) return 0;
        } else {
          const a = (min - from[axis]) / delta, b = (max - from[axis]) / delta;
          enter = Math.max(enter, Math.min(a, b));
          leave = Math.min(leave, Math.max(a, b));
          if (enter > leave) return 0;
        }
      }
    }
    return id;
  } };
  return !raycast(obstacles, from, { x: x / length, y: y / length, z: z / length }, Math.max(0, length - EPSILON), false);
}
