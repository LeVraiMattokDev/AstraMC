import test from 'node:test';
import assert from 'node:assert/strict';
import { Survival, ITEM_IDS as I, ITEMS } from '../dist/survival.js';
import { Expedition } from '../dist/expedition.js';

const advance = (e, seconds, settings) => {
  let damage = 0;
  while (seconds > 0) { const dt = Math.min(seconds, 1); damage += e.tick(dt, settings).damage; seconds -= dt; }
  return damage;
};

test('legacy worlds receive safe expedition defaults; creative freezes exposure', () => {
  const e = new Expedition();
  assert.equal(e.hydration, 100);
  assert.equal(e.warmth, 100);
  assert.equal(e.flaskWater, 0);
  assert.equal(e.canSprint, true);
  assert.equal(advance(e, 600, { creative: true, temperature: -30, precipitation: 1 }), 0);
  assert.equal(e.hydration, 100);
  assert.equal(e.warmth, 100);
  assert.equal(e.wetness, 0);
});

test('sprint exhausts the player and requires a real recovery window', () => {
  const e = new Expedition();
  e.tick(7.8, { moving: true, running: true });
  assert.equal(e.canSprint, false);
  assert.ok(e.stamina < 3);
  e.tick(1, { moving: true });
  assert.equal(e.canSprint, false);
  e.tick(2, {});
  assert.equal(e.canSprint, true);
  assert.ok(e.stamina > 25);
});

test('thirst allows roughly ten minutes of walking, then deals gradual damage', () => {
  const e = new Expedition();
  assert.equal(advance(e, 600, { moving: true, speed: 4 }), 0);
  assert.ok(e.hydration > 3 && e.hydration < 5);
  assert.equal(e.stats.distance, 2400);
  assert.equal(advance(e, 42, { moving: true }), 2);
});

test('flask charges, berries and bandages only consume when useful', () => {
  const e = new Expedition(), s = new Survival();
  assert.equal(e.drink(), false);
  assert.equal(e.fillFlask(), 4);
  assert.equal(e.drink(), false);
  assert.equal(e.flaskWater, 4);
  e.hydration = 10;
  assert.equal(e.drink(), true);
  assert.equal(e.hydration, 45);
  assert.equal(e.flaskWater, 3);
  e.nourish(I.BERRIES);
  assert.equal(e.hydration, 49);
  s.add(I.BANDAGE, 2);
  assert.equal(e.bandage(s), false);
  assert.equal(s.count(I.BANDAGE), 2);
  s.damage(12);
  assert.equal(e.bandage(s), true);
  assert.equal(s.health, 14);
  assert.equal(s.count(I.BANDAGE), 1);
  s.damage(20);
  assert.equal(e.bandage(s), false);
  assert.equal(s.count(I.BANDAGE), 1);
});

test('rain wets and chills gradually; shelter stops rain; fire dries and warms', () => {
  const e = new Expedition(), sheltered = new Expedition();
  advance(e, 240, { precipitation: 1, temperature: -8 });
  advance(sheltered, 240, { precipitation: 1, temperature: -8, sheltered: true });
  assert.equal(e.wetness, 100);
  assert.equal(sheltered.wetness, 0);
  assert.ok(e.warmth < sheltered.warmth);
  assert.ok(e.warmth > 10, 'no immediate cold death on a short walk');
  const before = e.warmth;
  advance(e, 60, { temperature: -8, nearFire: true, sheltered: true });
  assert.equal(e.wetness, 0);
  assert.ok(e.warmth > before + 30);
});

test('exposure damage and gauges are nearly independent of frame duration', () => {
  const a = new Expedition(), b = new Expedition();
  a.hydration = b.hydration = 1;
  a.warmth = b.warmth = 2;
  const settings = { temperature: -30, precipitation: 1, moving: true };
  const damageA = a.tick(40, settings).damage;
  let damageB = 0;
  for (let i = 0; i < 4000; i++) damageB += b.tick(.01, settings).damage;
  assert.equal(damageA, damageB);
  assert.ok(Math.abs(a.hydration - b.hydration) < .00001);
  assert.ok(Math.abs(a.wetness - b.wetness) < .00001);
  assert.ok(Math.abs(a.warmth - b.warmth) < .03);
});

test('fishing catches only in the bite window and cannot reel twice', () => {
  const e = new Expedition(undefined, { random: () => 0 });
  assert.equal(e.startFishing({ x: 2, y: 10, z: 4 }), true);
  assert.equal(e.startFishing({ x: 2, y: 10, z: 4 }), false);
  assert.equal(e.tickFishing(3).phase, 'waiting');
  assert.equal(e.reel().success, false);
  e.startFishing({ x: 2, y: 10, z: 4 });
  assert.equal(e.tickFishing(4).phase, 'bite');
  assert.deepEqual(e.reel(), { success: true, itemId: I.RAW_FISH, count: 1 });
  assert.equal(e.reel().success, false);
  assert.equal(e.stats.fishCaught, 1);
  e.startFishing({ x: 2, y: 10, z: 4 });
  assert.equal(e.tickFishing(8).phase, 'escaped');
  assert.equal(e.reel().success, false);
  assert.equal(e.startFishing({ x: NaN, y: 0, z: 0 }), false);
});

test('chest transfers are exact and preserve tool durability without duplication', () => {
  const e = new Expedition(), s = new Survival(), key = '10,25,-2';
  s.add(5, 10); s.add(I.IRON_PICKAXE); s.wearTool(I.IRON_PICKAXE);
  const durability = s.durability[I.IRON_PICKAXE];
  assert.equal(e.deposit(key, s, 5, 11), false);
  assert.equal(s.count(5), 10);
  assert.deepEqual(e.chest(key).counts, {});
  assert.equal(e.deposit(key, s, 5, 6), true);
  assert.equal(s.count(5), 4);
  assert.equal(e.chest(key).counts[5], 6);
  assert.equal(e.deposit(key, s, I.IRON_PICKAXE), true);
  assert.equal(s.count(I.IRON_PICKAXE), 0);
  assert.equal(e.chest(key).durability[I.IRON_PICKAXE], durability);
  s.add(I.IRON_PICKAXE);
  assert.equal(e.withdraw(key, s, I.IRON_PICKAXE), false);
  assert.equal(e.chest(key).counts[I.IRON_PICKAXE], 1);
  s.remove(I.IRON_PICKAXE);
  assert.equal(e.withdraw(key, s, I.IRON_PICKAXE), true);
  assert.equal(s.durability[I.IRON_PICKAXE], durability);
  assert.equal(e.withdraw(key, s, I.IRON_PICKAXE), false);
  assert.equal(e.withdraw(key, s, 5, 7), false);
  assert.equal(e.withdraw(key, s, 5, 6), true);
  assert.equal(s.count(5), 10);
  assert.deepEqual(e.chest(key).counts, {});
});

test('chest snapshots are detached, destruction extracts once, coordinates are canonical', () => {
  const e = new Expedition(), s = new Survival();
  s.add(8, 12); s.add(I.FISHING_ROD); s.wearTool(I.FISHING_ROD);
  for (const key of ['1.5,2,3', '__proto__', '01,2,3', '1,NaN,3', '1,2', '10000001,2,3']) assert.equal(e.deposit(key, s, 8), false);
  e.deposit('1,2,3', s, 8, 10);
  e.deposit('1,2,3', s, I.FISHING_ROD);
  const snapshot = e.chest('1,2,3');
  snapshot.counts[8] = 1000;
  assert.equal(e.chest('1,2,3').counts[8], 10);
  assert.deepEqual(e.takeChest('1,2,3'), [{ id: 8, count: 10 }, { id: I.FISHING_ROD, count: 1, durability: 79 }]);
  assert.deepEqual(e.takeChest('1,2,3'), []);
  assert.equal(s.count(8), 2);
});

test('expedition round-trips storage, gauges and timers while dropping active fishing', () => {
  const e = new Expedition(undefined, { random: () => .5 }), s = new Survival();
  s.add(5, 6); e.deposit('-3,20,7', s, 5, 2);
  e.tick(40, { temperature: 2, precipitation: 1, speed: 3 });
  e.fillFlask(); e.drink();
  e.startFishing({ x: 1, y: 10, z: 2 });
  const saved = e.serialize(), restored = new Expedition(saved);
  assert.deepEqual(restored.serialize(), saved);
  assert.equal(restored.fishing, null);
  saved.chests['-3,20,7'].counts[5] = 99;
  assert.equal(restored.chest('-3,20,7').counts[5], 2);
  const before = restored.serialize();
  for (const invalid of [
    { ...before, hydration: NaN }, { ...before, flaskWater: 5 },
    { ...before, chests: { '1,2,3': { counts: { [I.FISHING_ROD]: 1 }, durability: {} } } },
    { ...before, timers: { thirst: 8, cold: 0 } },
  ]) { assert.throws(() => restored.restore(invalid)); assert.deepEqual(restored.serialize(), before); }
});

test('expedition recipes enforce ingredients, stations and unique flask capacity', () => {
  const s = new Survival();
  s.add(5, 3); s.add(I.STICK, 6); s.add(I.COAL, 1); s.add(13, 2); s.add(I.IRON_INGOT, 4);
  assert.equal(s.craft('campfire'), true);
  assert.equal(s.count(I.CAMPFIRE), 1);
  assert.equal(s.craft('fishing_rod'), false);
  assert.equal(s.craft('fishing_rod', 'table'), true);
  assert.equal(s.durability[I.FISHING_ROD], 80);
  assert.equal(s.craft('flask', 'table'), true);
  assert.equal(s.craft('flask', 'table'), false);
  assert.equal(s.count(I.IRON_INGOT), 2);
  assert.equal(s.add(I.FLASK), 0);
  assert.equal(s.craft('bandages'), true);
  assert.equal(s.count(I.BANDAGE), 3);
  s.add(I.RAW_FISH, 2);
  assert.equal(s.craft('campfire_fish', 'hand'), false);
  assert.equal(s.craft('campfire_fish', 'campfire'), true);
  assert.equal(s.count(I.COOKED_FISH), 1);
  assert.equal(s.count(I.RAW_FISH), 1);
  assert.equal(s.mineInfo(I.LANTERN).dropId, 0);
  s.add(I.WOOD_PICKAXE);
  assert.equal(s.mineInfo(I.LANTERN, I.WOOD_PICKAXE).dropId, I.LANTERN);
  assert.equal(s.mineInfo(I.CHEST).dropId, I.CHEST);
  assert.equal(ITEMS[I.FLASK].unique, true);
  assert.deepEqual(new Survival(s.serialize()).serialize(), s.serialize());
});
