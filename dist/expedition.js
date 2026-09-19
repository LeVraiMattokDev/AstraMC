import { ITEMS, ITEM_IDS as I } from './survival.js';

const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const finite = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const record = v => v && typeof v === 'object' && !Array.isArray(v);
const MAX_COUNT = 999999;
const STATS = ['distance', 'fishCaught', 'crafted', 'campsBuilt', 'nightsSurvived'];
const MAX_COORDINATE = 10000000;
const emptyChest = () => ({ counts: {}, durability: {} });
const cloneChest = c => ({ counts: { ...c.counts }, durability: { ...c.durability } });
const capacity = id => ITEMS[id]?.kind === 'tool' || ITEMS[id]?.unique ? 1 : MAX_COUNT;
function validKey(key) {
  if (typeof key !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(key)) return false;
  const xyz = key.split(',').map(Number);
  return xyz.every(v => Number.isSafeInteger(v) && Math.abs(v) <= MAX_COORDINATE) && xyz.join(',') === key;
}
const validAmount = n => Number.isSafeInteger(n) && n > 0 && n <= MAX_COUNT;
const validItem = id => Number.isSafeInteger(id) && id > 0 && Object.hasOwn(ITEMS, id);
function validateChest(chest) {
  if (!record(chest) || !record(chest.counts) || !record(chest.durability)) throw new Error('Coffre invalide');
  const clean = emptyChest();
  for (const [key, n] of Object.entries(chest.counts)) {
    const id = Number(key);
    if (String(id) !== key || !validItem(id) || !validAmount(n) || n > capacity(id)) throw new Error('Contenu du coffre invalide');
    clean.counts[id] = n;
  }
  for (const [key, n] of Object.entries(chest.durability)) {
    const id = Number(key);
    if (String(id) !== key || ITEMS[id]?.kind !== 'tool' || !clean.counts[id] || !Number.isSafeInteger(n) || n < 1 || n > ITEMS[id].durability) throw new Error('Usure du coffre invalide');
    clean.durability[id] = n;
  }
  for (const id of Object.keys(clean.counts)) if (ITEMS[id].kind === 'tool' && !clean.durability[id]) throw new Error('Usure manquante');
  return clean;
}

/** DOM-free exposure, fishing and storage. All gauges are 0..100; warmth means
 * thermal comfort, not body temperature. tick() returns damage for the game to apply.
 * Water checks, flask ownership, rod wear and applying caught fish belong to the caller.
 */
export class Expedition {
  constructor(saved, { random = Math.random } = {}) {
    this.stamina = 100;
    this.hydration = 100;
    this.warmth = 100;
    this.wetness = 0;
    this.flaskWater = 0;
    this.stats = Object.fromEntries(STATS.map(key => [key, 0]));
    this.chests = {};
    this.fishing = null;
    this._thirst = 0;
    this._cold = 0;
    this._sprintRecovering = false;
    this._random = typeof random === 'function' ? random : Math.random;
    if (saved !== undefined && saved !== null) this.restore(saved);
  }

  get canSprint() { return this.stamina > 0 && !this._sprintRecovering && this.hydration > 5 && this.warmth > 10; }

  /** Finite seconds, capped at 60 per invocation. The caller pauses menus. Weather
   * precipitation is 0..1 and temperature is ambient degrees Celsius. Pass actual
   * horizontal speed in blocks/s to count travelled distance, including while creative.
   */
  tick(dt, { running = false, moving = false, swimming = false, submerged = false,
    sheltered = false, temperature = 18, precipitation = 0, nearFire = false, creative = false, speed = 0 } = {}) {
    let damage = 0;
    if (!Number.isFinite(dt) || dt <= 0) return this._status(damage);
    dt = Math.min(dt, 60);
    this.stats.distance += Math.max(0, finite(speed)) * dt;
    if (creative) { this.stamina = 100; this._sprintRecovering = false; return this._status(damage); }
    temperature = clamp(finite(temperature, 18), -60, 60);
    precipitation = clamp(finite(precipitation), 0, 1);
    while (dt > 1e-8) {
      const step = Math.min(.1, dt); dt -= step;
      const sprinting = running && moving && this.canSprint;
      const drain = swimming && moving ? 5 : sprinting ? 13 : 0;
      const regen = moving ? 8 : 15;
      this.stamina = clamp(this.stamina + (drain ? -drain : regen) * step, 0, 100);
      if (this.stamina <= 0) this._sprintRecovering = true;
      if (this.stamina >= 25) this._sprintRecovering = false;
      const thirstRate = (sprinting ? .22 : moving ? .16 : .11) + (temperature > 28 ? (temperature - 28) * .005 : 0);
      const dehydratedSeconds = Math.max(0, step - this.hydration / thirstRate);
      this.hydration = Math.max(0, this.hydration - thirstRate * step);
      const wetRate = submerged ? 28 : swimming ? 14 : !sheltered && precipitation ? precipitation * .9 : -(nearFire ? 3.5 : sheltered ? .18 : .09 + Math.max(0, temperature) * .008);
      this.wetness = clamp(this.wetness + wetRate * step, 0, 100);
      const comfort = nearFire ? 100 : clamp(50 + temperature * 2.5 - this.wetness * .6 + (moving ? 10 : 0), 0, 100);
      const response = nearFire ? 30 : comfort < this.warmth ? 200 : 150;
      this.warmth += (comfort - this.warmth) * (1 - Math.exp(-step / response));
      if (this.hydration <= 0) {
        this._thirst += dehydratedSeconds;
        while (this._thirst >= 8) { this._thirst -= 8; damage += 1; }
      } else this._thirst = 0;
      if (this.warmth < 10) {
        this._cold += step;
        while (this._cold >= 10) { this._cold -= 10; damage += 1; }
      } else this._cold = 0;
    }
    return this._status(damage);
  }

  _status(damage) { return { canSprint: this.canSprint, damage, cold: this.warmth < 30, thirsty: this.hydration < 25, exhausted: !this.canSprint }; }

  fillFlask() { this.flaskWater = 4; return this.flaskWater; }
  drink() {
    if (this.flaskWater <= 0 || this.hydration >= 100) return false;
    this.flaskWater -= 1;
    this.hydration = Math.min(100, this.hydration + 35);
    this._thirst = 0;
    return true;
  }
  /** A successful berry/food consumption can replenish a little water. */
  nourish(id) { this.hydration = Math.min(100, this.hydration + (ITEMS[id]?.hydration ?? 0)); }
  bandage(survival) {
    if (!survival || survival.health <= 0 || survival.health >= 20 || !survival.remove(I.BANDAGE, 1)) return false;
    survival.health = Math.min(20, survival.health + 6);
    return true;
  }

  /** Starts a 4..8s wait followed by a 2.4s bite window. Caller verifies water and rod. */
  startFishing(waterPosition) {
    if (this.fishing || !record(waterPosition) || !['x', 'y', 'z'].every(k => Number.isFinite(waterPosition[k]))) return false;
    const roll = clamp(finite(this._random(), .5), 0, 1);
    this.fishing = { phase: 'waiting', remaining: 4 + roll * 4, position: { x: waterPosition.x, y: waterPosition.y, z: waterPosition.z } };
    return true;
  }
  tickFishing(dt) {
    if (!this.fishing) return { phase: 'idle', remaining: 0 };
    if (Number.isFinite(dt) && dt > 0) {
      this.fishing.remaining -= Math.min(dt, 60);
      if (this.fishing.phase === 'waiting' && this.fishing.remaining <= 0) {
        this.fishing.phase = 'bite';
        this.fishing.remaining += 2.4;
      }
      if (this.fishing.phase === 'bite' && this.fishing.remaining <= 0) {
        this.fishing = null;
        return { phase: 'escaped', remaining: 0 };
      }
    }
    return { phase: this.fishing.phase, remaining: this.fishing.remaining };
  }
  reel() {
    const success = this.fishing?.phase === 'bite' && this.fishing.remaining > 0;
    this.fishing = null;
    if (success) this.stats.fishCaught += 1;
    return { success: !!success, itemId: success ? I.RAW_FISH : 0, count: success ? 1 : 0 };
  }
  cancelFishing() { this.fishing = null; }

  /** Never returns a mutable reference to persisted chest contents. */
  chest(key) { return validKey(key) ? cloneChest(this.chests[key] ?? emptyChest()) : null; }

  /** Exact atomic transfers. Tools retain durability and each inventory can hold
   * one tool of each kind, one flask, and 999999 of each stackable item.
   */
  deposit(key, survival, id, n = 1) {
    if (!validKey(key) || !validItem(id) || !validAmount(n) || !survival || survival.count(id) < n) return false;
    const chest = this.chests[key] ?? emptyChest();
    if ((chest.counts[id] ?? 0) + n > capacity(id)) return false;
    const durability = survival.durability[id];
    if (ITEMS[id].kind === 'tool' && (!Number.isSafeInteger(durability) || durability < 1 || durability > ITEMS[id].durability)) return false;
    if (!survival.remove(id, n)) return false;
    chest.counts[id] = (chest.counts[id] ?? 0) + n;
    if (ITEMS[id].kind === 'tool') chest.durability[id] = durability;
    this.chests[key] = chest;
    return true;
  }
  withdraw(key, survival, id, n = 1) {
    if (!validKey(key) || !validItem(id) || !validAmount(n) || !survival) return false;
    const chest = this.chests[key];
    if (!chest || (chest.counts[id] ?? 0) < n || survival.count(id) + n > capacity(id)) return false;
    const durability = chest.durability[id];
    if (survival.add(id, n) !== n) return false;
    if (ITEMS[id].kind === 'tool') survival.durability[id] = durability;
    chest.counts[id] -= n;
    if (chest.counts[id] === 0) { delete chest.counts[id]; delete chest.durability[id]; }
    if (Object.keys(chest.counts).length === 0) delete this.chests[key];
    return true;
  }
  /** Destructive loot extraction, exactly once. Returns [{id,count,durability?}]. */
  takeChest(key) {
    if (!validKey(key) || !this.chests[key]) return [];
    const c = this.chests[key];
    const drops = Object.entries(c.counts).map(([id, count]) => ({ id: Number(id), count, ...(c.durability[id] ? { durability: c.durability[id] } : {}) }));
    delete this.chests[key];
    return drops;
  }

  serialize() {
    return { version: 1, stamina: this.stamina, hydration: this.hydration, warmth: this.warmth, wetness: this.wetness,
      flaskWater: this.flaskWater, stats: { ...this.stats }, chests: Object.fromEntries(Object.entries(this.chests).map(([k, c]) => [k, cloneChest(c)])),
      timers: { thirst: this._thirst, cold: this._cold }, sprintRecovering: this._sprintRecovering };
  }
  /** Strict validation is atomic. An absent expedition record means legacy defaults. */
  restore(saved) {
    if (saved === undefined || saved === null) return this;
    const fail = () => { throw new Error('Sauvegarde d’expédition invalide'); };
    if (!record(saved) || saved.version !== 1) fail();
    for (const key of ['stamina', 'hydration', 'warmth', 'wetness']) if (!Number.isFinite(saved[key]) || saved[key] < 0 || saved[key] > 100) fail();
    if (!Number.isInteger(saved.flaskWater) || saved.flaskWater < 0 || saved.flaskWater > 4 || !record(saved.stats) || !record(saved.chests)) fail();
    const stats = {};
    for (const key of STATS) {
      const value = saved.stats[key] ?? 0;
      if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || (key !== 'distance' && !Number.isInteger(value))) fail();
      stats[key] = value;
    }
    const chests = {};
    if (Object.keys(saved.chests).length > 10000) fail();
    for (const [key, chest] of Object.entries(saved.chests)) {
      if (!validKey(key)) fail();
      chests[key] = validateChest(chest);
    }
    const timers = saved.timers ?? { thirst: 0, cold: 0 };
    if (!record(timers) || !Number.isFinite(timers.thirst) || timers.thirst < 0 || timers.thirst >= 8 || !Number.isFinite(timers.cold) || timers.cold < 0 || timers.cold >= 10) fail();
    if (saved.sprintRecovering !== undefined && typeof saved.sprintRecovering !== 'boolean') fail();
    Object.assign(this, { stamina: saved.stamina, hydration: saved.hydration, warmth: saved.warmth, wetness: saved.wetness,
      flaskWater: saved.flaskWater, stats, chests, fishing: null, _thirst: timers.thirst, _cold: timers.cold,
      _sprintRecovering: saved.sprintRecovering ?? saved.stamina === 0 });
    return this;
  }
}
