import test from 'node:test';
import assert from 'node:assert/strict';
import { Survival, ITEMS, ITEM_IDS as I, RECIPES, attackDamage } from '../dist/survival.js';

test('starts with food, and counts reject malformed/negative/unknown input', () => {
  const s = new Survival();
  assert.equal(s.count(I.APPLE), 3);
  assert.equal(s.add(5, -1), 0);
  assert.equal(s.add(5, Infinity), 0);
  assert.equal(s.add(999, 2), 0);
  assert.equal(s.add(0, 1), 0);
  assert.equal(s.add(' 5 ', 1), 0);
  assert.equal(s.remove(I.APPLE, 4), false);
  assert.equal(s.count(I.APPLE), 3);
  assert.equal(s.remove(I.APPLE, 1), true);
  assert.equal(s.count(I.APPLE), 2);
});

test('wood-to-pickaxe progression consumes exact ingredients and requires table', () => {
  const s = new Survival();
  s.add(5, 3);
  assert.equal(s.craft('planks'), true);
  assert.equal(s.count(5), 2);
  assert.equal(s.count(8), 4);
  assert.equal(s.craft('crafting_table'), true);
  assert.equal(s.count(25), 1);
  assert.equal(s.craft('planks'), true);
  assert.equal(s.craft('planks'), true);
  assert.equal(s.craft('sticks'), true);
  const before = s.serialize();
  assert.equal(s.craft('wood_pickaxe'), false);
  assert.deepEqual(s.serialize(), before);
  assert.equal(s.craft('wood_pickaxe', 'table'), true);
  assert.equal(s.count(I.WOOD_PICKAXE), 1);
  assert.equal(s.count(I.STICK), 2);
  assert.equal(s.count(8), 3);
  assert.equal(s.durability[I.WOOD_PICKAXE], ITEMS[I.WOOD_PICKAXE].durability);
});

test('insufficient resources and duplicate tools fail atomically', () => {
  const s = new Survival();
  s.add(8, 10);
  let before = s.serialize();
  assert.equal(s.craft('wood_pickaxe', 'table'), false);
  assert.deepEqual(s.serialize(), before);
  s.add(I.STICK, 10);
  assert.equal(s.craft('wood_pickaxe', 'table'), true);
  before = s.serialize();
  assert.equal(s.craft('wood_pickaxe', 'table'), false);
  assert.deepEqual(s.serialize(), before);
  assert.equal(s.craft('nonexistent', 'table'), false);
});

test('furnace consumes fuel; stations and bed recipe are enforced', () => {
  const s = new Survival();
  s.add(I.RAW_IRON, 2);
  s.add(I.COAL, 1);
  assert.equal(s.craft('iron_ingot', 'table'), false);
  assert.equal(s.craft('iron_ingot', 'furnace'), true);
  assert.equal(s.count(I.RAW_IRON), 1);
  assert.equal(s.count(I.IRON_INGOT), 1);
  assert.equal(s.count(I.COAL), 0);
  assert.equal(s.xp, 1);
  assert.equal(s.craft('iron_ingot', 'furnace'), false);
  s.add(13, 3); s.add(8, 3);
  assert.equal(s.craft('bed', 'table'), true);
  assert.equal(s.count(I.BED), 1);
  assert.ok(RECIPES.every(r => r.ingredients.every(([id]) => ITEMS[id]) && ITEMS[r.output[0]]));
});

test('mining tier progression, tool speeds and appropriate drops', () => {
  const s = new Survival();
  for (const id of [I.WOOD_PICKAXE, I.STONE_PICKAXE, I.IRON_PICKAXE, I.DIAMOND_PICKAXE, I.WOOD_AXE]) s.add(id);
  assert.equal(s.mineInfo(1).dropId, 2);
  assert.equal(s.mineInfo(3).dropCount, 0);
  assert.equal(s.mineInfo(3).allowed, true);
  assert.equal(s.mineInfo(3, I.WOOD_PICKAXE).dropId, 11);
  assert.ok(s.mineInfo(3, I.WOOD_PICKAXE).seconds < s.mineInfo(3).seconds);
  assert.equal(s.mineInfo(17, I.WOOD_PICKAXE).dropId, I.COAL);
  assert.equal(s.mineInfo(18, I.WOOD_PICKAXE).dropCount, 0);
  assert.equal(s.mineInfo(18, I.STONE_PICKAXE).dropId, I.RAW_IRON);
  assert.equal(s.mineInfo(19, I.STONE_PICKAXE).dropCount, 0);
  assert.equal(s.mineInfo(19, I.IRON_PICKAXE).dropId, I.DIAMOND);
  assert.equal(s.mineInfo(20, I.IRON_PICKAXE).dropCount, 0);
  assert.equal(s.mineInfo(20, I.DIAMOND_PICKAXE).dropId, 20);
  assert.ok(s.mineInfo(5, I.WOOD_AXE).seconds < s.mineInfo(5, I.WOOD_PICKAXE).seconds);
  assert.equal(s.mineInfo(24, I.DIAMOND_PICKAXE).allowed, false);
  assert.equal(s.mineInfo(7).allowed, false);
  assert.equal(s.mineInfo(0).allowed, false);
  assert.equal(s.mineInfo(6).dropCount, 0);
});

test('tools break after their exact use count and lose mining bonus', () => {
  const s = new Survival();
  s.add(I.WOOD_PICKAXE);
  for (let n = 1; n < ITEMS[I.WOOD_PICKAXE].durability; n++) assert.equal(s.wearTool(I.WOOD_PICKAXE), false);
  assert.equal(s.durability[I.WOOD_PICKAXE], 1);
  assert.equal(s.wearTool(I.WOOD_PICKAXE), true);
  assert.equal(s.count(I.WOOD_PICKAXE), 0);
  assert.equal(s.durability[I.WOOD_PICKAXE], undefined);
  assert.equal(s.mineInfo(3, I.WOOD_PICKAXE).dropCount, 0);
  assert.equal(s.wearTool(I.WOOD_PICKAXE), false);
  assert.equal(attackDamage(I.DIAMOND_SWORD), 7);
  assert.equal(attackDamage(8), 1);
});

test('food replenishes hunger, regeneration consumes hunger, starvation harms', () => {
  const s = new Survival();
  assert.equal(s.eat(I.APPLE), false);
  s.hunger = 12;
  assert.equal(s.eat(I.APPLE), true);
  assert.equal(s.hunger, 16);
  assert.equal(s.count(I.APPLE), 2);
  assert.equal(s.eat(5), false);
  s.health = 18; s.hunger = 20;
  s.tick(4, {});
  assert.equal(s.health, 19);
  assert.ok(s.hunger < 20);
  s.hunger = 0;
  const result = s.tick(4, {});
  assert.equal(s.health, 18);
  assert.equal(result.damaged, true);
  const idle = new Survival(), running = new Survival();
  idle.tick(60, {}); running.tick(60, { moving: true, running: true });
  assert.ok(running.hunger < idle.hunger);
});

test('submersion drains air, drowning hurts and surfacing recovers', () => {
  const s = new Survival();
  s.tick(9, { submerged: true });
  assert.equal(s.health, 20);
  assert.equal(s.oxygen, 2);
  assert.equal(s.tick(4, { submerged: true }).damaged, true);
  assert.equal(s.health, 18);
  s.tick(3, { submerged: false });
  assert.equal(s.oxygen, 20);
  assert.equal(s.damage(NaN), 0);
  assert.equal(s.damage(-1), 0);
  assert.equal(s.damage(100), 18);
  assert.deepEqual(s.tick(1, {}), { died: true, damaged: false });
  assert.equal(s.eat(I.APPLE), false);
});

test('save roundtrip preserves inventory, tool wear, vitals and partial timers', () => {
  const s = new Survival();
  s.add(I.IRON_PICKAXE); s.wearTool(I.IRON_PICKAXE); s.add(8, 27);
  s.health = 15; s.tick(1.5, { moving: true });
  const saved = s.serialize();
  const restored = new Survival(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.serialize(), saved);
  saved.counts[8] = 1;
  assert.equal(s.count(8), 27);
  assert.equal(restored.count(8), 27);
});

test('breath grace period and drowning damage are consistent across tick sizes', () => {
  const slow = new Survival(), fast = new Survival();
  slow.tick(14.1, { submerged: true });
  for (let i = 0; i < 1410; i++) fast.tick(.01, { submerged: true });
  assert.equal(slow.health, fast.health);
  assert.equal(slow.health, 16);
  assert.ok(Math.abs(slow.hunger - fast.hunger) < 1e-9);
  assert.ok(Math.abs(slow.serialize().timers.drown - fast.serialize().timers.drown) < 1e-9);
});

test('restore rejects corrupt saves atomically', () => {
  const s = new Survival();
  const before = s.serialize();
  for (const mutate of [
    saved => { saved.health = NaN; },
    saved => { saved.hunger = 21; },
    saved => { saved.oxygen = -1; },
    saved => { saved.xp = Infinity; },
    saved => { saved.counts[5] = -1; },
    saved => { saved.counts[5] = .5; },
    saved => { saved.counts[999] = 2; },
    saved => { saved.counts[I.WOOD_PICKAXE] = 1; },
    saved => { saved.durability[I.WOOD_PICKAXE] = 50; },
    saved => { saved.timers.regen = 9999; },
    saved => { saved.counts = []; },
  ]) {
    const corrupted = structuredClone(before);
    mutate(corrupted);
    assert.throws(() => s.restore(corrupted), /invalide/);
    assert.deepEqual(s.serialize(), before);
  }
});
