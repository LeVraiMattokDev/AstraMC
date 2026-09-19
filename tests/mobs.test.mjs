import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { MobSystem } from '../dist/mobs.js';

class FlatWorld {
  constructor(biome='forest'){this.seedId=4137;this.biomeId=biome;}
  get(x,y,z){return Math.floor(y)===20?1:Math.floor(y)<20?3:0;}
  biome(){return {id:this.biomeId};}
}
function fixture(biome='forest'){
  const scene=new THREE.Scene(),world=new FlatWorld(biome),loot=[],damage=[];
  const mobs=new MobSystem({scene,world,onLoot:(...args)=>loot.push(args),onDamage:(...args)=>damage.push(args)});
  mobs.initialized=true;mobs.spawnClock=100;
  return {scene,world,mobs,loot,damage};
}

test('deer flee nearby players, animate, and never deal proximity damage',()=>{
  const {mobs,damage}=fixture(),deer=mobs.create('deer',4,21.001,4),player={x:1,y:21,z:1};
  const start=Math.hypot(deer.x-player.x,deer.z-player.z);
  for(let i=0;i<25;i++)mobs.update(.05,{player,survival:true});
  assert.ok(Math.hypot(deer.x-player.x,deer.z-player.z)>start+2);
  assert.ok(deer.head);assert.equal(deer.limbs.length,4);assert.ok(deer.limbs.some(leg=>Math.abs(leg.rotation.x)>.1));
  assert.deepEqual(damage,[]);assert.ok(deer.health>0);mobs.dispose();
});

test('deer naturally spawn in plains and forest but not desert or snow',()=>{
  for(const biome of ['forest','plains','desert','snow']){
    const {mobs}=fixture(biome),deer=mobs.spawnNear('deer',{x:0,y:21,z:0});
    assert.equal(Boolean(deer),['forest','plains'].includes(biome));mobs.dispose();
  }
});

test('save restoration preserves deer and all legacy types within population limits',()=>{
  const a=fixture();
  ['deer','pig','sheep','hostile'].forEach((type,i)=>a.mobs.create(type,i*4+.5,21.001,.5,i+3));
  const saved=JSON.parse(JSON.stringify(a.mobs.serialize())),b=fixture();b.mobs.restore(saved);
  assert.deepEqual(b.mobs.serialize(),saved);assert.equal(b.mobs.mobs[0].type,'deer');
  b.mobs.restore(Array.from({length:30},(_,i)=>({...saved[0],x:i*3})));
  assert.equal(b.mobs.mobs.length,12);assert.equal(b.mobs.create('deer',90,21,0),null);
  a.mobs.dispose();b.mobs.dispose();
});

test('deer drop raw meat and experience on death, and inherited combat remains available',()=>{
  const {mobs,loot}=fixture(),deer=mobs.create('deer',0,21.001,0);
  const result=mobs.attack(deer.id,20,new THREE.Vector3(1,0,0));
  assert.deepEqual(result,{hit:true,dead:true,name:'Cerf'});assert.equal(mobs.mobs.length,0);
  assert.deepEqual(loot.map(([id,count])=>[id,count]),[[106,3],[0,2]]);
  assert.equal(mobs.attack(deer.id,1).hit,false);mobs.dispose();
});

test('shared animal geometries and PBR materials are disposed once',()=>{
  const {mobs,scene}=fixture();mobs.create('deer',0,21.001,0);mobs.create('pig',3,21.001,0);mobs.create('sheep',6,21.001,0);
  assert.ok(Object.values(mobs.materials).every(m=>m.isMeshStandardMaterial&&m.roughness===.85));
  let disposed=0;for(const geometry of [mobs.boxGeometry,mobs.roundGeometry,mobs.woolGeometry])geometry.addEventListener('dispose',()=>disposed++);
  mobs.dispose();assert.equal(disposed,3);assert.equal(scene.children.length,0);
});
