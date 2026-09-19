// DOM-free survival rules. IDs 1–31 match world.js; inventory-only IDs start at 100.
export const ITEM_IDS = Object.freeze({
  STICK: 100, COAL: 101, RAW_IRON: 102, IRON_INGOT: 103, DIAMOND: 104,
  APPLE: 105, RAW_MEAT: 106, COOKED_MEAT: 107,
  WOOD_PICKAXE: 110, STONE_PICKAXE: 111, IRON_PICKAXE: 112, DIAMOND_PICKAXE: 113,
  WOOD_AXE: 120, STONE_AXE: 121, IRON_AXE: 122, DIAMOND_AXE: 123,
  WOOD_SWORD: 130, STONE_SWORD: 131, IRON_SWORD: 132, DIAMOND_SWORD: 133,
  CRAFTING_TABLE: 25, FURNACE: 26, TORCH: 27, BED: 28, CAMPFIRE: 29, CHEST: 30, LANTERN: 31,
  FLASK: 140, FISHING_ROD: 141, RAW_FISH: 142, COOKED_FISH: 143, BANDAGE: 144, BERRIES: 145, MUSHROOM: 146, BREAD: 147,
});

const blocks = [
  [1, 'Herbe', '#7aab47'], [2, 'Terre', '#8b6142'], [3, 'Pierre', '#92979e'],
  [4, 'Sable', '#e0cf91'], [5, 'Chêne', '#88603b'], [6, 'Feuilles', '#51883b'],
  [7, 'Eau', '#5da1be'], [8, 'Planches', '#c99b61'], [9, 'Briques', '#b46c53'],
  [10, 'Verre', '#b9e1e6'], [11, 'Pavés', '#777e87'], [12, 'Neige', '#e9f1f2'],
  [13, 'Laine blanche', '#efeee5'], [14, 'Laine rouge', '#b84943'],
  [15, 'Laine bleue', '#4769ad'], [16, 'Laine jaune', '#e8bd43'],
  [17, 'Minerai de charbon', '#5e6266'], [18, 'Minerai de fer', '#bb977e'],
  [19, 'Minerai de diamant', '#62d7d5'], [20, 'Obsidienne', '#3f3559'],
  [21, 'Grès', '#d8c492'], [22, 'Laine verte', '#669b49'],
  [23, 'Laine violette', '#9764b7'], [24, 'Socle', '#45464b'],
  [25, 'Établi', '#b6844c'], [26, 'Fourneau', '#6d7479'], [27, 'Torche', '#ffc961'],
  [28, 'Lit', '#b84943'], [29, 'Feu de camp', '#ec9549'], [30, 'Coffre', '#b78a52'], [31, 'Lanterne', '#f4cd74'],
];
const items = Object.fromEntries(blocks.map(([id, name, color]) => [id, { id, name, color, kind: 'block' }]));
const item = (id, name, color, kind, icon, extra = {}) => {
  items[id] = { id, name, color, kind, icon, ...extra };
};
item(0, 'Mains nues', '#e8b68f', 'material', '✋');
item(100, 'Bâton', '#b48b5c', 'material', '╱');
item(101, 'Charbon', '#30363d', 'material', '◆');
item(102, 'Fer brut', '#caa38b', 'material', '◈');
item(103, 'Lingot de fer', '#d5dbe2', 'material', '▰');
item(104, 'Diamant', '#6ae1e2', 'material', '◆');
item(105, 'Pomme', '#e65d54', 'food', '🍎', { nutrition: 4 });
item(106, 'Viande crue', '#d88580', 'food', '🥩', { nutrition: 3 });
item(107, 'Viande cuite', '#ad724f', 'food', '🍖', { nutrition: 8 });
item(140, 'Gourde', '#79adb1', 'usable', '◒', { unique: true });
item(141, 'Canne à pêche', '#c7a375', 'tool', '🎣', { durability: 80, toolType: 'fishing', tier: 0, speed: 1, attack: 1 });
item(142, 'Poisson cru', '#85bfc7', 'food', '🐟', { nutrition: 2 });
item(143, 'Poisson grillé', '#ca996c', 'food', '🐟', { nutrition: 7 });
item(144, 'Bandage', '#eee9d9', 'usable', '✚');
item(145, 'Baies sauvages', '#c95779', 'food', '●', { nutrition: 2, hydration: 4 });
item(146, 'Champignon comestible', '#bd9475', 'food', '🍄', { nutrition: 2 });
item(147, 'Pain', '#d8aa6e', 'food', '🍞', { nutrition: 6 });
const tiers = [
  { name: 'bois', color: '#bd905e', durability: 59, speed: 2 },
  { name: 'pierre', color: '#a6afb9', durability: 131, speed: 4 },
  { name: 'fer', color: '#e1e7ed', durability: 250, speed: 6 },
  { name: 'diamant', color: '#68e2dd', durability: 1561, speed: 8 },
];
for (const [base, toolType, label, icon, baseDamage] of [
  [110, 'pickaxe', 'Pioche', '⛏', 2], [120, 'axe', 'Hache', '🪓', 3], [130, 'sword', 'Épée', '⚔', 4],
]) {
  tiers.forEach((tier, i) => item(base + i, `${label} en ${tier.name}`, tier.color, 'tool', icon,
    { durability: tier.durability, toolType, tier: i + 1, speed: tier.speed, attack: baseDamage + i }));
}
export const ITEMS = Object.freeze(Object.fromEntries(Object.entries(items).map(([id, data]) => [id, Object.freeze(data)])));

const recipe = (id, name, ingredients, output, station = 'hand') =>
  Object.freeze({ id, name, ingredients: Object.freeze(ingredients.map(pair => Object.freeze(pair))), output: Object.freeze(output), station });
const recipes = [
  recipe('planks', 'Planches de chêne', [[5, 1]], [8, 4]),
  recipe('sticks', 'Bâtons', [[8, 2]], [100, 4]),
  recipe('crafting_table', 'Établi', [[8, 4]], [25, 1]),
  recipe('furnace', 'Fourneau', [[11, 8]], [26, 1], 'table'),
  recipe('torches', 'Torches', [[101, 1], [100, 1]], [27, 4]),
  recipe('bed', 'Lit', [[13, 3], [8, 3]], [28, 1], 'table'),
  recipe('campfire', 'Feu de camp', [[5, 3], [100, 3], [101, 1]], [29, 1]),
  recipe('chest', 'Coffre', [[8, 8]], [30, 1], 'table'),
  recipe('lantern', 'Lanterne', [[103, 2], [27, 1]], [31, 1], 'table'),
  recipe('flask', 'Gourde', [[103, 2]], [140, 1], 'table'),
  recipe('fishing_rod', 'Canne à pêche', [[100, 3], [13, 1]], [141, 1], 'table'),
  recipe('bandages', 'Bandages', [[13, 1]], [144, 3]),
  recipe('campfire_fish', 'Griller le poisson', [[142, 1]], [143, 1], 'campfire'),
  recipe('campfire_meat', 'Griller la viande', [[106, 1]], [107, 1], 'campfire'),
];
for (const [index, material, name, key] of [[0, 8, 'bois', 'wood'], [1, 11, 'pierre', 'stone'], [2, 103, 'fer', 'iron'], [3, 104, 'diamant', 'diamond']]) {
  recipes.push(recipe(`${key}_pickaxe`, `Pioche en ${name}`, [[material, 3], [100, 2]], [110 + index, 1], 'table'));
  recipes.push(recipe(`${key}_axe`, `Hache en ${name}`, [[material, 3], [100, 2]], [120 + index, 1], 'table'));
  recipes.push(recipe(`${key}_sword`, `Épée en ${name}`, [[material, 2], [100, 1]], [130 + index, 1], 'table'));
}
recipes.push(
  recipe('iron_ingot', 'Fondre le fer', [[102, 1], [101, 1]], [103, 1], 'furnace'),
  recipe('cooked_meat', 'Cuire la viande', [[106, 1], [101, 1]], [107, 1], 'furnace'),
  recipe('cooked_fish', 'Cuire le poisson', [[142, 1], [101, 1]], [143, 1], 'furnace'),
  recipe('glass', 'Fondre le sable', [[4, 1], [101, 1]], [10, 1], 'furnace'),
  recipe('stone', 'Cuire les pavés', [[11, 1], [101, 1]], [3, 1], 'furnace'),
);
export const RECIPES = Object.freeze(recipes);
const recipeById = new Map(RECIPES.map(value => [value.id, value]));
const MAX_COUNT = 999999;
const validId = id => (typeof id === 'number' || (typeof id === 'string' && String(Number(id)) === id)) &&
  Number(id) > 0 && Number.isInteger(Number(id)) && Object.hasOwn(ITEMS, Number(id));
const amountValid = n => Number.isSafeInteger(n) && n > 0 && n <= MAX_COUNT;
const cap = (n, min, max) => Math.min(max, Math.max(min, n));
const pickBlocks = new Set([3, 9, 11, 17, 18, 19, 20, 21, 26, 31]);
const axeBlocks = new Set([5, 8, 25, 28, 29, 30]);

/** Combat damage for an item ID (inventory ownership is checked by the caller). */
export function attackDamage(id) { return ITEMS[id]?.attack ?? 1; }

export class Survival {
  constructor(saved) {
    this.counts = { [ITEM_IDS.APPLE]: 3 };
    this.durability = {};
    this.health = 20;
    this.hunger = 20;
    this.oxygen = 20;
    this.xp = 0;
    this._regen = 0;
    this._starve = 0;
    this._drown = 0;
    if (saved !== undefined && saved !== null) this.restore(saved);
  }

  count(id) { return validId(id) ? this.counts[id] ?? 0 : 0; }

  /** Returns actual amount added; 0 for invalid input or full capacity. One tool per ID. */
  add(id, n = 1) {
    if (!validId(id) || !amountValid(n)) return 0;
    const data = ITEMS[id], max = data.kind === 'tool' || data.unique ? 1 : MAX_COUNT;
    const added = Math.min(n, max - this.count(id));
    if (added <= 0) return 0;
    this.counts[id] = this.count(id) + added;
    if (data.kind === 'tool') this.durability[id] = data.durability;
    return added;
  }

  /** Removes exactly n items, returning false without mutation if unavailable. */
  remove(id, n = 1) {
    if (!validId(id) || !amountValid(n) || this.count(id) < n) return false;
    const next = this.count(id) - n;
    if (next) this.counts[id] = next;
    else { delete this.counts[id]; delete this.durability[id]; }
    return true;
  }

  canCraft(recipeId, station = 'hand') {
    const r = recipeById.get(recipeId);
    if (!r || !['hand', 'table', 'furnace', 'campfire'].includes(station) || (r.station !== 'hand' && r.station !== station)) return false;
    const [id, count] = r.output;
    const max = ITEMS[id].kind === 'tool' || ITEMS[id].unique ? 1 : MAX_COUNT;
    return this.count(id) + count <= max && r.ingredients.every(([ingredient, n]) => this.count(ingredient) >= n);
  }

  /** Atomically consumes a recipe and gives output; boolean success. */
  craft(recipeId, station = 'hand') {
    if (!this.canCraft(recipeId, station)) return false;
    const r = recipeById.get(recipeId);
    for (const [id, n] of r.ingredients) this.remove(id, n);
    this.add(...r.output);
    if (r.station === 'furnace') this.xp = Math.min(MAX_COUNT, this.xp + 1);
    return true;
  }

  /** Eats one food only while hungry and alive; boolean success. */
  eat(id) {
    const data = ITEMS[id];
    if (this.health <= 0 || this.hunger >= 20 || data?.kind !== 'food' || !this.remove(id, 1)) return false;
    this.hunger = Math.min(20, this.hunger + data.nutrition);
    return true;
  }

  /** Applies positive finite damage, returning actual health lost. */
  damage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const lost = Math.min(this.health, amount);
    this.health -= lost;
    return lost;
  }

  /** allowed=can break; a too-weak/absent pickaxe still breaks but dropCount is 0.
   * Only an owned, unbroken tool contributes speed or harvest tier. No state mutation.
   * Leaves never drop here: caller may roll an apple separately on destruction.
   */
  mineInfo(blockId, toolId = 0) {
    if (!ITEMS[blockId] || ITEMS[blockId].kind !== 'block' || [7, 24].includes(Number(blockId))) {
      return { seconds: Infinity, dropId: 0, dropCount: 0, allowed: false };
    }
    blockId = Number(blockId);
    const held = this.count(toolId) > 0 && this.durability[toolId] > 0 ? ITEMS[toolId] : null;
    const targetTool = pickBlocks.has(blockId) ? 'pickaxe' : axeBlocks.has(blockId) ? 'axe' : null;
    const matched = targetTool !== null && held?.toolType === targetTool;
    const base = blockId === 20 ? 12 : pickBlocks.has(blockId) ? 1.8 : axeBlocks.has(blockId) ? 1.8 : blockId === 6 ? .3 : blockId === 27 ? .12 : .55;
    const requiredTier = blockId === 20 ? 4 : blockId === 19 ? 3 : blockId === 18 ? 2 : pickBlocks.has(blockId) ? 1 : 0;
    const harvest = requiredTier === 0 || (matched && held.tier >= requiredTier);
    let dropId = ({ 1: 2, 3: 11, 6: 0, 10: 0, 17: 101, 18: 102, 19: 104 })[blockId] ?? blockId;
    if (!harvest) dropId = 0;
    const seconds = Math.max(.08, base * (requiredTier && !harvest ? 3.5 : 1) / (matched ? held.speed : 1));
    return { seconds, dropId, dropCount: dropId ? 1 : 0, allowed: true };
  }

  /** Consumes one use of an owned tool. Returns true only when this use breaks it. */
  wearTool(id) {
    if (ITEMS[id]?.kind !== 'tool' || !this.count(id)) return false;
    this.durability[id] -= 1;
    if (this.durability[id] > 0) return false;
    this.remove(id, 1);
    return true;
  }

  /** Advances at most 60s, accepting fractional dt. Died is current death state.
   * Hunger depletes slowly; full food regenerates, zero food hurts, underwater air runs out.
   * Caller should pause ticks while menus are open, and respawn/reset explicitly on death.
   */
  tick(dt, { moving = false, running = false, submerged = false } = {}) {
    if (!Number.isFinite(dt) || dt <= 0 || this.health <= 0) return { died: this.health <= 0, damaged: false };
    dt = Math.min(60, dt);
    const before = this.health;
    // Small fixed steps keep starvation/drowning damage independent of render frame rate.
    let damaged = false;
    while (dt > 1e-8 && this.health > 0) {
      const step = Math.min(.25, dt);
      dt -= step;
      const hungerRate = moving ? (running ? .035 : .015) : .004;
      const starvationTime = Math.max(0, step - this.hunger / hungerRate);
      const drowningTime = submerged ? Math.max(0, step - this.oxygen / 2) : 0;
      this.hunger = Math.max(0, this.hunger - step * hungerRate);
      this.oxygen = cap(this.oxygen + step * (submerged ? -2 : 8), 0, 20);
      if (this.oxygen <= 0 && submerged) {
        this._drown += drowningTime;
        while (this._drown >= 2) { this._drown -= 2; damaged = this.damage(2) > 0 || damaged; }
      } else this._drown = 0;
      if (this.hunger <= 0) {
        this._starve += starvationTime;
        while (this._starve >= 4) { this._starve -= 4; damaged = this.damage(1) > 0 || damaged; }
      } else this._starve = 0;
      if (this.hunger >= 18 && this.health > 0 && this.health < 20 && !submerged) {
        this._regen += step;
        if (this._regen >= 4) {
          this._regen -= 4;
          this.health = Math.min(20, this.health + 1);
          this.hunger = Math.max(0, this.hunger - .25);
        }
      } else this._regen = 0;
    }
    return { died: this.health <= 0, damaged: damaged || this.health < before };
  }

  serialize() {
    return {
      version: 1, counts: { ...this.counts }, durability: { ...this.durability },
      health: this.health, hunger: this.hunger, oxygen: this.oxygen, xp: this.xp,
      timers: { regen: this._regen, starve: this._starve, drown: this._drown },
    };
  }

  /** Strict validation; throws Error and leaves this instance untouched on invalid saves. */
  restore(saved) {
    const fail = () => { throw new Error('Sauvegarde de survie invalide'); };
    const isRecord = value => value && typeof value === 'object' && !Array.isArray(value);
    if (!isRecord(saved) || (saved.version !== undefined && saved.version !== 1) || !isRecord(saved.counts) || !isRecord(saved.durability)) fail();
    const counts = {}, durability = {};
    if (Object.keys(saved.counts).length > Object.keys(ITEMS).length) fail();
    for (const [key, n] of Object.entries(saved.counts)) {
      if (!/^\d+$/.test(key) || String(Number(key)) !== key || !validId(key) || !Number.isSafeInteger(n) || n < 0 || n > MAX_COUNT || ((ITEMS[key].kind === 'tool' || ITEMS[key].unique) && n > 1)) fail();
      if (n) counts[key] = n;
    }
    for (const [key, value] of Object.entries(saved.durability)) {
      const data = ITEMS[key];
      if (!/^\d+$/.test(key) || String(Number(key)) !== key || data?.kind !== 'tool' || !counts[key] || !Number.isSafeInteger(value) || value <= 0 || value > data.durability) fail();
      durability[key] = value;
    }
    for (const key of Object.keys(counts)) if (ITEMS[key].kind === 'tool' && !durability[key]) fail();
    for (const key of ['health', 'hunger', 'oxygen']) if (!Number.isFinite(saved[key]) || saved[key] < 0 || saved[key] > 20) fail();
    if (!Number.isSafeInteger(saved.xp) || saved.xp < 0 || saved.xp > MAX_COUNT) fail();
    const timers = saved.timers ?? { regen: 0, starve: 0, drown: 0 };
    if (!isRecord(timers)) fail();
    for (const [key, limit] of [['regen', 4], ['starve', 4], ['drown', 2]]) if (!Number.isFinite(timers[key]) || timers[key] < 0 || timers[key] >= limit) fail();
    Object.assign(this, { counts, durability, health: saved.health, hunger: saved.hunger, oxygen: saved.oxygen, xp: saved.xp,
      _regen: timers.regen, _starve: timers.starve, _drown: timers.drown });
    return this;
  }
}
