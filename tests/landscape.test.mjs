import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { Landscape } from '../dist/landscape.js';

class FlatWorld {
  constructor(seedId=4137){this.seedId=seedId;this.revision=0;this.edits=new Map();this.changed=new Map();}
  height(){return 20;}
  biome(){return {id:'forest'};}
  get(x,y,z){const k=[Math.floor(x),Math.floor(y),Math.floor(z)].join(',');return this.changed.get(k)??(Math.floor(y)===20?1:Math.floor(y)<20?3:0);}
  edit(x,y,z,id){this.changed.set([x,y,z].join(','),id);this.revision++;}
}
function fixture(){const world=new FlatWorld(),scene=new THREE.Scene(),landscape=new Landscape({scene,world});return {world,scene,landscape};}
function prepare(landscape){for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++)landscape.buildChunk(x,z);return [...landscape.collectables.values()].find(c=>c.type==='berries');}

test('landscape generates deterministic sites and harvestable scenery without modifying terrain',()=>{
  const a=fixture(),b=fixture();
  const first=prepare(a.landscape),second=prepare(b.landscape);
  assert.ok(first);assert.equal(first.id,second.id);
  assert.deepEqual(a.landscape.getNearbySites({x:8,y:22,z:8}),b.landscape.getNearbySites({x:8,y:22,z:8}));
  assert.ok(a.landscape.getNearbySites({x:8,y:22,z:8}).length>0);
  assert.equal(a.world.revision,0);assert.equal(a.world.changed.size,0);
  assert.ok([...a.landscape.chunks.values()].some(g=>g.children.some(c=>c.isInstancedMesh)));
  a.landscape.dispose();b.landscape.dispose();assert.equal(a.scene.children.length,0);
});

test('harvesting is once-only and saved resources do not reappear after reload',()=>{
  const a=fixture(),item=prepare(a.landscape),result=a.landscape.harvest(item.id);
  assert.deepEqual(result.items,[[145,3]]);assert.equal(a.landscape.harvest(item.id),null);
  const saved=JSON.parse(JSON.stringify(a.landscape.serialize())),b=fixture();b.landscape.restore(saved);prepare(b.landscape);
  assert.equal(b.landscape.collectables.has(item.id),false);assert.equal(b.landscape.harvest(item.id),null);
  b.landscape.setWorld(new FlatWorld(22));assert.deepEqual(b.landscape.serialize().harvested,[]);
  a.landscape.dispose();b.landscape.dispose();
});

test('collectable raycasts respect reach and cannot pass through walls',()=>{
  const {landscape,world}=fixture(),item=prepare(landscape),origin=item.position.clone().add(new THREE.Vector3(0,1,3));
  const dir=item.position.clone().sub(origin).normalize();
  assert.equal(landscape.raycast(origin,dir,5)?.id,item.id);
  assert.equal(landscape.raycast(origin,dir,1),null);
  const x=Math.floor(item.position.x),z=Math.floor(item.position.z)+1;
  for(let y=21;y<=23;y++)world.edit(x,y,z,3);
  assert.equal(landscape.raycast(origin,dir,5),null);
  landscape.dispose();
});

test('removing the soil immediately invalidates harvest, even before scenery rebuild',()=>{
  const {landscape,world}=fixture(),item=prepare(landscape);
  world.edit(Math.floor(item.position.x),item.groundY,Math.floor(item.position.z),0);
  assert.equal(landscape.harvest(item.id),null);
  landscape.buildChunk(...item.chunkKey.split(',').map(Number));assert.equal(landscape.collectables.has(item.id),false);
  landscape.dispose();
});

test('streaming stays bounded and releases scenery from departed chunks',()=>{
  const {landscape}=fixture();
  for(let i=0;i<30;i++)landscape.update(.016,{position:{x:8,y:21,z:8},quality:1});
  assert.equal(landscape.chunks.size,25);
  const before=new Set(landscape.collectables.keys());
  for(let i=0;i<30;i++)landscape.update(.016,{position:{x:400,y:21,z:400},quality:0});
  assert.equal(landscape.chunks.size,9);assert.equal([...landscape.collectables.keys()].some(id=>before.has(id)),false);
  landscape.dispose();
});

test('invalid saved ids are ignored and malformed positions produce no interactions',()=>{
  const {landscape}=fixture();landscape.restore({harvested:['berry:1:-2','cache:site:0:0',null,3,'other:bad']});
  assert.deepEqual(landscape.serialize().harvested,['berry:1:-2','cache:site:0:0']);
  assert.deepEqual(landscape.getNearbySites({x:NaN,y:1,z:1}),[]);
  assert.equal(landscape.raycast({x:0,y:21,z:0},{x:0,y:0,z:0}),null);
  landscape.dispose();
});
