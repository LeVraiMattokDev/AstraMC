import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceDrop, canReachDrop } from '../dist/item-physics.js';
const worldWith = fn => ({ get: (x, y, z) => fn(Math.floor(x), Math.floor(y), Math.floor(z)) });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < .00001, `${actual} differs from ${expected}`);

test('a drop from Y60 lands on a single block layer at Y10 without tunneling', () => {
  const world = worldWith((x, y, z) => y === 10 ? 3 : 0);
  const position = { x: .5, y: 60, z: .5 }, velocity = { x: 0, y: 2, z: 0 };
  let grounded = false;
  for (let i = 0; i < 200; i++) grounded = advanceDrop(world, position, velocity, .04).grounded || grounded;
  assert.equal(grounded, true);
  near(position.y, 11.12);
  assert.equal(velocity.y, 0);
});

test('fast horizontal movement stops at walls on both axes and slides along them', () => {
  const world = worldWith((x, y, z) => x === 2 || z === 4 || y === 0 ? 3 : 0);
  const position = { x: .5, y: 1.12, z: .5 }, velocity = { x: 40, y: 0, z: 30 };
  const result = advanceDrop(world, position, velocity, .2);
  near(position.x, 1.88);
  near(position.z, 3.88);
  near(position.y, 1.12);
  assert.deepEqual(velocity, { x: 0, y: 0, z: 0 });
  assert.equal(result.grounded, true);
});

test('partial-height beds support drops at their actual top face', () => {
  const world = worldWith((x, y, z) => y === 10 ? 28 : 0);
  const position = { x: .5, y: 14, z: .5 }, velocity = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 100; i++) advanceDrop(world, position, velocity, .04);
  near(position.y, 10.68);
  assert.equal(velocity.y, 0);
});

test('pickup line of sight admits air, water, torches and space above beds', () => {
  const from = { x: .5, y: 1.9, z: .5 }, to = { x: 3.5, y: 1.9, z: .5 };
  for (const id of [0, 7, 27, 28]) {
    const world = worldWith((x, y) => x === 1 && y === 1 ? id : 0);
    assert.equal(canReachDrop(world, from, to), true, `id ${id} should not obstruct`);
  }
});

test('solid walls and the lower body of a bed block collection', () => {
  const from = { x: .5, y: 1.3, z: .5 }, to = { x: 3.5, y: 1.3, z: .5 };
  for (const id of [3, 10, 28]) {
    const world = worldWith((x, y) => x === 1 && y === 1 ? id : 0);
    assert.equal(canReachDrop(world, from, to), false, `id ${id} should obstruct`);
  }
});
