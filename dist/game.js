import * as THREE from './vendor/three.module.js';
import {World, BLOCKS, PALETTE, DEFAULT_HOTBAR, SIZE, HEIGHT, SEA, hash, solid, raycast, moveBody, collides, overlapsBlock, blockHeight} from './world.js';

import {Survival, ITEMS, ITEM_IDS as I, RECIPES, attackDamage} from './survival.js';
import {MobSystem} from './mobs.js';
import {advanceDrop,canReachDrop} from './item-physics.js';
import {Atmosphere} from './atmosphere.js';
import {NaturalTrees} from './natural-trees.js';
import {Landscape} from './landscape.js';
import {Expedition} from './expedition.js';
import {Ambience} from './ambience.js';
import {Navigation} from './navigation.js';
import {createTerrainMaterials,buildUtility} from './render-materials.js';

const $=id=>document.getElementById(id);
const canvas=$('world'), touch=matchMedia('(pointer: coarse)').matches;
const SAVE_KEY='astramc.world.v1';
let renderer;
try { renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'}); }
catch(error){$('loading').hidden=true;$('error-screen').hidden=false;$('error-message').textContent='Activez l’accélération graphique de votre navigateur, puis rechargez la page. WebGL 2 est nécessaire.';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.setSize(innerWidth,innerHeight);
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.setClearColor(0xa8cad9);
const scene=new THREE.Scene();
scene.background=new THREE.Color('#adcddd');scene.fog=new THREE.Fog('#adcddd',45,98);
const camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.06,220);
camera.rotation.order='YXZ';
const hemi=new THREE.HemisphereLight(0xe4f0ff,0x71834b,2.3);scene.add(hemi);
const sunlight=new THREE.DirectionalLight(0xffe2ad,2.4);sunlight.position.set(-50,90,30);scene.add(sunlight);
const terrain=new THREE.Group();scene.add(terrain);

function atlasTexture(){
  const el=document.createElement('canvas');el.width=128;el.height=128;const c=el.getContext('2d');
  const colors=['#8b6748','#607d43','#8b6748','#949b9b','#dfce96','#7c5939','#b99057','#4d863d','#4899b8','#bd915b','#b06953','#b1e0e2','#818984','#e5eded','#e8e7dd','#b64740','#45649f','#e1b440','#8d9291','#8d9291','#8d9291','#3a314d','#d4bc82','#628f3f','#9060ac','#484951','#987047','#b38752','#9f7647','#777d7c','#777d7c','#666c6b','#dfad53','#a95343','#b84b42'];
  for(let t=0;t<colors.length;t++){
    const ox=(t%8)*16,oy=Math.floor(t/8)*16;
    const base=new THREE.Color(colors[t]);
    for(let y=0;y<16;y++)for(let x=0;x<16;x++){
      let col=base.clone(),k=.88+hash(x+t*17,y+t*29,813)*.23,alpha=1;
      if(t===0&&y<4+Math.floor(hash(x,0)*3))col.set('#58723c');
      if(t===13)k=.96+hash(x,y,13)*.04;
      if(t===5){k=.75+hash(Math.floor(x/2),0,4)*.38;if((x+y%4)%7===0)k*=.65;}
      if(t===6){const r=Math.max(Math.abs(x-7.5),Math.abs(y-7.5));k=Math.floor(r)%3===0?.66:1.05;}
      if(t===7){k=.62+hash(x,y,123)*.7;if((x+y)%7===0)k*=.7;}
      if(t===8){alpha=.63;k=.88+hash(Math.floor(x/3),Math.floor(y/2),1)*.18;}
      if(t===9){if(y%5===0)k=.65;else if((x+(Math.floor(y/5)%2)*7)%15===0)k=.8;else k=.9+hash(x,Math.floor(y/2),6)*.15;}
      if(t===10){if(y%5===0||(x+(Math.floor(y/5)%2)*4)%8===0){col.set('#cebb9c');k=.95;}}
      if(t===11){alpha=x===0||y===0||x===15||y===15?.78:.16;k=1;if(Math.abs(x+y-10)<2){alpha=.5;col.set('#e8ffff');}}
      if(t===12&&((x+Math.floor(y/5)*3)%7===0||y%6===0))k=.55;
      if(t>=18&&t<=20&&hash(Math.floor(x/2),Math.floor(y/2),t)>.72){col.set(t===18?'#333737':t===19?'#d6b39a':'#64e0d3');k=.8+hash(x,y)*.3;}
      if(t===21&&hash(x,y,72)>.8){col.set('#615080');}
      if(t===22&&y%6===0)k=.75;
      if(t===26||t===28){if(x<2||x>13||y<2)k=.6;if(t===28&&x>5&&x<10&&y>5&&y<12)col.set('#47443d');}
      if(t===27){if(x%5===0||y%5===0){col.set('#513822');k=.8;}}
      if(t===29||t===30){if(y%7===0||x%7===0)k=.65;}
      if(t===31&&x>2&&x<13&&y>6&&y<14){col.set('#22272a');if(y===12)col.set('#af6133');}
      if(t===32)col.set(y<6?'#ffdf65':'#aa783b');
      if(t===33&&y>10)col.set('#815836');
      if(t===34&&y<5)col.set('#edeadf');
      col.multiplyScalar(k);c.globalAlpha=alpha;c.fillStyle=col.getStyle();c.fillRect(ox+x,oy+y,1,1);
    }
  }
  const texture=new THREE.CanvasTexture(el);texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.colorSpace=THREE.SRGBColorSpace;
  return {texture,canvas:el};
}
const atlas=atlasTexture();
const terrainStyle=createTerrainMaterials(atlas.texture),materials=terrainStyle.materials,naturalTrees=new NaturalTrees();
const FACES=[
  {n:[1,0,0],v:[[1,0,0],[1,1,0],[1,1,1],[1,0,1]],shade:.82},
  {n:[-1,0,0],v:[[0,0,1],[0,1,1],[0,1,0],[0,0,0]],shade:.68},
  {n:[0,1,0],v:[[0,1,1],[1,1,1],[1,1,0],[0,1,0]],shade:1},
  {n:[0,-1,0],v:[[0,0,0],[1,0,0],[1,0,1],[0,0,1]],shade:.48},
  {n:[0,0,1],v:[[1,0,1],[1,1,1],[0,1,1],[0,0,1]],shade:.85},
  {n:[0,0,-1],v:[[0,0,0],[0,1,0],[1,1,0],[1,0,0]],shade:.74}
];
const chunkMeshes=new Map(),chunkQueue=[];
function disposeChunk(key){const group=chunkMeshes.get(key);if(group){group.traverse(mesh=>{if(mesh.isMesh)mesh.geometry.dispose();if(mesh.isInstancedMesh)mesh.dispose();});terrain.remove(group);chunkMeshes.delete(key);}}
const torchWood=new THREE.MeshLambertMaterial({color:0xa77741}),torchFlame=new THREE.MeshBasicMaterial({color:0xffdd6b});
const torchLights=Array.from({length:6},()=>{const light=new THREE.PointLight(0xffb74f,0,15,1.5);scene.add(light);return light;});
function buildChunk(cx,cz){
  const torches=[],utilities=[],leaves=[],logs=[];const key=`${cx},${cz}`,data=world.chunk(cx,cz),buffers=[0,1,2].map(()=>({p:[],n:[],u:[],c:[],i:[],f:[]}));
  for(let y=0;y<HEIGHT;y++)for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++){
    const voxelIndex=(y*SIZE+z)*SIZE+x,id=data[voxelIndex];if(!id)continue;if((id===5||id===6)&&!world.edits.get(key)?.has(voxelIndex)){if(id===5)logs.push([x,y,z]);else if(FACES.some(f=>world.get(cx*SIZE+x+f.n[0],y+f.n[1],cz*SIZE+z+f.n[2])!==6))leaves.push([x,y,z]);continue;}
    if(id===27){torches.push([x,y,z]);continue;}if(id>=29&&id<=31){utilities.push([x,y,z,id]);continue;}
    const block=BLOCKS[id],transparent=!!block.transparent,b=buffers[id===7?2:transparent?1:0];
    const wx=cx*SIZE+x,wz=cz*SIZE+z;
    for(let f=0;f<6;f++){
      const face=FACES[f],n=face.n,neighbor=world.get(wx+n[0],y+n[1],wz+n[2]);
      if(neighbor&&![27,29,30,31].includes(neighbor)&&((!BLOCKS[neighbor].transparent&&(neighbor!==28||f===2||((f===0||f===1||f===4||f===5)&&blockHeight(neighbor)>=blockHeight(id))))||neighbor===id||(id===7&&neighbor===10)))continue;
      const tile=f===2?(block.top??block.tile):f===3?(block.bottom??block.tile):f===4?(block.front??block.tile):block.tile;
      const u=((tile%8)*16+.5)/128,v=1-((Math.floor(tile/8)+1)*16-.5)/128,du=15/128,dv=15/128;
      const offset=b.p.length/3,uvs=[[u,v],[u,v+dv],[u+du,v+dv],[u+du,v]];
      if(f===2||f===3){uvs.splice(0,4,[u,v],[u+du,v],[u+du,v+dv],[u,v+dv]);}
      for(let k=0;k<4;k++){
        const vert=face.v[k];
        b.p.push(x+vert[0],y+vert[1]*blockHeight(id)-(id===7&&vert[1]===1&&world.get(wx,y+1,wz)!==7?.12:0),z+vert[2]);b.n.push(...n);b.u.push(...uvs[k]);
        const tangent=[0,1,2].filter(axis=>!n[axis]),a=tangent[0],c=tangent[1],sideA=[...n],sideB=[...n],corner=[...n];
        sideA[a]+=vert[a]?1:-1;sideB[c]+=vert[c]?1:-1;corner[a]+=vert[a]?1:-1;corner[c]+=vert[c]?1:-1;
        const occludes=q=>{const v=world.get(wx+q[0],y+q[1],wz+q[2]);return solid(v)&&v!==10?1:0;};
        const ao=id===7?0:occludes(sideA)+occludes(sideB)+occludes(corner);
        const shade=(.86+face.shade*.14)*(1-ao*.115)*(.96+hash(wx,wz,9)*.04);b.c.push(shade,shade,shade);b.f.push(id===6?1:0);
      }
      b.i.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
    }
  }
  disposeChunk(key);const group=new THREE.Group();group.position.set(cx*SIZE,0,cz*SIZE);
  buffers.forEach((b,i)=>{if(!b.p.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(b.n,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(b.u,2));g.setAttribute('color',new THREE.Float32BufferAttribute(b.c,3));g.setAttribute('foliage',new THREE.Float32BufferAttribute(b.f,1));g.setIndex(b.i);g.computeBoundingSphere();const mesh=new THREE.Mesh(g,materials[i]);mesh.castShadow=i===0;mesh.receiveShadow=true;group.add(mesh);});
  group.userData.torches=torches.map(([x,y,z])=>[cx*SIZE+x+.5,y+.78,cz*SIZE+z+.5,27]);group.userData.fires=[];for(const [x,y,z,id] of utilities){const object=buildUtility(id);object.position.set(x,y,z);group.add(object);if(id===29||id===31)group.userData.torches.push([cx*SIZE+x+.5,y+.6,cz*SIZE+z+.5,id]);if(id===29)group.userData.fires.push([cx*SIZE+x+.5,y+.5,cz*SIZE+z+.5]);}
  for(const [x,y,z] of torches){const handle=new THREE.Mesh(new THREE.BoxGeometry(.12,.65,.12),torchWood);handle.position.set(x+.5,y+.325,z+.5);group.add(handle);const flame=new THREE.Mesh(new THREE.BoxGeometry(.2,.22,.2),torchFlame);flame.position.set(x+.5,y+.72,z+.5);group.add(flame);}
  group.add(naturalTrees.build(leaves,logs,{cx,cz,seed:world.seedId,biome:world.biome(cx*SIZE+8,cz*SIZE+8)}));chunkMeshes.set(key,group);terrain.add(group);
}
let renderDistance=3,lastCenter='';
function scheduleChunks(force=false){
  const cx=Math.floor(player.x/SIZE),cz=Math.floor(player.z/SIZE),center=`${cx},${cz},${renderDistance}`;
  if(center===lastCenter&&!force)return;lastCenter=center;chunkQueue.length=0;
  for(let dz=-renderDistance;dz<=renderDistance;dz++)for(let dx=-renderDistance;dx<=renderDistance;dx++)if(!chunkMeshes.has(`${cx+dx},${cz+dz}`))chunkQueue.push([cx+dx,cz+dz,dx*dx+dz*dz]);
  chunkQueue.sort((a,b)=>a[2]-b[2]);
  for(const key of chunkMeshes.keys()){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>renderDistance+1||Math.abs(z-cz)>renderDistance+1)disposeChunk(key);}
  for(const key of world.chunks.keys()){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>renderDistance+3||Math.abs(z-cz)>renderDistance+3)world.chunks.delete(key);}
}
function updateBlocks(x,z){const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);const keys=[[cx,cz]];if(x-cx*SIZE===0)keys.push([cx-1,cz]);if(x-cx*SIZE===15)keys.push([cx+1,cz]);if(z-cz*SIZE===0)keys.push([cx,cz-1]);if(z-cz*SIZE===15)keys.push([cx,cz+1]);for(const [a,b] of keys)if(chunkMeshes.has(`${a},${b}`))buildChunk(a,b);}


let world=new World('Rivage',2),survival=new Survival(),mode='start',gameMode='survival',hasPlayed=false;
let grounded=false,flying=false,vy=0,yaw=-.75,pitch=-.08,selected=0,timeOfDay=.17,dayCount=1,storageOK=true,saveTimer;
let creativeBar=[...DEFAULT_HOTBAR],survivalBar=[0,0,0,0,0,0,0,0,I.APPLE],hotbar=survivalBar;
const player={x:8.5,y:35,z:8.5},keys=new Set();
let quality='high',photoMode=false,activeChest=null,landscapeTarget=null,nearFire=false,nearWater=false,submergedNow=false,environment={daylight:1,weather:'clear',temperature:18,wind:.2,precipitation:0,sheltered:false,wetness:0},mapClock=0;
let spawnPoint=null,saved=null,sensitivity=1,soundEnabled=true,dragLook=false,lookTouch=null,target=null,mobTarget=null;
let previousTime=performance.now(),jumpRequest=false,lastJump=0,lastAction=0,heldAction=null,mining=null,autoMine=false;
let toastTimer,damageTimer,fallStart=null,selectedRecipe='planks',inventorySignature='',lastCombat=0,lastUse=0,lightClock=0;
const drops=[],smeltingJobs=[],icons=new Map(),iconTextures=new Map();
const validBar=v=>Array.isArray(v)&&v.length===9&&v.every(id=>Number.isInteger(id)&&id!==24&&!!ITEMS[id]);
try{
  const raw=localStorage.getItem(SAVE_KEY);saved=JSON.parse(raw||'null');
  if(saved&&[1,2,3].includes(saved.version)&&typeof saved.seed==='string'){
    world=new World(saved.seed,saved.version===1?1:saved.generation);world.restore(saved.edits);
    if(saved.player&&['x','y','z'].every(k=>Number.isFinite(saved.player[k])&&Math.abs(saved.player[k])<1e6))Object.assign(player,saved.player);
    if(Number.isFinite(saved.yaw))yaw=saved.yaw;if(Number.isFinite(saved.pitch))pitch=THREE.MathUtils.clamp(saved.pitch,-1.5,1.5);
    if(saved.version===1){gameMode='creative';if(validBar(saved.hotbar))creativeBar=saved.hotbar;try{if(!localStorage.getItem('astramc.legacy-v1'))localStorage.setItem('astramc.legacy-v1',raw);}catch(e){}}
    else{
      if(saved.survival)survival.restore(saved.survival);
      gameMode=saved.gameMode==='creative'?'creative':'survival';
      if(validBar(saved.creativeBar))creativeBar=saved.creativeBar;if(validBar(saved.survivalBar))survivalBar=saved.survivalBar;
      if(saved.spawnPoint&&['x','y','z'].every(k=>Number.isFinite(saved.spawnPoint[k])))spawnPoint=saved.spawnPoint;
      if(Number.isInteger(saved.dayCount)&&saved.dayCount>0)dayCount=saved.dayCount;
    }
    if(Number.isInteger(saved.selected)&&saved.selected>=0&&saved.selected<9)selected=saved.selected;
    if(Number.isFinite(saved.timeOfDay))timeOfDay=((saved.timeOfDay%1)+1)%1;
    flying=gameMode==='creative'&&!!saved.flying;
  }else saved=null;
}catch(error){saved=null;storageOK=false;world=new World('Rivage',2);survival=new Survival();}
hotbar=gameMode==='creative'?creativeBar:survivalBar;
function spawn(useBed=true){
  player.x=useBed&&spawnPoint?spawnPoint.x:8.5;player.z=useBed&&spawnPoint?spawnPoint.z:8.5;
  for(let i=0;i<60&&world.height(player.x,player.z)<=SEA+1;i++)player.x-=2;
  player.y=useBed&&spawnPoint?spawnPoint.y:world.surface(Math.floor(player.x),Math.floor(player.z))+1.01;
  while(collides(world,player)&&player.y<HEIGHT+3)player.y+=.5;
  if(player.y<1||player.y>HEIGHT+3){player.y=world.surface(player.x,player.z)+1.01;}
  vy=0;grounded=false;flying=false;fallStart=null;yaw=-.75;pitch=-.08;
}
if(!saved)spawn(false);else if(player.y<0||player.y>HEIGHT+40||collides(world,player))spawn();
let expedition=new Expedition();try{if(saved?.expedition)expedition.restore(saved.expedition);}catch(e){}
const ambience=new Ambience(),atmosphere=new Atmosphere({scene,renderer,camera,world,hemi,sunlight}),landscape=new Landscape({scene,world}),navigation=new Navigation(world,saved?.navigation);
try{if(saved?.atmosphere)atmosphere.restore(saved.atmosphere);if(saved?.landscape)landscape.restore(saved.landscape);}catch(e){}
if(saved?.settings){quality=['low','medium','high'].includes(saved.settings.quality)?saved.settings.quality:'high';soundEnabled=saved.settings.sound!==false;sensitivity=Number.isFinite(saved.settings.sensitivity)?THREE.MathUtils.clamp(saved.settings.sensitivity,.3,2):1;renderDistance=[2,3,4,5].includes(saved.settings.renderDistance)?saved.settings.renderDistance:3;}

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2800);}
function save(){
  clearTimeout(saveTimer);
  try{
    localStorage.setItem(SAVE_KEY,JSON.stringify({version:3,expedition:expedition.serialize(),atmosphere:atmosphere.serialize(),landscape:landscape.serialize(),navigation:navigation.serialize(),settings:{quality,sound:soundEnabled,sensitivity,renderDistance,volume:ambience.volume,fov:Number($('field-of-view').value)},generation:world.generation,seed:world.seed,edits:world.serialize(),player:{...player},yaw,pitch,selected,creativeBar,survivalBar,gameMode,survival:survival.serialize(),flying,timeOfDay,dayCount,spawnPoint,mobs:mobs.serialize(),drops:drops.map(d=>({id:d.id,count:d.count,durability:d.durability,x:d.sprite.position.x,y:d.sprite.position.y,z:d.sprite.position.z,age:d.age})),smeltingJobs}));
    storageOK=true;$('save-status').textContent='Monde et inventaire enregistrés';$('save-hint').textContent='Sauvegarde locale automatique';return true;
  }catch(e){storageOK=false;$('save-status').textContent='Sauvegarde indisponible : stockage plein ou bloqué';toast('Le navigateur ne peut pas enregistrer la partie.');return false;}
}
function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(save,650);}

function itemIcon(id){
  if(icons.has(id))return icons.get(id);
  const el=document.createElement('canvas');el.width=48;el.height=52;const ctx=el.getContext('2d');ctx.imageSmoothingEnabled=false;
  if(BLOCKS[id]&&id!==0&&![27,29,31].includes(id)){
    const b=BLOCKS[id];
    function face(tile,points,shade){ctx.save();ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.clip();const a=points[0],b=points[1],d=points[3];ctx.setTransform((b[0]-a[0])/16,(b[1]-a[1])/16,(d[0]-a[0])/16,(d[1]-a[1])/16,a[0],a[1]);ctx.drawImage(atlas.canvas,(tile%8)*16,Math.floor(tile/8)*16,16,16,0,0,16,16);ctx.fillStyle=`rgba(0,0,0,${shade})`;ctx.fillRect(0,0,16,16);ctx.restore();}
    face(b.tile,[[3,16],[24,27],[24,49],[3,38]],.14);face(b.front??b.tile,[[24,27],[45,16],[45,38],[24,49]],.28);face(b.top??b.tile,[[24,5],[45,16],[24,27],[3,16]],0);
  }else{
    ctx.scale(3,3);const b=ITEMS[id]||ITEMS[0];
    const px=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    if(id===140){px(5,2,6,3,'#665844');px(3,5,10,10,'#517f85');px(4,5,3,8,'#a3c9c4');px(5,1,6,1,'#d2c398');}
    else if(id===144){px(3,4,10,9,'#eee9d9');px(5,3,2,11,'#c9c4ad');px(8,6,2,5,'#bc6050');px(6,8,6,2,'#bc6050');}
    else if(id===145){px(7,2,2,7,'#678847');for(const [x,y] of [[3,5],[8,4],[5,9],[9,9]]){px(x,y,4,4,'#9d3654');px(x,y,2,1,'#ef9baa');}}
    else if(id===146){px(6,7,4,8,'#d4c2a1');px(2,5,12,4,'#966440');px(4,3,8,4,'#bd9365');}
    else if(id===142||id===143){px(3,5,10,6,b.color);px(12,4,3,8,b.color);px(3,6,1,1,'#203c3a');px(4,7,5,1,'#d4e8d2');}
    else if(id===29){px(2,12,12,3,'#6e6250');px(4,10,8,3,'#a36c39');px(5,5,7,7,'#e78529');px(7,2,3,9,'#ffd17a');}
    else if(id===31){px(4,3,8,2,'#4c5450');px(5,5,6,8,'#ffe2a2');px(4,13,8,2,'#4c5450');px(3,4,1,10,'#8e927a');px(12,4,1,10,'#8e927a');}
    else if(id===141){for(let n=0;n<13;n++)px(2+n,15-n,1,2,'#c29a6e');px(13,3,1,11,'#d8dfd0');px(11,13,3,1,'#ccd6ca');}
    else if(b.kind==='tool'){
      for(let n=0;n<8;n++){px(3+n,13-n,2,2,'#503b25');px(3+n,13-n,1,1,'#b98b52');}
      if(b.toolType==='pickaxe'){px(5,2,8,2,'#26332f');px(5,3,8,2,b.color);px(12,4,2,4,b.color);px(7,2,4,1,'#dde4ce');}
      else if(b.toolType==='axe'){px(7,2,6,6,'#26332f');px(7,2,5,5,b.color);px(6,3,2,3,b.color);px(7,2,4,1,'#e3e2c5');}
      else{for(let n=0;n<8;n++){px(6+n,9-n,3,3,'#32493f');px(6+n,8-n,2,2,b.color);}px(4,9,5,2,'#b49750');px(7,11,2,2,'#b49750');}
    }else if(id===27){px(6,5,3,10,'#6f4825');px(7,4,1,10,'#c29558');px(5,2,5,5,'#e98b30');px(6,1,3,5,'#ffcf4a');px(7,2,1,3,'#fff1ac');}
    else if(id===0){px(5,7,7,8,'#b87f5d');px(4,6,7,8,'#e5b68d');px(6,4,5,4,'#e5b68d');}
    else if(id===I.STICK){for(let n=0;n<10;n++)px(3+n,13-n,2,2,n%2?'#b98b57':'#9b6e40');}
    else if(id===I.APPLE){px(7,1,2,3,'#6b4b2e');px(9,2,3,2,'#668f43');px(4,5,8,9,'#bb3c35');px(2,6,12,6,'#df5142');px(4,5,3,3,'#f68966');px(5,14,5,1,'#9d302e');}
    else if(id===I.RAW_MEAT||id===I.COOKED_MEAT){px(4,4,8,9,'#623d30');px(2,6,12,5,'#623d30');px(3,6,10,5,b.color);px(5,4,6,9,b.color);px(8,6,3,3,'#e1bba0');}
    else if(id===I.IRON_INGOT){px(3,5,10,7,'#74848e');px(2,7,12,5,'#cad5d9');px(4,5,8,3,'#eff0e6');}
    else{px(5,3,6,11,b.color);px(3,5,10,7,b.color);px(6,4,3,3,id===I.DIAMOND?'#d1ffed':id===I.COAL?'#59626a':'#e5c3a3');px(6,13,4,1,'#425254');}
  }
  const url=el.toDataURL();icons.set(id,url);return url;
}
function iconImage(id,className='block-icon'){const img=document.createElement('img');img.src=itemIcon(id);img.alt='';img.className=className;return img;}
function heldId(){const id=hotbar[selected]||0;return gameMode==='survival'&&survival.count(id)===0?0:id;}
function durabilityElement(id){const max=ITEMS[id]?.durability;if(!max||gameMode!=='survival')return null;const d=document.createElement('div');d.className='durability';const fill=document.createElement('i');fill.style.width=`${100*(survival.durability[id]||0)/max}%`;if((survival.durability[id]||0)<max*.2)fill.style.background='#e98150';d.append(fill);return d;}
function equip(id){if(!ITEMS[id]||id===24||gameMode==='survival'&&id!==0&&!survival.count(id))return false;hotbar[selected]=id;renderHotbar();renderInventory();queueSave();return true;}
function autoEquip(id){if(hotbar.includes(id))return;const index=hotbar.findIndex(i=>i===0||gameMode==='survival'&&!survival.count(i));if(index>=0)hotbar[index]=id;}
function renderHotbar(){
  $('hotbar').replaceChildren();hotbar.forEach((id,index)=>{const button=document.createElement('button');button.className='slot'+(index===selected?' active':'')+(id&&gameMode==='survival'&&!survival.count(id)?' depleted':'');button.title=`${index+1} · ${ITEMS[id].name}`;button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(index===selected));const key=document.createElement('span');key.className='slot-number';key.textContent=index+1;button.append(key);if(id)button.append(iconImage(id));if(id&&gameMode==='survival'){const amount=document.createElement('span');amount.className='slot-count';amount.textContent=ITEMS[id].kind==='tool'?'':survival.count(id);button.append(amount);const dur=durabilityElement(id);if(dur)button.append(dur);}button.onclick=()=>selectSlot(index);$('hotbar').append(button);});
  $('selected-name').textContent=ITEMS[heldId()].name;updateHeldItem();
}
function selectSlot(index){selected=(index+9)%9;expedition.cancelFishing();cancelMining();renderHotbar();if(mode==='inventory')renderInventory();queueSave();}
function availableStations(){
  const result={hand:null};for(let y=Math.floor(player.y)-2;y<=Math.floor(player.y)+2;y++)for(let z=Math.floor(player.z)-3;z<=Math.floor(player.z)+3;z++)for(let x=Math.floor(player.x)-3;x<=Math.floor(player.x)+3;x++){
    if(Math.hypot(x+.5-player.x,y+.5-player.y,z+.5-player.z)>4.5)continue;const id=world.get(x,y,z);if(id===25)result.table={x,y,z};if(id===26)result.furnace={x,y,z};if(id===29)result.campfire={x,y,z};
  }return result;
}
function renderInventory(){
  const creative=gameMode==='creative';$('inventory-mode-label').textContent=creative?'CRÉATIF · RESSOURCES ILLIMITÉES':'SURVIE';$('bag-title').textContent=creative?'Blocs & objets':'Votre sac';$('bag-info').textContent=`Emplacement ${selected+1}`;
  $('inventory-grid').replaceChildren();const ids=creative?Object.keys(ITEMS).map(Number).filter(id=>id!==24):[0,...Object.keys(survival.counts).map(Number).filter(id=>survival.count(id)>0)];
  for(const id of ids){const button=document.createElement('button');button.className='inventory-item'+(id===hotbar[selected]?' active':'')+(id===0?' empty-hand':'');button.dataset.id=id;button.setAttribute('aria-label',`${ITEMS[id].name}${creative||id===0?'':` · ${survival.count(id)}`}`);button.append(iconImage(id));const label=document.createElement('span');label.textContent=ITEMS[id].name;button.append(label);if(!creative&&id){const amount=document.createElement('b');amount.className='item-amount';amount.textContent=survival.count(id);button.append(amount);const dur=durabilityElement(id);if(dur)button.append(dur);}button.onclick=()=>equip(id);$('inventory-grid').append(button);}
  $('inventory-empty').hidden=creative||ids.length>1;const stations=availableStations();$('station-label').textContent=[stations.table?'Établi':null,stations.furnace?'Fourneau':null,stations.campfire?'Feu de camp':null].filter(Boolean).join(' + ')||'À la main';
  $('recipe-list').replaceChildren();for(const r of RECIPES){const can=creative||Object.hasOwn(stations,r.station)&&survival.canCraft(r.id,r.station);const button=document.createElement('button');button.className='recipe'+(can?' available':'')+(r.id===selectedRecipe?' active':'');button.setAttribute('aria-label',r.name);button.dataset.recipe=r.id;button.append(iconImage(r.output[0]));const label=document.createElement('span');label.textContent=r.name;button.append(label);if(r.output[1]>1){const count=document.createElement('b');count.className='recipe-yield';count.textContent=`×${r.output[1]}`;button.append(count);}button.onclick=()=>{selectedRecipe=r.id;renderInventory();};$('recipe-list').append(button);}
  renderRecipeDetail(stations);inventorySignature=JSON.stringify(survival.counts);
}
function renderRecipeDetail(stations=availableStations()){
  const r=RECIPES.find(r=>r.id===selectedRecipe)||RECIPES[0],detail=$('recipe-detail');detail.replaceChildren();const title=document.createElement('h3');title.textContent=`${r.name} ×${r.output[1]}`;detail.append(title);const ingredients=document.createElement('div');ingredients.className='ingredients';
  for(const [id,n] of r.ingredients){const row=document.createElement('span');row.className='ingredient'+(gameMode==='survival'&&survival.count(id)<n?' missing':'');row.title=ITEMS[id].name;row.append(iconImage(id));const text=document.createElement('span');text.textContent=gameMode==='creative'?`×${n}`:`${survival.count(id)} / ${n}`;row.append(text);ingredients.append(row);}detail.append(ingredients);
  const station=document.createElement('div');station.className='station-required';station.textContent=r.station==='hand'?'Fabrication à la main':r.station==='table'?'Établi requis à proximité':r.station==='campfire'?'Feu de camp · cuisson en 5 secondes':'Fourneau + charbon · cuisson en 5 secondes';detail.append(station);
  const job=smeltingJobs.find(j=>j.recipeId===r.id);const button=document.createElement('button');button.className='craft-button';button.id='craft-button';button.disabled=gameMode==='survival'&&(!Object.hasOwn(stations,r.station)||!survival.canCraft(r.id,r.station));button.textContent=job?`Cuisson… ${Math.ceil(job.remaining)} s${smeltingJobs.length>1?` (${smeltingJobs.length} en cours)`:''}`:gameMode==='creative'?'Équiper cet objet':['furnace','campfire'].includes(r.station)?'Lancer la cuisson':'Fabriquer';if(job)button.disabled=true;button.onclick=()=>craftRecipe(r.id);detail.append(button);
}
function craftRecipe(id){
  if(mode!=='inventory')return false;const r=RECIPES.find(r=>r.id===id);if(!r)return false;
  if(gameMode==='creative'){equip(r.output[0]);return true;}
  const stations=availableStations();if(!Object.hasOwn(stations,r.station)||!survival.canCraft(id,r.station))return false;
  if(['furnace','campfire'].includes(r.station)){if(smeltingJobs.some(j=>j.recipeId===id))return false;for(const [i,n] of r.ingredients)survival.remove(i,n);smeltingJobs.push({recipeId:id,remaining:5,position:stations[r.station]});toast(r.station==='campfire'?'La cuisson commence sur les braises.':'Le fourneau est allumé.');}
  else if(survival.craft(id,r.station)){expedition.stats.crafted++;autoEquip(r.output[0]);toast(`${r.name} ×${r.output[1]}`);playSound('craft');}
  renderHotbar();renderInventory();queueSave();return true;
}

const outline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.008,1.008,1.008)),new THREE.LineBasicMaterial({color:0x15251b,transparent:true,opacity:.8}));scene.add(outline);outline.visible=false;
const handScene=new THREE.Scene(),handCamera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.1,10);handCamera.position.set(0,0,3);handScene.add(new THREE.HemisphereLight(0xffffff,0x7e845b,2.5));const handLight=new THREE.DirectionalLight(0xffe7c7,2);handLight.position.set(-3,6,5);handScene.add(handLight);
const handMaterial=new THREE.MeshLambertMaterial({map:atlas.texture});const heldBlock=new THREE.Mesh(new THREE.BoxGeometry(.42,.42,.42),handMaterial);heldBlock.rotation.set(.2,-.6,.1);handScene.add(heldBlock);
const handSkin=new THREE.MeshLambertMaterial({color:0xe2b38b});const bareHand=new THREE.Mesh(new THREE.BoxGeometry(.22,.6,.23),handSkin);bareHand.rotation.set(-.35,-.4,-.22);handScene.add(bareHand);
const heldFlatMaterial=new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide,alphaTest:.15});const heldFlat=new THREE.Mesh(new THREE.PlaneGeometry(.67,.72),heldFlatMaterial);heldFlat.rotation.z=-.18;handScene.add(heldFlat);let swing=0;
function textureForItem(id){if(!iconTextures.has(id)){const texture=new THREE.TextureLoader().load(itemIcon(id));texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.NearestFilter;texture.colorSpace=THREE.SRGBColorSpace;iconTextures.set(id,texture);}return iconTextures.get(id);}
function updateHeldItem(){const id=heldId(),b=BLOCKS[id];heldBlock.visible=!!id&&!!b&&![27,29,31].includes(id);bareHand.visible=id===0;heldFlat.visible=!heldBlock.visible&&id!==0;if(heldBlock.visible){const uv=heldBlock.geometry.attributes.uv;for(let f=0;f<6;f++){const tile=f===2?(b.top??b.tile):f===3?(b.bottom??b.tile):f===4?(b.front??b.tile):b.tile;const u=tile%8/8,v=1-(Math.floor(tile/8)+1)/8;[[0,1],[1,1],[0,0],[1,0]].forEach(([a,c],k)=>uv.setXY(f*4+k,u+a/8,v+c/8));}uv.needsUpdate=true;}else if(id){heldFlatMaterial.map=textureForItem(id);heldFlatMaterial.needsUpdate=true;}}
const particleGeometry=new THREE.BoxGeometry(.075,.075,.075),particles=[];
function debris(hit){const material=new THREE.MeshLambertMaterial({color:BLOCKS[hit.id].color});for(let i=0;i<8;i++){const mesh=new THREE.Mesh(particleGeometry,material);mesh.position.set(hit.x+.2+Math.random()*.6,hit.y+.2+Math.random()*.6,hit.z+.2+Math.random()*.6);scene.add(mesh);particles.push({mesh,v:new THREE.Vector3((Math.random()-.5)*3,2+Math.random()*2,(Math.random()-.5)*3),life:.5+Math.random()*.3,material});}}
function playSound(kind){ambience.action(kind);}
function dropItem(id,count,position,durability,age=0){
  if(id===0){if(gameMode==='survival')survival.xp+=count;return;}
  if(!ITEMS[id]||!Number.isInteger(count)||count<1)return;
  const material=new THREE.SpriteMaterial({map:textureForItem(id),alphaTest:.2});const sprite=new THREE.Sprite(material);sprite.scale.set(.38,.41,1);sprite.position.set(position.x,position.y,position.z);scene.add(sprite);const drop={id,count,durability,age,sprite,velocity:{x:0,y:age?0:2,z:0},pickupDelay:.5};drops.push(drop);return drop;
}
const mobs=new MobSystem({scene,world,onDamage:(amount,reason)=>takeDamage(amount,reason||'Un rôdeur vous a attaqué.'),onLoot:(id,count,position)=>{if(gameMode==='survival')dropItem(id,count,position);}});
if(saved?.version>=2){
  try{if(saved.mobs)mobs.restore(saved.mobs);}catch(e){}
  if(Array.isArray(saved.drops))for(const d of saved.drops.slice(0,300))if([d.x,d.y,d.z,d.age].every(Number.isFinite)&&d.age>=0&&d.age<600)dropItem(d.id,d.count,d,d.durability,d.age);
  if(Array.isArray(saved.smeltingJobs))for(const j of saved.smeltingJobs.slice(0,30))if(RECIPES.some(r=>r.id===j.recipeId&&['furnace','campfire'].includes(r.station))&&Number.isFinite(j.remaining)&&j.remaining>0&&j.remaining<=5&&j.position&&['x','y','z'].every(k=>Number.isInteger(j.position[k])))smeltingJobs.push(j);
}
function updateDrops(dt){
  let changed=false;const torso={x:player.x,y:player.y+.7,z:player.z};
  for(let i=drops.length-1;i>=0;i--){const d=drops[i],p=d.sprite.position;d.age+=dt;const distance=Math.hypot(p.x-torso.x,p.y-torso.y,p.z-torso.z);const reachable=distance<2.6&&canReachDrop(world,p,torso);
    if(gameMode==='survival'&&survival.health>0&&d.age>d.pickupDelay&&distance<2&&reachable){const added=survival.add(d.id,d.count);if(added){if(d.durability&&ITEMS[d.id].kind==='tool')survival.durability[d.id]=Math.max(1,Math.min(d.durability,ITEMS[d.id].durability));d.count-=added;autoEquip(d.id);changed=true;playSound('pickup');}}
    if(d.count<=0||d.age>600){scene.remove(d.sprite);d.sprite.material.dispose();drops.splice(i,1);continue;}
    if(distance<2.5&&d.age>d.pickupDelay&&gameMode==='survival'&&reachable){d.velocity.x=(player.x-p.x)*3;d.velocity.z=(player.z-p.z)*3;}else{d.velocity.x*=Math.max(0,1-dt*2);d.velocity.z*=Math.max(0,1-dt*2);}
    advanceDrop(world,p,d.velocity,dt);d.sprite.material.rotation=Math.sin(d.age*1.5)*.12;
  }
  if(changed){renderHotbar();if(mode==='inventory')renderInventory();queueSave();}
}
function updateSmelting(dt){let complete=false;for(let i=smeltingJobs.length-1;i>=0;i--){const job=smeltingJobs[i],recipe=RECIPES.find(r=>r.id===job.recipeId),station=world.get(job.position.x,job.position.y,job.position.z);if(station!==(recipe.station==='campfire'?29:26)){for(const [id,count] of recipe.ingredients)dropItem(id,count,{x:job.position.x+.5,y:job.position.y+.8,z:job.position.z+.5});smeltingJobs.splice(i,1);complete=true;toast('Foyer retiré : ingrédients récupérables au sol.');continue;}job.remaining-=dt;if(job.remaining<=0){const r=RECIPES.find(r=>r.id===job.recipeId);dropItem(r.output[0],r.output[1],{x:job.position.x+.5,y:job.position.y+1.2,z:job.position.z+.5});survival.xp++;smeltingJobs.splice(i,1);toast(`${r.name} : récupérez le résultat près du foyer.`);complete=true;}}if(complete){queueSave();if(mode==='inventory')renderInventory();}}
function flashDamage(){playSound('hurt');$('damage-flash').classList.add('hit');clearTimeout(damageTimer);damageTimer=setTimeout(()=>$('damage-flash').classList.remove('hit'),260);}
function takeDamage(amount,reason='Vous avez succombé à vos blessures.'){
  if(gameMode!=='survival'||survival.health<=0||mode!=='playing')return;if(survival.damage(amount)>0)flashDamage();if(survival.health<=0)die(reason);else queueSave();
}
function die(reason){
  if(mode==='dead')return;expedition.cancelFishing();for(const [id,count] of Object.entries(survival.counts)){dropItem(Number(id),count,{x:player.x+(Math.random()-.5)*.9,y:player.y+.7,z:player.z+(Math.random()-.5)*.9},survival.durability[id]);}
  survival.counts={};survival.durability={};survival.xp=0;$('death-reason').textContent=reason;setMode('dead');renderHotbar();save();
}
function cancelMining(){mining=null;autoMine=false;$('mining-progress').hidden=true;}
function viewHit(includeWater=true){const dir=new THREE.Vector3();camera.getWorldDirection(dir);const reach=gameMode==='creative'?7:4.5;return {dir,hit:raycast(world,camera.position,dir,reach,includeWater)};}
function breakBlock(hit,info){
  if(world.get(hit.x,hit.y,hit.z)!==hit.id||!world.set(hit.x,hit.y,hit.z,0))return false;
  if(hit.id===30)for(const loot of expedition.takeChest(`${hit.x},${hit.y},${hit.z}`))dropItem(loot.id,loot.count,{x:hit.x+.5,y:hit.y+.8,z:hit.z+.5},loot.durability);
  debris(hit);updateBlocks(hit.x,hit.z);playSound('break');swing=1;
  if(gameMode==='survival'){
    if(info.dropCount)dropItem(info.dropId,info.dropCount,{x:hit.x+.5,y:hit.y+.45,z:hit.z+.5});
    if(hit.id===6&&Math.random()<.13)dropItem(I.APPLE,1,{x:hit.x+.5,y:hit.y+.5,z:hit.z+.5});
    if(survival.wearTool(heldId()))toast('Votre outil s’est cassé.');
    renderHotbar();
  }queueSave();return true;
}
function act(kind,single=false){
  if(mode!=='playing')return false;const {dir,hit}=viewHit(gameMode==='creative'&&kind!=='place');
  if(kind==='break'){expedition.cancelFishing();
    const entity=mobs.raycast(camera.position,dir,3.3);if(entity&&(!hit||entity.distance<hit.distance)){
      if(performance.now()-lastCombat<460)return false;lastCombat=performance.now();mobs.attack(entity.id,attackDamage(heldId()),dir);swing=1;playSound('hit');cancelMining();if(gameMode==='survival'){survival.wearTool(heldId());renderHotbar();queueSave();}return true;
    }
  }
  if(kind==='place'&&interactExpedition(hit,dir))return true;
  if(kind==='place'&&hit&&[25,26,28,29,30].includes(hit.id)&&!keys.has('ShiftLeft')&&!keys.has('ShiftRight')){
    if(performance.now()-lastUse<170)return false;lastUse=performance.now();
    if(hit.id===28){useBed(hit);return true;}if(hit.id===30){activeChest=`${hit.x},${hit.y},${hit.z}`;setMode('chest');renderChest();return true;}
    selectedRecipe=hit.id===26?'iron_ingot':hit.id===29?'campfire_fish':'wood_pickaxe';setMode('inventory');renderInventory();return true;
  }
  if(kind==='place'&&ITEMS[heldId()].kind==='food'){
    if(performance.now()-lastUse<450)return false;lastUse=performance.now();const foodId=heldId();if(gameMode==='creative'||survival.eat(foodId)){expedition.nourish(foodId);playSound('eat');swing=1;renderHotbar();queueSave();return true;}toast('Vous n’avez pas faim.');return false;
  }
  if(!hit)return false;
  if(kind==='pick'){if(hit.id===24)return false;if(gameMode==='survival'&&!survival.count(hit.id))return false;const index=hotbar.indexOf(hit.id);if(index>=0)selectSlot(index);else equip(hit.id);return true;}
  if(kind==='break'){
    if(hit.id===24){toast('Le socle est indestructible.');return false;}
    if(gameMode==='creative')return breakBlock(hit,{dropCount:0});
    const info=survival.mineInfo(hit.id,heldId());if(!info.allowed)return false;
    const key=`${hit.x},${hit.y},${hit.z}`;if(!mining||mining.key!==key||mining.tool!==heldId())mining={key,hit,elapsed:0,info,tool:heldId()};if(single)autoMine=true;return true;
  }
  if(kind==='place'){
    if(performance.now()-lastUse<170)return false;lastUse=performance.now();
    const id=heldId();if(!BLOCKS[id]||id===0||id===24)return false;
    const x=hit.x+hit.normal.x,y=hit.y+hit.normal.y,z=hit.z+hit.normal.z;
    if(y>=HEIGHT){toast('Hauteur maximale : 64 blocs.');return false;}
    if(overlapsBlock(player,x,y,z)&&solid(id)||solid(world.get(x,y,z)))return false;
    if(solid(id)&&mobs.mobs.some(m=>m.x+m.definition.radius>x&&m.x-m.definition.radius<x+1&&m.z+m.definition.radius>z&&m.z-m.definition.radius<z+1&&m.y+m.definition.height>y&&m.y<y+blockHeight(id))){toast('Une créature occupe cet espace.');return false;}
    if([27,29,30,31].includes(id)&&!solid(world.get(x,y-1,z))){toast('Posez cet objet sur un support solide.');return false;}
    if(world.set(x,y,z,id)){if(id===29)expedition.stats.campsBuilt++;if(gameMode==='survival')survival.remove(id,1);updateBlocks(x,z);renderHotbar();swing=1;playSound('place');queueSave();return true;}
  }return false;
}
function updateMining(dt){
  if(gameMode==='creative'){if((heldAction==='break'||keys.has('KeyX'))&&performance.now()-lastAction>180){act('break');lastAction=performance.now();}return;}
  const wants=heldAction==='break'||keys.has('KeyX')||autoMine;if(!wants){cancelMining();return;}
  const {dir,hit}=viewHit(false);const entity=mobs.raycast(camera.position,dir,3.3);if(entity&&(!hit||entity.distance<hit.distance)){cancelMining();act('break');return;}if(!hit){cancelMining();return;}
  const key=`${hit.x},${hit.y},${hit.z}`;
  if(!mining||mining.key!==key||mining.tool!==heldId()){if(autoMine){cancelMining();return;}cancelMining();act('break');}
  if(!mining)return;
  mining.elapsed+=dt;swing=.6+Math.sin(performance.now()*.035)*.4;$('mining-progress').hidden=false;$('mining-progress').firstElementChild.style.width=`${Math.min(100,mining.elapsed/mining.info.seconds*100)}%`;
  if(mining.elapsed>=mining.info.seconds){const current=mining;breakBlock(current.hit,current.info);cancelMining();}
}
function useBed(hit){
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:hit.x+dx+.5,y:hit.y+.01,z:hit.z+dz+.5};if(!collides(world,p)){spawnPoint=p;break;}}
  if(!isNight()){toast('Point de réapparition défini. Dormez ici la nuit.');queueSave();return;}
  if(mobs.mobs.some(m=>m.type==='hostile'&&Math.hypot(m.x-player.x,m.z-player.z)<9)){toast('Des monstres sont trop proches pour dormir.');return;}
  timeOfDay=.17;dayCount++;survival.health=20;survival.hunger=Math.max(0,survival.hunger-1);toast('Le jour se lève. Point de réapparition enregistré.');queueSave();
}
function setMode(next){
  mode=next;if(next!=='playing'){fishingFloat.visible=fishingLine.visible=false;$('fishing-status').hidden=true;photoMode=false;document.body.classList.remove('photo-mode');expedition.cancelFishing();}keys.clear();heldAction=null;jumpRequest=false;cancelMining();
  for(const [id,value] of [['start-screen','start'],['pause-screen','pause'],['inventory-screen','inventory'],['new-world-screen','new'],['death-screen','dead'],['map-screen','map'],['chest-screen','chest']])$(id).hidden=next!==value;
  $('hud').hidden=['start','new','dead'].includes(next);$('touch-controls').hidden=next!=='playing'||!touch;$('crosshair').style.display=next==='playing'?'block':'none';$('objective').hidden=next!=='playing'||gameMode!=='survival';document.body.classList.toggle('playing',next==='playing');
  if(next!=='playing'){outline.visible=false;$('target-info').textContent='';if(document.pointerLockElement===canvas)document.exitPointerLock();if(hasPlayed)save();}
  if(next==='inventory')renderInventory();if(next==='map')renderMap();if(next==='pause')$('time-control').value=timeOfDay;
}
function changeGameMode(next){
  const nextMode=next==='creative'?'creative':'survival',changed=gameMode!==nextMode;gameMode=nextMode;hotbar=gameMode==='creative'?creativeBar:survivalBar;if(changed||gameMode!=='creative'){flying=false;vy=0;fallStart=null;}cancelMining();document.body.classList.toggle('creative',gameMode==='creative');document.body.classList.toggle('survival',gameMode==='survival');
  $('respawn-button').hidden=gameMode==='survival';$('choose-survival').setAttribute('aria-pressed',String(gameMode==='survival'));$('choose-creative').setAttribute('aria-pressed',String(gameMode==='creative'));$('game-mode').value=gameMode;document.querySelector('.brand small').textContent=gameMode==='creative'?'CRÉATIF':'SURVIE';$('mode-description').textContent=gameMode==='survival'?'Récoltez, fabriquez et préparez-vous pour la nuit.':'Blocs illimités, vol libre et aucune limite à vos idées.';$('play-label').textContent=gameMode==='survival'?'Jouer en survie':'Jouer en créatif';$('survival-stats').hidden=gameMode==='creative';$('objective').hidden=mode!=='playing'||gameMode!=='survival';$('world-generation-label').textContent=world.generation===1?'Monde classique conservé':'Biomes & grottes';renderHotbar();if(mode==='inventory')renderInventory();if(hasPlayed)queueSave();
}
async function play(){
  ambience.start();hasPlayed=true;if(gameMode==='survival'&&survival.health<=0){$('death-reason').textContent='Votre dernière expédition s’est terminée ici.';setMode('dead');return;}
  setMode('playing');camera.position.set(player.x,player.y+1.62,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');if(!touch){try{if(!canvas.requestPointerLock)throw Error('unsupported');await canvas.requestPointerLock();dragLook=false;}catch(e){dragLook=true;toast('Glissez pour regarder · Cliquez ou maintenez X pour miner.');}}
}
function inventory(){if(mode==='inventory')play();else if(['playing','pause'].includes(mode)){setMode('inventory');$('close-inventory').focus();}}
function toggleFlight(){if(gameMode!=='creative'){toast('Le vol est disponible en mode créatif.');return;}flying=!flying;vy=0;fallStart=null;toast(flying?'Vol activé · Espace : monter · Maj : descendre':'Vol désactivé');queueSave();}
$('choose-survival').onclick=()=>changeGameMode('survival');$('choose-creative').onclick=()=>changeGameMode('creative');$('game-mode').onchange=e=>changeGameMode(e.target.value);
$('play-button').onclick=play;$('resume-button').onclick=play;$('menu-button').onclick=()=>{if(mode!=='dead')setMode('pause');};document.querySelector('.brand').onclick=e=>{e.preventDefault();if(mode!=='dead')setMode(hasPlayed?'pause':'start');};$('inventory-button').onclick=inventory;$('close-inventory').onclick=play;
$('death-respawn').onclick=()=>{expedition.stamina=100;expedition.hydration=100;expedition.warmth=100;expedition.wetness=0;survival.health=20;survival.hunger=20;survival.oxygen=20;survivalBar.fill(0);spawn();scheduleChunks(true);save();renderHotbar();play();};
$('respawn-button').onclick=()=>{spawn();scheduleChunks(true);queueSave();play();};
$('new-world-button').onclick=()=>{setMode('new');$('seed').value='';$('new-game-mode').value=gameMode;$('seed').focus();};$('cancel-new').onclick=()=>setMode('pause');
$('new-world-form').onsubmit=e=>{
  e.preventDefault();const seed=$('seed').value.trim()||String(Math.floor(Math.random()*9999999));world=new World(seed,2);for(const key of chunkMeshes.keys())disposeChunk(key);mobs.setWorld(world);atmosphere.setWorld(world);landscape.setWorld(world);navigation.setWorld(world);expedition=new Expedition();for(const d of drops){scene.remove(d.sprite);d.sprite.material.dispose();}drops.length=0;smeltingJobs.length=0;survival=new Survival();spawnPoint=null;survivalBar=[0,0,0,0,0,0,0,0,I.APPLE];creativeBar=[...DEFAULT_HOTBAR];selected=0;timeOfDay=.17;dayCount=1;$('weather-control').value='auto';$('time-control').value=.17;spawn(false);changeGameMode($('new-game-mode').value);lastCenter='';scheduleChunks(true);for(let i=0;i<9&&chunkQueue.length;i++){const [x,z]=chunkQueue.shift();buildChunk(x,z);}save();play();toast(`Nouveau monde : ${seed}`);
};
$('sensitivity').oninput=e=>sensitivity=Number(e.target.value);$('sound').onchange=e=>{soundEnabled=e.target.checked;ambience.setEnabled(soundEnabled);queueSave();};$('render-distance').onchange=e=>{renderDistance=Number(e.target.value);scheduleChunks(true);};
document.addEventListener('pointerlockchange',()=>{if(!document.pointerLockElement&&mode==='playing'&&!dragLook)setMode('pause');});document.addEventListener('pointerlockerror',()=>{if(mode==='playing')dragLook=true;});
function rotate(dx,dy){yaw-=dx*.0022*sensitivity;pitch=THREE.MathUtils.clamp(pitch-dy*.0022*sensitivity,-Math.PI/2+.02,Math.PI/2-.02);}
document.addEventListener('mousemove',e=>{if(mode==='playing'&&document.pointerLockElement===canvas)rotate(e.movementX,e.movementY);});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select'))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&mode==='playing')e.preventDefault();
  if(e.code==='Escape'){if(mode==='playing')setMode('pause');else if(['inventory','new','map','chest'].includes(mode))setMode('pause');return;}
  if(e.repeat)return;if(e.code==='KeyM'&&['playing','pause','map'].includes(mode)){if(mode==='map')play();else setMode('map');return;}if(e.code==='KeyP'&&mode==='playing'){photoMode=!photoMode;document.body.classList.toggle('photo-mode',photoMode);toast(photoMode?'Mode photo · P : interface · Échap : réglages':'Interface rétablie');return;}if(e.code==='KeyE'&&mode==='chest'){play();return;}if(e.code==='KeyE'){inventory();return;}if(mode!=='playing')return;keys.add(e.code);
  if(e.code==='KeyF')toggleFlight();if(e.code==='KeyX')act('break');if(e.code==='KeyC')act('place');
  if(e.code==='Space'){jumpRequest=true;const now=performance.now();if(gameMode==='creative'&&now-lastJump<280)toggleFlight();lastJump=now;}
  if(/^Digit[1-9]$/.test(e.code))selectSlot(Number(e.code.at(-1))-1);
  if(e.code==='KeyQ'&&gameMode==='survival'){const id=heldId(),dur=survival.durability[id];if(id&&survival.remove(id,1)){const dir=new THREE.Vector3();camera.getWorldDirection(dir);const dropped=dropItem(id,1,{x:player.x+dir.x*.6,y:player.y+1.3,z:player.z+dir.z*.6},dur);dropped.pickupDelay=2;dropped.velocity.x=dir.x*6;dropped.velocity.z=dir.z*6;cancelMining();renderHotbar();queueSave();}}
});
document.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(mode==='playing')setMode('pause');});document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();if(hasPlayed)save();if(mode==='playing')setMode('pause');}});window.addEventListener('pagehide',()=>{if(hasPlayed)save();});
canvas.addEventListener('contextmenu',e=>e.preventDefault());let dragStart=null,dragDistance=0;
canvas.addEventListener('pointerdown',e=>{
  if(mode!=='playing')return;if(touch){if(lookTouch===null){lookTouch=e.pointerId;dragStart={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}return;}
  if(dragLook){dragStart={x:e.clientX,y:e.clientY,button:e.button};dragDistance=0;canvas.setPointerCapture(e.pointerId);return;}
  const kind=e.button===0?'break':e.button===2?'place':e.button===1?'pick':null;if(kind){act(kind);heldAction=kind;lastAction=performance.now();}
});
canvas.addEventListener('pointermove',e=>{if(mode!=='playing'||!dragStart||!touch&&!dragLook||touch&&e.pointerId!==lookTouch)return;const dx=e.clientX-dragStart.x,dy=e.clientY-dragStart.y;dragDistance+=Math.abs(dx)+Math.abs(dy);if(dragDistance>6)cancelMining();rotate(dx,dy);dragStart.x=e.clientX;dragStart.y=e.clientY;});
canvas.addEventListener('pointerup',e=>{heldAction=null;if(touch&&e.pointerId!==lookTouch)return;if(dragLook&&!touch&&dragStart&&dragDistance<6){const kind=dragStart.button===0?'break':dragStart.button===2?'place':dragStart.button===1?'pick':null;if(kind)act(kind,true);}dragStart=null;if(e.pointerId===lookTouch)lookTouch=null;});
canvas.addEventListener('pointercancel',()=>{heldAction=null;dragStart=null;lookTouch=null;cancelMining();});document.addEventListener('mouseup',()=>heldAction=null);
canvas.addEventListener('wheel',e=>{if(mode==='playing'){e.preventDefault();selectSlot(selected+(e.deltaY>0?1:-1));}},{passive:false});
for(const button of document.querySelectorAll('[data-move]')){button.onpointerdown=e=>{e.preventDefault();keys.add(button.dataset.move);button.setPointerCapture(e.pointerId);};button.onpointerup=button.onpointercancel=()=>keys.delete(button.dataset.move);}
for(const [id,key] of [['touch-jump','Space'],['touch-down','ShiftLeft']]){$(id).onpointerdown=e=>{e.preventDefault();keys.add(key);if(key==='Space')jumpRequest=true;e.currentTarget.setPointerCapture(e.pointerId);};$(id).onpointerup=$(id).onpointercancel=()=>keys.delete(key);}
$('touch-break').onpointerdown=e=>{e.preventDefault();heldAction='break';act('break');e.currentTarget.setPointerCapture(e.pointerId);};$('touch-break').onpointerup=$('touch-break').onpointercancel=()=>heldAction=null;$('touch-place').onclick=()=>act('place');$('touch-inventory').onclick=inventory;$('touch-fly').onclick=toggleFlight;

function updatePlayer(dt){
  const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),strafe=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
  const running=(keys.has('ShiftLeft')||keys.has('ShiftRight'))&&(gameMode==='creative'||survival.hunger>6&&expedition.canSprint),wet=world.get(player.x,player.y+.8,player.z)===7;
  const speed=flying?10:wet?3.4:running?7.2:4.8,norm=Math.hypot(forward,strafe)||1;
  const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*strafe)/norm*speed*dt,dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*strafe)/norm*speed*dt;
  if(flying)vy=((keys.has('Space')?1:0)-(running?1:0))*8;
  else{vy-=wet?8*dt:24*dt;if(wet&&keys.has('Space'))vy=4.5;else if(jumpRequest&&grounded){vy=8.5;grounded=false;fallStart=player.y;}vy=Math.max(vy,-25);}
  jumpRequest=false;if(!grounded&&!flying&&!wet)fallStart=Math.max(fallStart??player.y,player.y);if(wet||flying)fallStart=null;
  const previousPosition={...player};const hit=moveBody(world,player,{x:dx,y:vy*dt,z:dz});grounded=hit.y&&vy<0;if(hit.y)vy=0;
  if(grounded){if(fallStart!==null&&fallStart-player.y>3.5&&!wet)takeDamage(Math.floor(fallStart-player.y-3),'Une chute trop importante.');fallStart=null;}
  if(player.y<-8){if(gameMode==='survival')takeDamage(20,'Vous êtes tombé hors du monde.');else spawn();}if(player.y>HEIGHT+80)player.y=HEIGHT+80;
  const bob=grounded&&(forward||strafe)?Math.sin(performance.now()*.011)*.035:0;camera.position.set(player.x,player.y+1.62+bob,player.z);camera.rotation.set(pitch,yaw,0,'YXZ');
  const submerged=world.get(camera.position.x,camera.position.y,camera.position.z)===7;submergedNow=submerged;$('underwater').style.display=submerged?'block':'none';
  if(submerged){scene.fog.near=1;scene.fog.far=17;scene.fog.color.set('#347e98');scene.background.set('#347e98');}else{/* Atmospheric fog follows the weather. */}
  if(gameMode==='survival'&&mode==='playing'){const result=survival.tick(dt,{moving:!!(forward||strafe),running,submerged});if(result.damaged)flashDamage();if(result.died)die(submerged?'Vous avez manqué d’air.':'Vous êtes mort de faim.');}
  $('movement-mode').textContent=flying?'EN VOL':wet?'DANS L’EAU':gameMode==='survival'?'SURVIE':'CRÉATIF';$('fly-label').textContent=flying?'Atterrir':'Voler';
  const exposure=expedition.tick(dt,{running,moving:!!(forward||strafe),swimming:wet,submerged,sheltered:environment.sheltered,temperature:environment.temperature,precipitation:environment.precipitation,nearFire,creative:gameMode==='creative',speed:Math.hypot(player.x-previousPosition.x,player.z-previousPosition.z)/Math.max(dt,.001)});
  if(exposure.damage)takeDamage(exposure.damage,exposure.cold?'Le froid a eu raison de vous.':'Vous avez manqué d’eau.');
  ambience.update(dt,{...environment,active:true,submerged,nearWater,nearFire,moving:!!(forward||strafe),running,grounded,groundBlock:world.get(player.x,player.y-.1,player.z)});
  const targetFov=(Number($('field-of-view').value)||72)+(running&&(forward||strafe)?5:0);camera.fov+=(targetFov-camera.fov)*Math.min(1,dt*6);camera.updateProjectionMatrix();
  updateFishing(dt);
  const {dir,hit:aim}=viewHit(gameMode==='creative');target=aim;mobTarget=mobs.raycast(camera.position,dir,4.5);if(mobTarget&&target&&mobTarget.distance>target.distance)mobTarget=null;
  landscapeTarget=landscape.raycast(camera.position,dir,4.5);if(landscapeTarget&&target&&landscapeTarget.distance>target.distance+.15)landscapeTarget=null;
  outline.visible=!photoMode&&!expedition.fishing&&!landscapeTarget&&!!target&&!mobTarget&&mode==='playing';if(target){outline.scale.set(1,target.id===27?.8:blockHeight(target.id),1);outline.position.set(target.x+.5,target.y+outline.scale.y/2,target.z+.5);}
  $('target-info').textContent=landscapeTarget?`${landscapeTarget.name} · clic droit`:(expedition.fishing?expedition.fishing.phase==='bite'?'Ça mord ! Clic droit pour ferrer':'Pêche en cours…':mobTarget?mobTarget.name:target?`${ITEMS[target.id].name}${gameMode==='survival'&&mining&&mining.info.dropCount===0&&[3,17,18,19,20].includes(target.id)?' · pioche adaptée requise':''}`:'');
}
function updateVitals(){
  const meter=(node,value,symbol,cls)=>{const signature=Math.ceil(value*2);if(node.dataset.value===String(signature))return;node.dataset.value=signature;node.replaceChildren();for(let i=0;i<10;i++){const span=document.createElement('span');span.className=cls;span.textContent=symbol;const fill=document.createElement('i');fill.textContent=symbol;fill.style.width=`${THREE.MathUtils.clamp((value-i*2)/2,0,1)*100}%`;span.append(fill);node.append(span);}};
  meter($('hearts'),survival.health,'♥','heart');meter($('hunger'),survival.hunger,'◆','food');$('hearts').setAttribute('aria-label',`Vie : ${Math.ceil(survival.health)} sur 20`);$('hunger').setAttribute('aria-label',`Faim : ${Math.ceil(survival.hunger)} sur 20`);$('oxygen').hidden=survival.oxygen>=20;$('oxygen').textContent='●'.repeat(Math.ceil(survival.oxygen/2));$('xp-level').textContent=Math.floor(survival.xp/7);$('xp-bar').firstElementChild.style.width=`${survival.xp%7/7*100}%`;
  const counts=survival.counts;let instruction='Récoltez du bois : maintenez le clic gauche sur un tronc.';
  if(counts[5])instruction='Ouvrez E pour transformer votre bois en planches.';
  if(counts[8])instruction='Fabriquez un établi et des bâtons dans l’inventaire.';
  if(counts[25]||availableStations().table)instruction='Posez l’établi, puis fabriquez une pioche en bois.';
  if([110,111,112,113].some(id=>counts[id]))instruction='Explorez les grottes : charbon, fer et diamant vous attendent.';
  $('objective').innerHTML='<small>Votre prochaine étape</small>';const text=document.createElement('span');text.textContent=instruction;$('objective').append(text);
}
const fishingFloat=new THREE.Mesh(new THREE.SphereGeometry(.065,8,6),new THREE.MeshStandardMaterial({color:0xe58450,emissive:0x6c2912,roughness:.7}));scene.add(fishingFloat);fishingFloat.visible=false;
const fishingLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3()]),new THREE.LineBasicMaterial({color:0xe2d8ba,transparent:true,opacity:.65}));scene.add(fishingLine);fishingLine.visible=false;
function drinkFromWater(){
  const water=viewHit(true).hit;
  if(!water||water.id!==7){toast('Approchez de l’eau et visez sa surface.');return false;}
  if(performance.now()-lastUse<900)return true;lastUse=performance.now();
  expedition.hydration=Math.min(100,expedition.hydration+30);playSound('drink');toast('Vous buvez à la rivière.');queueSave();return true;
}
function interactExpedition(hit,dir){
  if(hit&&[25,26,28,29,30].includes(hit.id)&&!keys.has('ShiftLeft')&&!keys.has('ShiftRight'))return false;
  const found=landscape.raycast(camera.position,dir,4.5);
  if(found&&(!hit||found.distance<=hit.distance+.15)){
    if(performance.now()-lastUse<350)return true;lastUse=performance.now();
    const loot=landscape.harvest(found.id);if(loot){for(const [id,n] of loot.items){const added=survival.add(id,n);if(added)autoEquip(id);if(added<n)dropItem(id,n-added,found.position);}toast(loot.message);playSound('pickup');renderHotbar();queueSave();}return true;
  }
  const id=heldId();
  if(id===I.FISHING_ROD){
    if(performance.now()-lastUse<450)return true;lastUse=performance.now();
    if(expedition.fishing){const result=expedition.reel();if(result.success){survival.add(result.itemId,result.count);autoEquip(result.itemId);survival.xp+=2;toast('Une prise ! Poisson cru ajouté au sac.');playSound('pickup');}else toast('La ligne est remontée trop tôt. Attendez que le flotteur plonge.');if(gameMode==='survival')survival.wearTool(id);renderHotbar();queueSave();return true;}
    const water=viewHit(true).hit;if(!water||water.id!==7){toast('Visez la surface de l’eau pour lancer votre ligne.');return true;}
    expedition.startFishing({x:water.x+.5,y:water.y+.9,z:water.z+.5});toast('Ligne lancée. Attendez la touche, puis clic droit pour ferrer.');return true;
  }
  if(id===I.FLASK){
    if(performance.now()-lastUse<600)return true;lastUse=performance.now();const water=viewHit(true).hit;
    if(water?.id===7){expedition.fillFlask();toast('Gourde remplie · 4 gorgées.');playSound('drink');}
    else if(expedition.drink()){toast(`Vous buvez · ${expedition.flaskWater} gorgée(s) restante(s).`);playSound('drink');}
    else toast(expedition.flaskWater?'Vous êtes déjà hydraté.':'Gourde vide : remplissez-la dans une rivière.');queueSave();return true;
  }
  if(id===I.BANDAGE){if(performance.now()-lastUse<600)return true;lastUse=performance.now();if(expedition.bandage(survival)){toast('Blessures soignées · +3 cœurs.');playSound('craft');renderHotbar();queueSave();}else toast('Aucune blessure à soigner.');return true;}
  if(id===0&&viewHit(true).hit?.id===7)return drinkFromWater();
  return false;
}
function updateFishing(dt){
  const active=expedition.fishing;
  if(active&&(heldId()!==I.FISHING_ROD||Math.hypot(player.x-active.position.x,player.z-active.position.z)>10||world.get(active.position.x,active.position.y,active.position.z)!==7)){expedition.cancelFishing();toast('La ligne a été récupérée.');}
  const before=expedition.fishing?.phase,state=expedition.tickFishing(dt);
  if(state.phase==='bite'&&before!=='bite'){toast('Ça mord ! Clic droit maintenant.');playSound('pickup');}
  if(state.phase==='escaped')toast('Le poisson s’est échappé. Relancez la ligne.');
  fishingFloat.visible=fishingLine.visible=!!expedition.fishing;
  if(expedition.fishing){const fish=expedition.fishing;fishingFloat.position.set(fish.position.x,fish.position.y+Math.sin(performance.now()*.004)*.03-(fish.phase==='bite'?.15:0),fish.position.z);const a=fishingLine.geometry.attributes.position;a.setXYZ(0,camera.position.x+.15,camera.position.y-.3,camera.position.z);a.setXYZ(1,...fishingFloat.position.toArray());a.needsUpdate=true;fishingLine.geometry.computeBoundingSphere();}
  $('fishing-status').hidden=!expedition.fishing;$('fishing-status').classList.toggle('bite',state.phase==='bite');$('fishing-status').textContent=state.phase==='bite'?'ÇA MORD · CLIC DROIT':'PÊCHE · ATTENDEZ LA TOUCHE';
}
function renderChest(){
  if(!activeChest)return;const chest=expedition.chest(activeChest);if(!chest)return;
  const make=(container,counts,deposit)=>{container.replaceChildren();for(const [key,n] of Object.entries(counts)){const id=Number(key);if(!n)continue;const button=document.createElement('button');button.className='inventory-item';button.append(iconImage(id));const label=document.createElement('span');label.textContent=ITEMS[id].name;button.append(label);const count=document.createElement('b');count.className='item-amount';count.textContent=n;button.append(count);button.setAttribute('aria-label',`${deposit?'Déposer':'Prendre'} ${ITEMS[id].name} · ${n}`);button.title='Clic : un objet · Maj + clic : toute la pile';button.onclick=e=>{const amount=e.shiftKey?n:1;const success=deposit?expedition.deposit(activeChest,survival,id,amount):expedition.withdraw(activeChest,survival,id,amount);if(success){if(!deposit)autoEquip(id);playSound('pickup');renderChest();renderHotbar();queueSave();}else toast('Vous possédez déjà cet outil ou cette gourde.');};container.append(button);}if(!container.children.length){const p=document.createElement('p');p.className='empty-note';p.textContent=deposit?'Votre sac est vide.':'Ce coffre est vide.';container.append(p);}};
  make($('chest-bag'),survival.counts,true);make($('chest-storage'),chest.counts,false);
}
function renderMap(){
  $('travel-waypoint').hidden=gameMode!=='creative'||!navigation.waypoint;
  navigation.draw($('world-map'),{position:player,yaw,large:true,spawnPoint});
  $('journal-sites').replaceChildren();for(const site of [...navigation.discovered.values()].reverse()){const button=document.createElement('button');button.className='journal-site';const name=document.createElement('strong');name.textContent=site.name;const distance=document.createElement('span');distance.textContent=`${Math.round(Math.hypot(site.x-player.x,site.z-player.z))} m · définir un repère`;button.append(name,distance);button.onclick=()=>{navigation.waypoint={x:site.x,z:site.z};renderMap();queueSave();};$('journal-sites').append(button);}
  if(!navigation.discovered.size)$('journal-sites').textContent='Suivez les rivières. Des campements oubliés et des ruines se cachent dans les terres sauvages.';
  $('journal-distance').textContent=expedition.stats.distance>=1000?`${(expedition.stats.distance/1000).toFixed(1)} km`:`${Math.round(expedition.stats.distance)} m`;
  $('journal-fish').textContent=expedition.stats.fishCaught;$('journal-camps').textContent=expedition.stats.campsBuilt;$('journal-places').textContent=navigation.discovered.size;
  $('map-position').textContent=`${Math.floor(player.x)} / ${Math.floor(player.y)} / ${Math.floor(player.z)} · ${world.biome(player.x,player.z).name}`;
}
function updateExpeditionUI(){
  const heading=((Math.round(-yaw*180/Math.PI)%360)+360)%360,directions=['N','NE','E','SE','S','SO','O','NO'];
  $('compass-bearing').textContent=`${directions[Math.round(heading/45)%8]} ${String(heading).padStart(3,'0')}°`;
  const names={clear:'Ciel dégagé',rain:'Pluie',storm:'Orage',snow:'Neige'};
  const hour=(timeOfDay*24+6)%24,clock=`${String(Math.floor(hour)).padStart(2,'0')}:${String(Math.floor(hour%1*60)).padStart(2,'0')}`;
  $('weather-label').textContent=names[environment.weather]||'Ciel dégagé';$('temperature-label').textContent=`${Math.round(environment.temperature)}°`; $('world-clock').textContent=clock;
  $('weather-icon').textContent=environment.weather==='clear'?(environment.daylight>.4?'☀':'☾'):environment.weather==='snow'?'❄':environment.weather==='storm'?'ϟ':'☂';
  $('expedition-vitals').hidden=gameMode==='creative';
  for(const [id,value] of [['stamina',expedition.stamina],['hydration',expedition.hydration],['warmth',expedition.warmth]]){$(`${id}-bar`).style.width=`${value}%`;$(`${id}-value`).textContent=Math.ceil(value);$(`${id}-meter`).classList.toggle('low',value<25);}
  $('shelter-state').textContent=nearFire?'Au coin du feu':environment.sheltered?'À l’abri':expedition.wetness>35?'Vêtements mouillés':'En plein air';
  $('waypoint-hint').hidden=!navigation.waypoint;if(navigation.waypoint)$('waypoint-hint').textContent=`◇ REPÈRE · ${Math.round(Math.hypot(navigation.waypoint.x-player.x,navigation.waypoint.z-player.z))} m`;
  if(heldId()===I.FLASK)$('selected-name').textContent=`Gourde · ${expedition.flaskWater}/4`;
  if(expedition.hydration<25&&gameMode==='survival')$('objective').lastElementChild.textContent='Trouvez de l’eau. Visez la rivière et pressez R pour boire.';
  else if(expedition.warmth<30&&gameMode==='survival')$('objective').lastElementChild.textContent='Réchauffez-vous près d’un feu de camp et abritez-vous de la pluie.';
}
function setupExpeditionUI(){
  if(Number.isFinite(saved?.settings?.volume)){$('volume').value=saved.settings.volume;ambience.setVolume(saved.settings.volume);}if(Number.isFinite(saved?.settings?.fov))$('field-of-view').value=THREE.MathUtils.clamp(saved.settings.fov,55,95);
  $('quality').value=quality;$('sound').checked=soundEnabled;$('sensitivity').value=sensitivity;$('render-distance').value=renderDistance;ambience.enabled=soundEnabled;renderer.shadowMap.enabled=quality!=='low';renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='medium'?1.25:1.5));$('weather-control').value=atmosphere.serialize().mode||'auto';$('time-control').value=timeOfDay;
  $('quality').onchange=e=>{quality=e.target.value;renderer.setPixelRatio(Math.min(devicePixelRatio,quality==='low'?1:quality==='medium'?1.25:1.5));renderer.shadowMap.enabled=quality!=='low';queueSave();};
  $('volume').oninput=e=>{ambience.setVolume(Number(e.target.value));queueSave();};
  $('weather-control').onchange=e=>{atmosphere.setWeather(e.target.value,true);queueSave();};
  $('time-control').oninput=e=>{timeOfDay=Number(e.target.value);queueSave();};
  $('field-of-view').oninput=e=>{camera.fov=Number(e.target.value);camera.updateProjectionMatrix();queueSave();};
  $('close-map').onclick=play;$('close-chest').onclick=play;$('map-button').onclick=()=>setMode('map');$('menu-map').onclick=()=>setMode('map');
  $('travel-waypoint').onclick=()=>{if(gameMode!=='creative'||!navigation.waypoint)return;const p=navigation.waypoint;player.x=p.x+.5;player.z=p.z+.5;player.y=Math.max(SEA+1.1,world.surface(player.x,player.z)+1.1);vy=0;flying=true;fallStart=null;scheduleChunks(true);save();play();toast('Vous avez rejoint votre repère.');};
  $('clear-waypoint').onclick=()=>{navigation.waypoint=null;renderMap();queueSave();};
  $('world-map').onclick=e=>{const canvas=$('world-map'),r=canvas.getBoundingClientRect();navigation.setWaypointFromMap((e.clientX-r.left)*canvas.width/r.width,(e.clientY-r.top)*canvas.height/r.height);renderMap();queueSave();};
  $('world-map').onkeydown=e=>{if(e.code==='Enter'){navigation.waypoint={x:Math.round(player.x),z:Math.round(player.z)};renderMap();queueSave();}};
  document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea'))return;if(e.code==='KeyR'&&mode==='playing')drinkFromWater();});
}

function isNight(){return Math.sin(timeOfDay*Math.PI*2)<-.12;}
function updateSky(dt){
  if(mode==='playing'){const before=timeOfDay;timeOfDay=(timeOfDay+dt/1200)%1;if(timeOfDay<before){dayCount++;expedition.stats.nightsSurvived++;}}
  environment=atmosphere.update(dt,{position:mode==='start'?camera.position:player,timeOfDay,biome:world.biome(player.x,player.z),paused:mode!=='playing',submerged:submergedNow,quality,viewDistance:renderDistance*SIZE});
  terrainStyle.update(dt,environment,camera,timeOfDay);naturalTrees.update(dt,environment.wind);
  landscape.update(mode==='playing'||mode==='start'?dt:0,{position:player,timeOfDay,wind:environment.wind,daylight:environment.daylight,quality});
  if(mode!=='playing')ambience.update(dt,{active:false});
  lightClock+=dt;if(lightClock>.25){lightClock=0;const locations=[];nearFire=false;nearWater=false;
    for(const group of chunkMeshes.values())for(const p of group.userData.torches||[]){const d=Math.hypot(p[0]-player.x,p[1]-player.y,p[2]-player.z);if(d<24)locations.push(p);if(p[3]===29&&d<5)nearFire=true;}
    for(let x=-4;x<=4;x+=2)for(let z=-4;z<=4;z+=2)if(world.get(player.x+x,SEA,player.z+z)===7&&player.y<SEA+5)nearWater=true;
    locations.sort((a,b)=>Math.hypot(a[0]-player.x,a[2]-player.z)-Math.hypot(b[0]-player.x,b[2]-player.z));if([27,31].includes(heldId()))locations.unshift([player.x,player.y+1.5,player.z,heldId()]);
    torchLights.forEach((light,i)=>{light.intensity=locations[i]?(locations[i][3]===29?13:locations[i][3]===31?9:6)*(1+Math.sin(performance.now()*.01+i)*.07):0;if(locations[i])light.position.set(...locations[i].slice(0,3));});
    for(const group of chunkMeshes.values())group.traverse(o=>{if(o.userData.flame){o.scale.y=.85+Math.sin(performance.now()*.013+o.id)*.2;o.rotation.y+=.3;}});
  }
}

setupExpeditionUI();changeGameMode(gameMode);scheduleChunks();const initial=chunkQueue.splice(0,25);for(const [x,z] of initial)buildChunk(x,z);
camera.position.set(player.x-10,player.y+11,player.z+19);camera.lookAt(player.x+30,SEA+7,player.z-30);mobs.update(.01,{player,night:false,survival:gameMode==='survival',paused:false});
$('loading').style.opacity='0';setTimeout(()=>$('loading').hidden=true,420);
let frames=0,fpsTime=performance.now(),uiTime=0,autoSave=performance.now(),lastDraw=0;
function frame(now){
  requestAnimationFrame(frame);const dt=Math.min(.04,(now-previousTime)/1000);previousTime=now;updateSky(dt);
  if(mode==='playing'){updatePlayer(dt);if(mode==='playing'){updateMining(dt);mobs.update(dt,{player,night:isNight(),survival:gameMode==='survival',paused:false});updateDrops(dt);}scheduleChunks();if(heldAction==='place'&&now-lastAction>250){act('place');lastAction=now;}}
  if(hasPlayed&&['playing','inventory'].includes(mode))updateSmelting(dt);
  if(mode==='start'){const h=world.height(player.x,player.z),cx=player.x-13+Math.sin(now*.00005)*2,cz=player.z+16;camera.position.set(cx,Math.max(world.height(cx,cz)+14,h+13,SEA+12),cz);camera.lookAt(player.x+20,Math.max(h-3,SEA+2),player.z-25);}
  if(chunkQueue.length){const [x,z]=chunkQueue.shift();buildChunk(x,z);}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){scene.remove(p.mesh);particles.splice(i,1);if(!particles.some(v=>v.material===p.material))p.material.dispose();}else{p.v.y-=12*dt;p.mesh.position.addScaledVector(p.v,dt);p.mesh.rotation.x+=dt*4;p.mesh.scale.setScalar(Math.min(1,p.life*3));}}
  const shouldDraw=mode==='playing'||mode==='start'||now-lastDraw>65;if(shouldDraw){renderer.autoClear=true;renderer.render(scene,camera);lastDraw=now;}
  if(mode==='playing'&&!touch&&!photoMode){swing=Math.max(0,swing-dt*5);const bob=Math.sin(swing*Math.PI);for(const object of [heldBlock,heldFlat,bareHand]){object.position.set(camera.aspect*.83,-.74-bob*.22,1.05);object.rotation.z=(object===bareHand?-.22:.1)-bob*.5;}renderer.autoClear=false;renderer.clearDepth();renderer.render(handScene,handCamera);}
  if(now-uiTime>250){$('coordinates').textContent=`${Math.floor(player.x)} / ${Math.floor(player.y+.001)} / ${Math.floor(player.z)}`;$('biome').textContent=`${world.biome(player.x,player.z).name} · Jour ${dayCount}`;document.querySelector('.sun-symbol').textContent=isNight()?'☾':'☀';if(gameMode==='survival')updateVitals();if(mode==='inventory'&&smeltingJobs.length)renderRecipeDetail();updateExpeditionUI();uiTime=now;}
  mapClock+=dt;if(mapClock>1.2){mapClock=0;if(['playing','start'].includes(mode)){const found=navigation.visit(player,landscape.getNearbySites(player,70));if(hasPlayed&&found.length)toast(`Lieu découvert : ${found[0].name}`);navigation.draw($('minimap'),{position:player,yaw,spawnPoint});}}
  frames++;if(now-fpsTime>1000){$('fps').textContent=`${Math.round(frames*1000/(now-fpsTime))} FPS`;frames=0;fpsTime=now;}
  if(hasPlayed&&now-autoSave>12000){save();autoSave=now;}
}
requestAnimationFrame(frame);window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();handCamera.aspect=camera.aspect;handCamera.updateProjectionMatrix();});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(mode!=='dead')setMode('pause');toast('Affichage interrompu. Rechargez pour retrouver votre partie.');});
const inspect=()=>({version:3,expedition:expedition.serialize(),weather:{...environment},discoveries:[...navigation.discovered.values()],fishing:expedition.fishing,seed:world.seed,generation:world.generation,gameMode,screen:mode,position:{...player},yaw,pitch,flying,health:survival.health,hunger:survival.hunger,oxygen:survival.oxygen,xp:survival.xp,inventory:{...survival.counts},durability:{...survival.durability},selectedItem:ITEMS[heldId()].name,hotbar:[...hotbar],stations:Object.keys(availableStations()),mining:mining?{block:ITEMS[mining.hit.id].name,progress:Math.round(mining.elapsed/mining.info.seconds*100)}:null,target:target?{x:target.x,y:target.y,z:target.z,id:target.id,name:ITEMS[target.id].name}:null,creatures:mobs.mobs.map(m=>({type:m.type,x:m.x,y:m.y,z:m.z,health:m.health})),drops:drops.map(d=>({id:d.id,count:d.count,x:d.sprite.position.x,y:d.sprite.position.y,z:d.sprite.position.z})),editedBlocks:[...world.edits.values()].reduce((n,m)=>n+m.size,0),smelting:smeltingJobs.map(j=>({recipe:j.recipeId,seconds:Math.ceil(j.remaining)})),storageOK});
if(document.modelContext?.registerTool){
  const defs=[{name:'inspect_astramc_world',title:'État du monde AstraMC',description:'Lit le monde, la survie, l’inventaire, la cible et les créatures.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(input&&Object.keys(input).length)throw Error('Aucun paramètre attendu.');return inspect();}},
  {name:'craft_astramc_item',title:'Fabriquer une recette',description:'Fabrique depuis l’inventaire ouvert, en consommant les ingrédients et en respectant les stations proches. Le fourneau lance une cuisson de cinq secondes.',inputSchema:{type:'object',properties:{recipeId:{type:'string'}},required:['recipeId'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||typeof input.recipeId!=='string'||Object.keys(input).some(k=>k!=='recipeId'))throw Error('Recette invalide.');if(!craftRecipe(input.recipeId))throw Error('Inventaire fermé, recette inconnue ou ressources/station indisponibles.');return {inventory:{...survival.counts},smelting:smeltingJobs.length};}}];
  for(const def of defs){try{Promise.resolve(document.modelContext.registerTool(def)).catch(()=>{});}catch(e){}}
}
window.astraMC=Object.freeze({getState:inspect,getBlock:(x,y,z)=>world.get(x,y,z)});
