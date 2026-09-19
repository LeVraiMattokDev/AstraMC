import test from 'node:test';
import assert from 'node:assert/strict';
import { World, SIZE, HEIGHT, raycast, moveBody, collides, overlapsBlock } from '../dist/world.js';

const sparse = blocks => ({ get(x,y,z) { return blocks.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ?? 0; } });
const close = (a,b,tolerance=.001) => assert.ok(Math.abs(a-b)<tolerance, `${a} differs from ${b}`);

test('generation is deterministic regardless of chunk request order', () => {
  const a=new World('testing'),b=new World('testing');
  const coords=[[0,0],[-1,0],[0,-1],[-3,4],[3,-2]];
  coords.forEach(([x,z])=>a.chunk(x,z));
  [...coords].reverse().forEach(([x,z])=>b.chunk(x,z));
  for(const [x,z] of coords) assert.deepEqual(a.chunk(x,z),b.chunk(x,z));
});

test('set/get preserve independently edited voxels around negative chunk boundaries', () => {
  const w=new World('boundary');
  for(const x of [-17,-16,-1,0,15,16])for(const z of [-17,-16,-1,0,15,16]){
    assert.equal(w.set(x,50,z,8),true);
    assert.equal(w.get(x,50,z),8);
    assert.equal(w.get(x,49,z),0);
  }
  assert.equal(w.edits.size,16);
});

test('air and added blocks survive save, restore, eviction, and regeneration', () => {
  const a=new World('roundtrip');
  assert.equal(a.set(-16,2,-1,0),true);
  assert.equal(a.set(15,50,16,10),true);
  const b=new World(a.seed);
  b.restore(JSON.parse(JSON.stringify(a.serialize())));
  for(let i=0;i<2;i++){
    assert.equal(b.get(-16,2,-1),0);
    assert.equal(b.get(15,50,16),10);
    b.chunks.clear();
  }
});

test('bedrock and world height stay immutable via editing', () => {
  const w=new World();
  assert.equal(w.set(0,0,0,0),false);
  assert.equal(w.set(0,HEIGHT,0,1),false);
  assert.equal(w.set(0,5,0,24),false);
  assert.equal(w.get(0,0,0),24);
  assert.equal(w.get(0,-1,0),24);
  assert.equal(w.get(0,HEIGHT,0),0);
});

test('invalid restore is atomic and cannot replace previous edits', () => {
  const w=new World();w.set(0,50,0,8);
  assert.throws(()=>w.restore([['0,0',[[50*SIZE*SIZE,9],[0,0]]]]));
  assert.equal(w.get(0,50,0),8);
  w.chunks.clear();assert.equal(w.get(0,50,0),8);
});

test('raycast finds all six directions with outward placement normal', () => {
  const center={x:-.5,y:10.5,z:-.5};
  for(const axis of ['x','y','z'])for(const sign of [-1,1]){
    const cell={x:-1,y:10,z:-1};cell[axis]+=sign*3;
    const dir={x:0,y:0,z:0};dir[axis]=sign;
    const w=sparse(new Map([[`${cell.x},${cell.y},${cell.z}`,3]]));
    const hit=raycast(w,center,dir,3);
    assert.ok(hit);assert.deepEqual({x:hit.x,y:hit.y,z:hit.z},cell);
    assert.equal(hit.normal[axis],-sign);close(hit.distance,2.5);
    assert.equal(raycast(w,center,dir,2),null);
  }
});

test('raycast skips water and remains finite with zero direction components', () => {
  const w=sparse(new Map([['1,2,0',7],['2,2,0',3]]));
  const hit=raycast(w,{x:.5,y:2.5,z:.5},{x:1,y:0,z:0},7);
  assert.equal(hit.x,2);assert.equal(hit.id,3);
  assert.equal(raycast(w,{x:.5,y:2.5,z:.5},{x:0,y:0,z:0}),null);
});

test('fast fall lands on floor without tunneling', () => {
  const w={get:(x,y,z)=>y===0?3:0},p={x:.5,y:20,z:.5};
  const hit=moveBody(w,p,{x:0,y:-30,z:0});
  assert.equal(hit.y,true);close(p.y,1);assert.equal(collides(w,p),false);
});

test('fast horizontal motion stops at wall while preserving sliding', () => {
  const w={get:(x,y,z)=>x===2?3:0},p={x:.5,y:1,z:.5};
  const hit=moveBody(w,p,{x:20,y:0,z:3});
  assert.equal(hit.x,true);assert.equal(hit.z,false);
  close(p.x,1.7);close(p.z,3.5);assert.equal(collides(w,p),false);
});

test('head collision stops upward motion at ceiling', () => {
  const w={get:(x,y,z)=>y===4?3:0},p={x:.5,y:1,z:.5};
  const hit=moveBody(w,p,{x:0,y:10,z:0});
  assert.equal(hit.y,true);close(p.y,2.2);assert.equal(collides(w,p),false);
});

test('simultaneous floor and corner collisions leave player outside solids', () => {
  const w={get:(x,y,z)=>y===0||x===2||z===2?3:0},p={x:.5,y:1.2,z:.5};
  const hit=moveBody(w,p,{x:8,y:-4,z:8});
  assert.deepEqual(hit,{x:true,y:true,z:true});
  close(p.x,1.7);close(p.z,1.7);close(p.y,1);assert.equal(collides(w,p),false);
});

test('placement overlap rejects player volume but permits flush neighboring block', () => {
  const p={x:.5,y:1,z:.5};
  assert.equal(overlapsBlock(p,0,1,0),true);
  assert.equal(overlapsBlock(p,0,2,0),true);
  assert.equal(overlapsBlock(p,0,0,0),false);
  assert.equal(overlapsBlock(p,1,1,0),false);
});


test('water can be selected for removal without blocking underwater placement rays', () => {
  const w=sparse(new Map([['1,2,0',7],['2,2,0',3]]));
  const origin={x:.5,y:2.5,z:.5},dir={x:1,y:0,z:0};
  const hit=raycast(w,origin,dir,7,true);
  assert.equal(hit.id,7);assert.equal(hit.x,1);assert.equal(hit.normal.x,-1);
  assert.equal(raycast(w,origin,dir,7,false).id,3);
});
