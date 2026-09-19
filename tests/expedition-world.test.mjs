import test from 'node:test';
import assert from 'node:assert/strict';
import {World,solid,blockHeight,collides} from '../dist/world.js';
import {Navigation} from '../dist/navigation.js';

test('camp furnishings survive saves with their actual collision height',()=>{
  const world=new World('camp');
  for(let y=35;y<40;y++)for(let x=0;x<4;x++)world.set(x,y,0,0);
  world.set(0,35,0,29);world.set(1,35,0,30);world.set(2,35,0,31);
  assert.equal(solid(29),false);assert.equal(solid(31),false);assert.equal(blockHeight(30),.65);
  assert.equal(collides(world,{x:1.5,y:35.66,z:.5}),false);
  assert.equal(collides(world,{x:1.5,y:35.4,z:.5}),true);
  const restored=new World('camp');restored.restore(world.serialize());
  assert.deepEqual([0,1,2].map(x=>restored.get(x,35,0)),[29,30,31]);
});

test('navigation keeps discoveries, negative coordinates and waypoints after reload',()=>{
  const world=new World('Rivage'),nav=new Navigation(world),point={x:-20,y:17,z:-40};
  const sites=[{id:'test-ruin',name:'Ruine',type:'ruins',x:-21,y:17,z:-38}];
  assert.equal(nav.visit(point,sites).length,1);assert.equal(nav.visit(point,sites).length,0);
  nav.waypoint={x:-28,z:7};const restored=new Navigation(world,nav.serialize());
  assert.equal(restored.discovered.size,1);assert.deepEqual(restored.waypoint,{x:-28,z:7});
  assert.equal(restored.visited.has('-2,-3'),true);
});

test('map clicks use the drawn map scale rather than the minimap scale',()=>{
  const nav=new Navigation(new World('Rivage'));
  nav.lastMap={position:{x:-10,z:12},w:480,h:420,scale:1.5};
  assert.deepEqual(nav.setWaypointFromMap(270,195),{x:10,z:2});
});
