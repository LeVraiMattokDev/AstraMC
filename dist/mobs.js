import * as THREE from './vendor/three.module.js';
import { HEIGHT, hash, solid, blockHeight, raycast as worldRaycast } from './world.js';

const TYPES = {
  pig: { name: 'Cochon', health: 10, height: 1.1, radius: .52, speed: .85, loot: 106, count: 2 },
  sheep: { name: 'Mouton', health: 8, height: 1.25, radius: .55, speed: .7, loot: 13, count: 2 },
  deer: { name: 'Cerf', health: 12, height: 1.92, radius: .5, speed: 1.15, loot: 106, count: 3 },
  hostile: { name: 'Rôdeur', health: 20, height: 1.8, radius: .34, speed: 1.75, loot: 0, count: 5 },
};
const EPS = .001;

/** Wildlife and nocturnal enemies. Coordinates represent feet. */
export class MobSystem {
  constructor({ scene, world, onDamage = () => {}, onLoot = () => {} }) {
    this.scene = scene;
    this.world = world;
    this.onDamage = onDamage;
    this.onLoot = onLoot;
    this.mobs = [];
    this.nextId = 1;
    this.clock = 0;
    this.spawnClock = 0;
    this.initialized = false;
    this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
    this.roundGeometry = new THREE.SphereGeometry(.5, 10, 7);
    this.woolGeometry = new THREE.DodecahedronGeometry(.56, 1);
    this.materials = {};
    const colors = {
      pig: 0xd99391, snout: 0xc57c7e, hoof: 0x76544c,
      wool: 0xe8e6db, sheep: 0xab9275, face: 0x443b35,
      skin: 0x679956, shirt: 0x466e77, pants: 0x454b66,
      eye: 0x212321, pupil: 0xd5d999, hurt: 0xe66757,
      deer: 0x956b43, deerLight: 0xc6a477, antler: 0xb5a28b, nose: 0x322f2a,
    };
    for (const [key, color] of Object.entries(colors)) {
      this.materials[key] = new THREE.MeshStandardMaterial({ color, roughness: .85, metalness: 0 });
    }
    this.ray = new THREE.Ray();
    this.localRay = new THREE.Ray();
    this.inverse = new THREE.Matrix4();
    this.intersection = new THREE.Vector3();
  }

  setWorld(world) {
    this.clear();
    this.world = world;
    this.clock = 0;
    this.spawnClock = 0;
    this.initialized = false;
  }

  clear() {
    for (const mob of this.mobs) this.scene.remove(mob.group);
    this.mobs.length = 0;
  }

  random(mob, salt = 0) {
    return hash(mob.id * 317 + salt, Math.floor(this.clock * .23) + salt, this.world.seedId || 1);
  }

  piece(group, dimensions, position, material, shape = 'box') {
    const geometry = shape === 'round' ? this.roundGeometry : shape === 'wool' ? this.woolGeometry : this.boxGeometry;
    const mesh = new THREE.Mesh(geometry, this.materials[material]);
    mesh.scale.set(...dimensions);
    mesh.position.set(...position);
    mesh.userData.baseMaterial = mesh.material;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  limb(group, origin, dimensions, material) {
    const pivot = new THREE.Group();
    pivot.position.set(...origin);
    group.add(pivot);
    this.piece(pivot, dimensions, [0, -dimensions[1] / 2, 0], material);
    return pivot;
  }

  create(type, x, y, z, health) {
    const definition = TYPES[type];
    if (!definition || this.mobs.length >= 12) return null;
    const group = new THREE.Group();
    const limbs = [];
    let head = null;
    if (type === 'hostile') {
      this.piece(group, [.58, .68, .29], [0, 1.03, 0], 'shirt');
      this.piece(group, [.49, .47, .45], [0, 1.605, 0], 'skin');
      limbs.push(this.limb(group, [-.15, .7, 0], [.24, .7, .27], 'pants'));
      limbs.push(this.limb(group, [.15, .7, 0], [.24, .7, .27], 'pants'));
      const armL = this.limb(group, [-.4, 1.31, 0], [.2, .62, .23], 'skin');
      const armR = this.limb(group, [.4, 1.31, 0], [.2, .62, .23], 'skin');
      armL.rotation.x = armR.rotation.x = -1.1;
      limbs.push(armL, armR);
      this.piece(group, [.09, .065, .015], [-.115, 1.65, .232], 'pupil');
      this.piece(group, [.09, .065, .015], [.115, 1.65, .232], 'pupil');
    } else if (type === 'deer') {
      this.piece(group, [.69, .7, 1.28], [0, 1.09, -.09], 'deer', 'round');
      this.piece(group, [.46, .4, .88], [0, .87, -.03], 'deerLight', 'round');
      const tail = this.piece(group, [.15, .28, .17], [0, 1.17, -.69], 'deerLight', 'round');
      tail.rotation.x = -.6;
      for (const x of [-.235, .235]) for (const z of [-.44, .37]) {
        const leg = this.limb(group, [x, .88, z], [.115, .79, .13], 'deer');
        this.piece(leg, [.14, .13, .18], [0, -.81, .025], 'hoof', 'round');
        limbs.push(leg);
      }
      head = new THREE.Group();head.position.set(0, 1.19, .39);group.add(head);
      this.piece(head, [.3, .6, .34], [0, .2, .05], 'deer', 'round');
      this.piece(head, [.29, .33, .49], [0, .53, .19], 'deer', 'round');
      this.piece(head, [.23, .19, .31], [0, .48, .42], 'deerLight', 'round');
      this.piece(head, [.19, .11, .095], [0, .5, .56], 'nose', 'round');
      for (const side of [-1, 1]) {
        const ear = this.piece(head, [.32, .15, .12], [side * .2, .65, .11], 'deer', 'round');
        ear.rotation.z = side * .35;
        this.piece(head, [.052, .055, .07], [side * .142, .58, .29], 'eye', 'round');
        // Branching antlers share geometry; no per-animal GPU allocations.
        const antler = new THREE.Group();antler.position.set(side * .11, .68, .07);head.add(antler);
        const beam = this.piece(antler, [.055, .51, .065], [side * .07, .23, -.055], 'antler', 'round');beam.rotation.z = -side * .3;
        const fork = this.piece(antler, [.045, .31, .055], [side * .14, .36, .025], 'antler', 'round');fork.rotation.z = -side * .75;
        const tip = this.piece(antler, [.04, .23, .045], [side * .04, .36, .08], 'antler', 'round');tip.rotation.x = .5;
      }
    } else {
      const sheep = type === 'sheep';
      this.piece(group, [sheep ? .84 : .74, sheep ? .67 : .52, 1.02], [0, sheep ? .72 : .64, -.08], sheep ? 'wool' : 'pig', sheep ? 'wool' : 'round');
      this.piece(group, [.45, .44, .46], [0, sheep ? .94 : .84, .59], sheep ? 'sheep' : 'pig', 'round');
      for (const x of [-.25, .25]) for (const z of [-.39, .31]) {
        limbs.push(this.limb(group, [x, .47, z], [.2, .47, .21], sheep ? 'sheep' : 'hoof'));
      }
      this.piece(group, [.08, .085, .022], [-.135, sheep ? 1 : .9, .825], 'eye');
      this.piece(group, [.08, .085, .022], [.135, sheep ? 1 : .9, .825], 'eye');
      this.piece(group, [.25, .16, .09], [0, sheep ? .85 : .77, .85], sheep ? 'face' : 'snout', 'round');
      if (!sheep) for (const side of [-1, 1]) {
        const ear = this.piece(group, [.19, .15, .13], [side * .2, 1.04, .56], 'pig', 'round');
        ear.rotation.z = side * -.45;
      }
    }
    group.position.set(x, y, z);
    const mob = {
      id: this.nextId++, type, definition, group, limbs, head, x, y, z,
      health: Number.isFinite(health) ? Math.min(definition.health, Math.max(1, health)) : definition.health,
      vy: 0, grounded: false, direction: 0, walkTime: 0, decision: 0,
      attackCooldown: 1, hurt: 0, panic: 0, burnClock: 0,
      knockX: 0, knockZ: 0,
      bounds: new THREE.Box3(new THREE.Vector3(-.61, 0, type === 'hostile' ? -.3 : -.62), new THREE.Vector3(.61, definition.height + (type === 'deer' ? .55 : .08), type === 'hostile' ? .69 : type === 'deer' ? 1.08 : .93)),
    };
    mob.direction = this.random(mob, 34) * Math.PI * 2;
    group.rotation.y = mob.direction;
    this.scene.add(group);
    this.mobs.push(mob);
    return mob;
  }

  blocked(mob, x, y, z, includeWater = false) {
    const r = mob.definition.radius;
    for (let by = Math.floor(y + EPS); by <= Math.floor(y + mob.definition.height - EPS); by++) {
      for (let bz = Math.floor(z - r + EPS); bz <= Math.floor(z + r - EPS); bz++) {
        for (let bx = Math.floor(x - r + EPS); bx <= Math.floor(x + r - EPS); bx++) {
          const id = this.world.get(bx, by, bz);
          if ((solid(id) && y < by + blockHeight(id) - EPS) || (includeWater && id === 7)) return true;
        }
      }
    }
    return false;
  }

  safeGround(mob, x, y, z) {
    const r = mob.definition.radius * .8;
    for (const dx of [-r, r]) for (const dz of [-r, r]) {
      let found = false;
      for (let below = .1; below <= 1.2; below += .5) {
        const id = this.world.get(x + dx, y - below, z + dz);
        if (id === 7) return false;
        if (solid(id) && y - below < Math.floor(y - below) + blockHeight(id)) { found = true; break; }
      }
      if (!found) return false;
    }
    return true;
  }

  spawnNear(type, player, attempt = 0) {
    const hostile = type === 'hostile';
    for (let i = 0; i < 28; i++) {
      const phase = attempt * 101 + i * 7 + this.nextId * 13 + Math.floor(this.clock);
      const angle = hash(phase, 823, this.world.seedId || 1) * Math.PI * 2;
      const distance = (hostile ? 12 : 5) + hash(phase, 143, this.world.seedId || 1) * (hostile ? 13 : 12);
      const x = Math.floor(player.x + Math.sin(angle) * distance) + .5;
      const z = Math.floor(player.z + Math.cos(angle) * distance) + .5;
      if (this.mobs.some(m => Math.hypot(m.x - x, m.z - z) < 2)) continue;
      if (type === 'deer' && !['forest', 'plains'].includes(this.world.biome?.(x, z)?.id)) continue;
      let y = HEIGHT - 3;
      while (y > 1 && !this.world.get(x, y, z)) y--;
      const ground = this.world.get(x, y, z);
      if (!solid(ground) || ground === 6 || ground === 5 || (!hostile && ![1, 2, 4, 12].includes(ground))) continue;
      const sample = { definition: TYPES[type] };
      if (this.blocked(sample, x, y + 1, z, true) || !this.safeGround(sample, x, y + 1, z)) continue;
      return this.create(type, x, y + 1 + EPS, z);
    }
    return null;
  }

  moveHorizontal(mob, dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / .12));
    let moved = false;
    for (let step = 0; step < steps; step++) {
      for (const [axis, delta] of [['x', dx / steps], ['z', dz / steps]]) {
        if (!delta) continue;
        const nextX = mob.x + (axis === 'x' ? delta : 0);
        const nextZ = mob.z + (axis === 'z' ? delta : 0);
        let nextY = mob.y;
        if (this.blocked(mob, nextX, nextY, nextZ, true)) {
          // Walk a single stair only from the ground and with clear headroom.
          const stepY = Math.floor(mob.y + .05) + 1 + EPS;
          if (!mob.grounded || stepY - mob.y > 1.05 || this.blocked(mob, mob.x, stepY, mob.z, true) || this.blocked(mob, nextX, stepY, nextZ, true) || !this.safeGround(mob, nextX, stepY, nextZ)) continue;
          nextY = stepY;
        }
        if (mob.grounded && !this.safeGround(mob, nextX, nextY, nextZ)) continue;
        mob.x = nextX; mob.y = nextY; mob.z = nextZ;
        moved = true;
      }
    }
    return moved;
  }

  fall(mob, dt) {
    mob.vy = Math.max(-16, mob.vy - 20 * dt);
    const movement = mob.vy * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(movement) / .12));
    mob.grounded = false;
    for (let step = 0; step < steps; step++) {
      const start = mob.y;
      const amount = movement / steps;
      if (!this.blocked(mob, mob.x, start + amount, mob.z)) { mob.y += amount; continue; }
      let low = 0, high = 1;
      for (let i = 0; i < 9; i++) {
        const mid = (low + high) / 2;
        if (this.blocked(mob, mob.x, start + amount * mid, mob.z)) high = mid;
        else low = mid;
      }
      mob.y = start + amount * low;
      mob.grounded = movement < 0;
      mob.vy = 0;
      break;
    }
  }

  update(dt, { player, night = false, survival = false, paused = false }) {
    if (paused || !player || !Number.isFinite(dt)) return;
    dt = Math.min(.08, Math.max(0, dt));
    this.clock += dt;
    this.spawnClock -= dt;
    if (!this.initialized) {
      this.initialized = true;
      for (let i = 0; i < 6; i++) {
        const type = ['pig', 'sheep', 'deer'][i % 3];
        if (!this.spawnNear(type, player, i) && type === 'deer') this.spawnNear('sheep', player, i);
      }
    }
    if (this.spawnClock <= 0) {
      this.spawnClock = 5;
      const hostiles = this.mobs.filter(m => m.type === 'hostile').length;
      if (night && survival && hostiles < 5) this.spawnNear('hostile', player);
      const wildlife = this.mobs.length - hostiles;
      if (!night && wildlife < 6 && this.clock > 20) {
        const type = ['pig', 'sheep', 'deer'][this.nextId % 3];
        if (!this.spawnNear(type, player) && type === 'deer') this.spawnNear('pig', player);
      }
    }
    for (const mob of [...this.mobs]) {
      const hostile = mob.type === 'hostile';
      const distance = Math.hypot(player.x - mob.x, player.z - mob.z);
      if (distance > 85 || mob.y < -5 || (hostile && !survival)) { this.remove(mob); continue; }
      mob.attackCooldown -= dt;
      mob.hurt = Math.max(0, mob.hurt - dt);
      mob.panic = Math.max(0, mob.panic - dt);
      mob.decision -= dt;
      if (hostile && !night) {
        mob.burnClock += dt;
        if (mob.burnClock > .75) {
          mob.burnClock = 0;
          mob.health -= 3;
          mob.hurt = .2;
          if (mob.health <= 0) { this.remove(mob); continue; }
        }
      }
      let speed = 0;
      if (hostile && survival && distance < 30) {
        mob.direction = Math.atan2(player.x - mob.x, player.z - mob.z);
        speed = distance > 1.05 ? mob.definition.speed : 0;
        if (distance < 1.4 && Math.abs(player.y - mob.y) < 1.8 && mob.attackCooldown <= 0) {
          const origin = new THREE.Vector3(mob.x, mob.y + 1.35, mob.z);
          const direction = new THREE.Vector3(player.x, player.y + 1, player.z).sub(origin);
          const rayLength = direction.length();
          direction.normalize();
          const obstruction = worldRaycast(this.world, origin, direction, rayLength);
          if (!obstruction) { this.onDamage(3, 'un rôdeur'); mob.attackCooldown = 1.2; }
        }
      } else if (mob.type === 'deer' && distance < 9 && Math.abs(player.y - mob.y) < 4) {
        mob.direction = Math.atan2(mob.x - player.x, mob.z - player.z);
        mob.panic = .8;mob.decision = 1.5;mob.walkTime = 2.5;speed = 3.5;
      } else {
        if (mob.decision <= 0) {
          mob.direction += (this.random(mob, 36) - .5) * 2.8;
          mob.decision = 2 + this.random(mob, 123) * 4;
          mob.walkTime = this.random(mob, 568) > .25 ? mob.decision * .7 : 0;
        }
        mob.walkTime -= dt;
        speed = mob.walkTime > 0 ? mob.definition.speed : 0;
      }
      if (mob.panic > 0) speed = mob.type === 'deer' ? 3.5 : 2.5;
      const moved = this.moveHorizontal(mob, (Math.sin(mob.direction) * speed + mob.knockX) * dt, (Math.cos(mob.direction) * speed + mob.knockZ) * dt);
      if (speed && !moved) { mob.direction += 1.8; mob.decision = .3; }
      mob.knockX *= Math.exp(-9 * dt);
      mob.knockZ *= Math.exp(-9 * dt);
      this.fall(mob, dt);
      mob.group.position.set(mob.x, mob.y, mob.z);
      let rotation = mob.direction - mob.group.rotation.y;
      rotation = Math.atan2(Math.sin(rotation), Math.cos(rotation));
      mob.group.rotation.y += rotation * Math.min(1, dt * 8);
      const swing = moved ? Math.sin(this.clock * (speed > 1.5 ? 11 : 7) + mob.id) * .5 : 0;
      mob.limbs.forEach((limb, i) => {
        const stride = mob.type === 'deer' ? ([1, -1, -1, 1][i] || 1) : (i % 2 ? 1 : -1);
        limb.rotation.x = (hostile && i >= 2 ? -1.1 : 0) + swing * stride;
      });
      if (mob.head) {
        const alert = mob.panic > 0 || distance < 12;
        mob.head.rotation.x = alert ? -.08 : !moved ? .35 + Math.sin(this.clock * .7 + mob.id) * .2 : .04 + Math.sin(this.clock * 7) * .04;
        mob.head.rotation.y = Math.sin(this.clock * .8 + mob.id) * (alert ? .07 : .17);
      }
      mob.group.traverse(object => {
        if (object.isMesh) object.material = mob.hurt > 0 ? this.materials.hurt : object.userData.baseMaterial;
      });
    }
  }

  raycast(origin, direction, reach = 4.5) {
    this.ray.set(origin, direction.clone().normalize());
    let target = null;
    for (const mob of this.mobs) {
      mob.group.updateMatrixWorld(true);
      this.inverse.copy(mob.group.matrixWorld).invert();
      this.localRay.copy(this.ray).applyMatrix4(this.inverse);
      if (!this.localRay.intersectBox(mob.bounds, this.intersection)) continue;
      this.intersection.applyMatrix4(mob.group.matrixWorld);
      const distance = this.intersection.distanceTo(origin);
      if (distance <= reach && (!target || distance < target.distance)) target = { id: mob.id, distance, name: mob.definition.name };
    }
    return target;
  }

  attack(id, damage = 1, knockbackDirection) {
    const mob = this.mobs.find(m => m.id === id);
    if (!mob || !Number.isFinite(damage) || damage <= 0) return { hit: false, dead: false, name: '' };
    mob.health -= damage;
    mob.hurt = .18;
    mob.panic = mob.type === 'hostile' ? 0 : 2.5;
    if (knockbackDirection && Number.isFinite(knockbackDirection.x) && Number.isFinite(knockbackDirection.z)) {
      const length = Math.hypot(knockbackDirection.x, knockbackDirection.z) || 1;
      mob.knockX = knockbackDirection.x / length * 5;
      mob.knockZ = knockbackDirection.z / length * 5;
      mob.direction = Math.atan2(mob.knockX, mob.knockZ);
    }
    const result = { hit: true, dead: mob.health <= 0, name: mob.definition.name };
    if (result.dead) {
      const position = { x: mob.x, y: mob.y + .4, z: mob.z };
      if (mob.definition.loot) this.onLoot(mob.definition.loot, mob.definition.count, position);
      this.onLoot(0, mob.type === 'hostile' ? 5 : 2, position);
      this.remove(mob);
    }
    return result;
  }

  remove(mob) {
    this.scene.remove(mob.group);
    const index = this.mobs.indexOf(mob);
    if (index >= 0) this.mobs.splice(index, 1);
  }

  serialize() {
    return this.mobs.map(m => ({ type: m.type, x: m.x, y: m.y, z: m.z, health: m.health }));
  }

  restore(snapshots) {
    if (!Array.isArray(snapshots)) return;
    this.clear();
    for (const snapshot of snapshots.slice(0, 12)) {
      if (!snapshot || !TYPES[snapshot.type] || ![snapshot.x, snapshot.y, snapshot.z, snapshot.health].every(Number.isFinite)) continue;
      if (Math.abs(snapshot.x) > 100000 || Math.abs(snapshot.z) > 100000 || snapshot.y < 0 || snapshot.y >= HEIGHT || snapshot.health <= 0) continue;
      const sample = { definition: TYPES[snapshot.type] };
      if (!this.blocked(sample, snapshot.x, snapshot.y, snapshot.z, true)) this.create(snapshot.type, snapshot.x, snapshot.y, snapshot.z, snapshot.health);
    }
    this.initialized = true;
  }

  dispose() {
    this.clear();
    this.boxGeometry.dispose();
    this.roundGeometry.dispose();
    this.woolGeometry.dispose();
    for (const material of Object.values(this.materials)) material.dispose();
  }
}
