import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Frozen copy of the installed v1 module, retained before v2 deployment.
const legacySource = await readFile(new URL('./fixtures/world-v1.js', import.meta.url), 'utf8');
const { World: LegacyWorld } = await import(`data:text/javascript;base64,${Buffer.from(legacySource).toString('base64')}`);
const source = await readFile(new URL('../dist/world.js', import.meta.url), 'utf8');
const { World, SIZE, HEIGHT, BLOCKS, PALETTE, solid, blockHeight, collides, moveBody, raycast } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('generator 1 retains the exact previous terrain, trees, and ore for existing saves', () => {
  for (const seed of ['Astra', 'Survie', '0', 'été 2026']) {
    const before = new LegacyWorld(seed), after = new World(seed, 1);
    for (const [cx, cz] of [[0, 0], [1, 0], [-1, -1], [-3, 4], [2, -3], [10, 10]]) {
      assert.deepEqual(after.chunk(cx, cz), before.chunk(cx, cz), `${seed}, ${cx},${cz}`);
      for (let z = 0; z < SIZE; z += 3) for (let x = 0; x < SIZE; x += 3)
        assert.equal(after.height(cx * SIZE + x, cz * SIZE + z), before.height(cx * SIZE + x, cz * SIZE + z));
    }
    before.set(-1, 30, 8, 8); after.set(-1, 30, 8, 8);
    assert.deepEqual(after.serialize(), before.serialize());
  }
});

test('modern biomes are deterministic and offer plains, forests, deserts and snow', () => {
  const a = new World('Astra'), b = new World('Astra'), found = new Set();
  for (let z = -640; z <= 640; z += 32) for (let x = -640; x <= 640; x += 32) {
    assert.deepEqual(a.biome(x, z), b.biome(x, z));
    assert.equal(a.height(x, z), b.height(x, z));
    found.add(a.biome(x, z).id);
  }
  assert.deepEqual([...found].sort(), ['desert', 'forest', 'plains', 'snow']);
});

test('modern chunks are independent of visit order, including tree boundaries and negative coordinates', () => {
  const coordinates = [];
  for (let z = -2; z <= 2; z++) for (let x = -2; x <= 2; x++) coordinates.push([x, z]);
  const a = new World('Astra'), b = new World('Astra');
  for (const [x, z] of coordinates) a.chunk(x, z);
  for (const [x, z] of [...coordinates].reverse()) b.chunk(x, z);
  for (const [x, z] of coordinates) assert.deepEqual(a.chunk(x, z), b.chunk(x, z));
  assert.notDeepEqual(a.chunk(0, 0), new World('Another seed').chunk(0, 0));
});

test('caves open beneath land while retaining the bedrock floor and containing clustered ore', () => {
  const world = new World('Astra');
  let caveBlocks = 0, adjacentCaves = 0, coal = 0, iron = 0, diamonds = 0, adjacentOre = 0;
  for (let z = -48; z < 48; z++) for (let x = -48; x < 48; x++) {
    assert.equal(world.get(x, 0, z), 24);
    const h = world.height(x, z);
    for (let y = 1; y <= h - 4; y++) {
      const id = world.get(x, y, z);
      if (id === 0) {
        caveBlocks++;
        if (world.get(x + 1, y, z) === 0) adjacentCaves++;
        assert.ok(y >= 3);
      }
      if (id === 17) coal++;
      if (id === 18) { iron++; assert.ok(y < 28); }
      if (id === 19) { diamonds++; assert.ok(y < 10); }
      if ([17, 18, 19].includes(id) && world.get(x + 1, y, z) === id) adjacentOre++;
    }
  }
  assert.ok(caveBlocks > 500);
  assert.ok(adjacentCaves / caveBlocks > .5, 'smooth, connected passages');
  assert.ok(coal > 100 && iron > 100 && diamonds > 10);
  assert.ok(adjacentOre / (coal + iron + diamonds) > .4, 'ore occurs in veins');
});

test('cave entrances and all surface biome materials occur in the generated world', () => {
  const world = new World('Astra');
  let entrances = 0, beach = false;
  const checked = new Set();
  for (let z = -512; z <= 512; z += 8) for (let x = -512; x <= 512; x += 8) {
    const h = world.height(x, z), biome = world.biome(x, z).id;
    if (world.cave(x, h, z, h)) entrances++;
    if (!checked.has(biome) && h > 12 && !world.cave(x, h, z, h)) {
      const ground = world.get(x, h, z);
      assert.equal(ground, biome === 'desert' ? 4 : biome === 'snow' ? 12 : 1);
      checked.add(biome);
    }
    if (!beach && h === 10 && world.get(x, h, z) === 4) beach = true;
  }
  assert.equal(checked.size, 4);
  assert.ok(entrances > 0);
  assert.ok(beach);
});

test('new utility blocks can be edited and restored, while bedrock remains protected', () => {
  const world = new World('Astra');
  for (const id of [25, 26, 27, 28]) assert.equal(world.set(id, 50, 0, id), true);
  assert.equal(world.set(0, 50, 0, 24), false);
  const restored = new World('Astra'); restored.restore(world.serialize());
  for (const id of [25, 26, 27, 28]) assert.equal(restored.get(id, 50, 0), id);
  assert.throws(() => restored.restore([['0,0', [[SIZE * SIZE, 24]]]]));
  assert.throws(() => restored.restore([['0,0', [[SIZE * SIZE, BLOCKS.length]]]]));
  assert.ok(!PALETTE.some(block => block.id === 24));
  assert.ok(PALETTE.some(block => block.id === 28));
});

test('torches remain selectable without collision; low beds have matching collision height', () => {
  const world = {get: (x, y, z) => x === 0 && y === 0 && z === 0 ? 27 : 0};
  assert.equal(solid(27), false);
  assert.equal(collides(world, {x: .5, y: 0, z: .5}), false);
  assert.equal(raycast(world, {x: .5, y: .5, z: -1}, {x: 0, y: 0, z: 1}).id, 27);
  const bed = {get: (x, y, z) => x === 0 && y === 0 && z === 0 ? 28 : 0};
  assert.equal(blockHeight(28), .56);
  assert.equal(blockHeight(1), 1);
  assert.equal(collides(bed, {x: .5, y: .4, z: .5}), true);
  assert.equal(collides(bed, {x: .5, y: .56, z: .5}), false);
  const body = {x: .5, y: 2, z: .5};
  assert.equal(moveBody(bed, body, {x: 0, y: -3, z: 0}).y, true);
  assert.ok(Math.abs(body.y - .56) < .001);
});

test('surface reflects solid user edits and ignores water and torches', () => {
  const world = new World('Astra');
  world.set(-4, HEIGHT - 2, -4, 26);
  world.set(-4, HEIGHT - 1, -4, 27);
  assert.equal(world.surface(-4, -4), HEIGHT - 2);
  world.set(-4, HEIGHT - 2, -4, 7);
  assert.ok(world.surface(-4, -4) < HEIGHT - 2);
});
