import * as THREE from './vendor/three.module.js';
import { SIZE, SEA, hash, solid, raycast as blockRaycast } from './world.js';

// Landscape is a visual layer: generating it never writes a voxel into the world.
const TAU = Math.PI * 2;
const NATURAL_GROUND = new Set([1, 2, 3, 4, 12, 21]);
const SITE_SPACING = 64;
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const finitePosition = p => p && [p.x,p.y,p.z].every(Number.isFinite);
const COLORS = { stone: 0x8c9687, moss: 0x6b7d47, wood: 0x66503c, cloth: 0xb18b5c, leaf: 0x52783a, fern: 0x457b42 };

function decorateMaterial(material, uniforms) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uLandscapeTime = uniforms.time;
    shader.uniforms.uLandscapeWind = uniforms.wind;
    shader.vertexShader = 'attribute float aSway;\nuniform float uLandscapeTime;\nuniform float uLandscapeWind;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float landscapePhase = position.x * 1.7 + position.z * 2.2;
      #ifdef USE_INSTANCING
        landscapePhase += instanceMatrix[3].x * .8 + instanceMatrix[3].z * .6;
      #endif
      transformed.x += sin(uLandscapeTime * 1.6 + landscapePhase) * aSway * uLandscapeWind * .19;
      transformed.z += cos(uLandscapeTime * 1.25 + landscapePhase * .7) * aSway * uLandscapeWind * .11;
    `);
  };
  material.customProgramCacheKey = () => 'astramc-landscape-wind-v1';
  return material;
}

class GeometryBatch {
  constructor() { this.positions=[];this.normals=[];this.colors=[];this.sway=[]; }
  add(geometry, x,y,z, sx,sy,sz, color, rotation=0, sway=0) {
    const p=geometry.attributes.position,n=geometry.attributes.normal,idx=geometry.index;
    const c=new THREE.Color(color),cos=Math.cos(rotation),sin=Math.sin(rotation);
    const length=idx?idx.count:p.count;
    for(let i=0;i<length;i++) {
      const j=idx?idx.getX(i):i,px=p.getX(j)*sx,py=p.getY(j)*sy,pz=p.getZ(j)*sz;
      this.positions.push(px*cos+pz*sin+x,py+y,-px*sin+pz*cos+z);
      let nx=n.getX(j)/sx,ny=n.getY(j)/sy,nz=n.getZ(j)/sz;
      const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
      this.normals.push(nx*cos+nz*sin,ny,-nx*sin+nz*cos);
      this.colors.push(c.r,c.g,c.b);this.sway.push(sway*Math.max(0,py));
    }
  }
  geometry() {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(this.normals,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));
    g.setAttribute('aSway',new THREE.Float32BufferAttribute(this.sway,1));
    g.computeBoundingSphere();return g;
  }
}

function grassGeometry() {
  const positions=[],colors=[],sway=[];
  for(let blade=0;blade<5;blade++) {
    const angle=blade*2.399,px=Math.cos(angle)*.1,pz=Math.sin(angle)*.1;
    const width=.045+blade*.006,height=.4+blade*.075,bend=.13;
    const vx=Math.cos(angle)*width,vz=Math.sin(angle)*width;
    const points=[[px-vx,0,pz-vz],[px+vx,0,pz+vz],[px+bend*Math.cos(angle),height,pz+bend*Math.sin(angle)]];
    for(const [x,y,z] of points){positions.push(x,y,z);sway.push(y);const c=new THREE.Color(y?0xb7cd67:0x577136);colors.push(c.r,c.g,c.b);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('aSway',new THREE.Float32BufferAttribute(sway,1));g.computeVertexNormals();return g;
}

export class Landscape {
  constructor({scene,world}) {
    this.scene=scene;this.world=world;this.root=new THREE.Group();this.root.name='AstraMC living landscape';scene.add(this.root);
    this.chunks=new Map();this.collectables=new Map();this.harvested=new Set();this.pending=[];
    this.uniforms={time:{value:0},wind:{value:.45}};this.clock=0;this.revision=world.revision;this.revisionCooldown=0;this.center='';
    this.material=decorateMaterial(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),this.uniforms);
    this.grassMaterial=decorateMaterial(new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}),this.uniforms);
    this.grassGeometry=grassGeometry();
    this.parts={box:new THREE.BoxGeometry(1,1,1),rock:new THREE.IcosahedronGeometry(1,0),sphere:new THREE.IcosahedronGeometry(1,1),stem:new THREE.CylinderGeometry(.5,.6,1,5),cap:new THREE.ConeGeometry(1,.5,8),leaf:new THREE.PlaneGeometry(1,1)};
    this.createWildlife();
  }
  random(x,z,salt=0) { return hash(x,z,this.world.seedId+salt); }
  ground(x,z) {
    const ix=Math.floor(x),iz=Math.floor(z),y=this.world.height(ix,iz);
    // An edited, covered or excavated column never grows scenery in midair.
    const id=this.world.get(ix,y,iz);
    return NATURAL_GROUND.has(id)&&this.world.get(ix,y+1,iz)===0?{y:y+1,id}:null;
  }
  siteAt(gx,gz) {
    if(this.random(gx,gz,1801)>.72)return null;
    const x=gx*SITE_SPACING+12+Math.floor(this.random(gx,gz,1802)*40);
    const z=gz*SITE_SPACING+12+Math.floor(this.random(gx,gz,1803)*40);
    const y=this.world.height(x,z)+1;
    if(y<=SEA+2)return null;
    // Keep landmarks out of steep riverbanks and cliff faces.
    if([[-3,-3],[3,-3],[-3,3],[3,3]].some(([dx,dz])=>Math.abs(this.world.height(x+dx,z+dz)+1-y)>2))return null;
    const kind=Math.floor(this.random(gx,gz,1804)*3),type=['ruins','camp','arch'][kind];
    return {id:`site:${gx}:${gz}`,type,name:['Ruines des anciens','Campement oublié','Arche des vents'][kind],x:x+.5,y,z:z+.5};
  }
  getNearbySites(position,radius=120) {
    if(!finitePosition(position))return [];
    radius=clamp(Number(radius)||120,1,256);const result=[];
    const x0=Math.floor((position.x-radius)/SITE_SPACING),x1=Math.floor((position.x+radius)/SITE_SPACING);
    const z0=Math.floor((position.z-radius)/SITE_SPACING),z1=Math.floor((position.z+radius)/SITE_SPACING);
    for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++) {
      const site=this.siteAt(x,z);if(site&&Math.hypot(site.x-position.x,site.z-position.z)<=radius)result.push(site);
    }
    return result.sort((a,b)=>Math.hypot(a.x-position.x,a.z-position.z)-Math.hypot(b.x-position.x,b.z-position.z));
  }
  addCollectable(record,chunkKey) {
    if(this.harvested.has(record.id))return false;
    this.collectables.set(record.id,{...record,chunkKey});return true;
  }
  buildChunk(cx,cz,quality=1) {
    const key=`${cx},${cz}`;this.removeChunk(key);
    const group=new THREE.Group();group.position.set(cx*SIZE,0,cz*SIZE);group.name=`landscape ${key}`;
    const batch=new GeometryBatch(),tufts=[],seed=this.world.seedId;
    const put=(part,x,y,z,sx,sy,sz,color,rotation=0,sway=0)=>batch.add(this.parts[part],x,y,z,sx,sy,sz,color,rotation,sway);
    for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++) {
      const wx=cx*SIZE+x,wz=cz*SIZE+z,r=hash(wx,wz,seed+1601),p=this.ground(wx,wz);
      if(!p)continue;
      const biome=this.world.biome(wx,wz).id;
      const px=x+.16+hash(wx,wz,seed+1602)*.68,pz=z+.16+hash(wx,wz,seed+1603)*.68,y=p.y;
      if(p.id===1&&r<(quality===0?.24:.53))tufts.push({x:px,y,z:pz,scale:.65+hash(wx,wz,seed+1604)*.9,angle:r*32,color:biome==='forest'?0x9dbb7e:0xb4c681});
      // A varied understory is intentionally less dense than the grass layer.
      if(p.id===1&&r>.53&&r<.58) {
        const h=.35+hash(wx,wz,seed+1605)*.35,flower=[0xf0ddac,0xd294ad,0x89a9d5,0xe8b655][Math.floor(hash(wx,wz,seed+1606)*4)];
        put('stem',px,y+h/2,pz,.025,h,.025,0x66853c,0,.7);
        for(let k=0;k<5;k++){const a=k*TAU/5;put('sphere',px+Math.sin(a)*.085,y+h,pz+Math.cos(a)*.085,.073,.025,.073,flower,0,.4);}
        put('sphere',px,y+h+.02,pz,.04,.04,.04,0xe2b94b,0,.4);
      } else if(p.id===1&&biome==='forest'&&r>.6&&r<.65) {
        for(let f=0;f<6;f++) {
          const a=f*TAU/6;
          for(let k=1;k<4;k++){const reach=k*.105;put('sphere',px+Math.cos(a)*reach,y+.13+(4-k)*.07,pz+Math.sin(a)*reach,.16,.027,.057,COLORS.fern,a,1);}
        }
      } else if(p.id===4&&y<SEA+4&&r<.24) {
        for(let k=0;k<3;k++){const h=.8+hash(wx+k,wz,seed+1607)*.7,rx=px+(k-1)*.12;put('stem',rx,y+h/2,pz,.025,h,.025,0x829052,0,.8);put('stem',rx,y+h*.88,pz,.065,h*.19,.065,0x775337,0,.8);}
      } else if(r>.985||(biome==='desert'&&r>.95)||(biome==='snow'&&r>.94)) {
        put('rock',px,y+.09,pz,.13+r*.17,.12,.14+r*.18,biome==='desert'?0xb8a986:biome==='snow'?0xb2bac0:0x86917e,r*TAU);
      }
      // The harvest id is tied to seed-independent coordinates within this save.
      if(p.id===1&&r>.88&&r<.895) {
        const id=`berry:${wx}:${wz}`;
        if(this.addCollectable({id,type:'berries',name:'Baies sauvages',position:new THREE.Vector3(cx*SIZE+px,y+.36,cz*SIZE+pz),radius:.46,groundY:y-1},key)) {
          for(let k=0;k<3;k++){const a=k*TAU/3;put('sphere',px+Math.cos(a)*.19,y+.27+k*.055,pz+Math.sin(a)*.19,.29,.27,.29,0x52783b,0,.2);}
          for(let k=0;k<8;k++){const a=k*2.399;put('sphere',px+Math.cos(a)*.29,y+.28+(k%3)*.12,pz+Math.sin(a)*.29,.05,.05,.05,0xba3d58,0,.2);}
        }
      } else if(p.id===1&&biome==='forest'&&r>.903&&r<.915) {
        const id=`mushroom:${wx}:${wz}`;
        if(this.addCollectable({id,type:'mushrooms',name:'Champignons des bois',position:new THREE.Vector3(cx*SIZE+px,y+.2,cz*SIZE+pz),radius:.32,groundY:y-1},key)) {
          for(let k=0;k<3;k++){const h=.13+k*.055,mx=px+(k-1)*.13,mz=pz+(k%2)*.11;put('stem',mx,y+h/2,mz,.05,h,.05,0xd6c7a9);put('cap',mx,y+h,mz,.13,.25,.13,0xa26a43);}
        }
      }
    }
    const chunkCenter={x:cx*SIZE+SIZE/2,y:0,z:cz*SIZE+SIZE/2};
    for(const site of this.getNearbySites(chunkCenter,20))if(Math.floor(site.x/SIZE)===cx&&Math.floor(site.z/SIZE)===cz)this.buildSite(site,key,put);
    if(tufts.length){
      const grass=new THREE.InstancedMesh(this.grassGeometry,this.grassMaterial,tufts.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color();
      for(let i=0;i<tufts.length;i++){const t=tufts[i];q.setFromAxisAngle(new THREE.Vector3(0,1,0),t.angle);matrix.compose(new THREE.Vector3(t.x,t.y,t.z),q,new THREE.Vector3(t.scale,t.scale,t.scale));grass.setMatrixAt(i,matrix);grass.setColorAt(i,color.set(t.color));}
      grass.instanceMatrix.needsUpdate=true;grass.instanceColor.needsUpdate=true;grass.computeBoundingSphere();grass.receiveShadow=true;group.add(grass);
    }
    if(batch.positions.length){const mesh=new THREE.Mesh(batch.geometry(),this.material);mesh.receiveShadow=true;group.add(mesh);}
    this.root.add(group);this.chunks.set(key,group);
  }
  buildSite(site,key,put) {
    const [cx,cz]=key.split(',').map(Number),ox=site.x-cx*SIZE,oz=site.z-cz*SIZE;
    const place=(part,dx,dz,dy,sx,sy,sz,color,rotation=0)=>{
      const ground=this.ground(site.x+dx,site.z+dz);if(!ground)return;
      put(part,ox+dx,ground.y+dy,oz+dz,sx,sy,sz,color,rotation);
    };
    if(site.type==='ruins') {
      // Low, broken foundations remain walkable; columns have wide, open gaps.
      for(let i=-2;i<=2;i++)for(const s of [-1,1])if(this.random(i,s,1851)>.25)place('rock',i*1.05,s*2,.12,.5,.22,.4,COLORS.stone,i*.5);
      for(const [dx,dz,height] of [[-2,-2,1.7],[2,-2,.9],[-2,2,.55]]) {
        place('box',dx,dz,height/2,.52,height,.52,COLORS.stone,.035);
        place('box',dx,dz,height+.1,.68,.18,.68,0x9a9e8d);
        place('rock',dx+.27,dz+.1,.1,.35,.11,.32,COLORS.moss);
      }
      place('box',.25,-1.95,.12,1.3,.24,.42,0x919588,.21);
    } else if(site.type==='camp') {
      for(let k=0;k<8;k++){const a=k*TAU/8;place('rock',Math.cos(a)*.67,Math.sin(a)*.67,.1,.16,.15,.14,0x777b74,a);}
      place('box',0,0,.06,.68,.1,.12,0x393b37,.5);place('box',0,0,.075,.62,.1,.13,0x3e3d36,-.5);
      place('box',-1.6,1.2,.15,1.2,.3,.4,COLORS.wood,.15);
      place('box',1.5,1.4,.15,1.3,.3,.4,COLORS.wood,-.2);
      // An abandoned lean-to with no enclosed interior or invisible wall.
      place('stem',-1.7,-2,.7,.09,1.4,.09,COLORS.wood);place('stem',1.7,-2,.7,.09,1.4,.09,COLORS.wood);
      place('box',0,-2,1.35,3.5,.1,.1,COLORS.wood);
      place('box',0,-2.35,.08,2.8,.09,.65,COLORS.cloth,.02);
    } else {
      // Slender standing stones frame an open, three metre passage.
      place('rock',-1.85,0,1.45,.49,1.55,.47,0x929a8c,.12);
      place('rock',1.85,0,1.45,.49,1.55,.47,0x929a8c,-.12);
      place('box',0,0,3.08,4.1,.48,.68,0x9ca492,.03);
      place('rock',-2.2,.4,.12,.55,.14,.4,COLORS.moss);
      place('rock',2.3,-.4,.1,.35,.12,.4,COLORS.moss);
    }
    const x=site.x+.7,z=site.z-.65,ground=this.ground(x,z);
    if(!ground)return;
    const id=`cache:${site.id}`;
    if(this.addCollectable({id,type:'cache',name:'Provisions abandonnées',position:new THREE.Vector3(x,ground.y+.24,z),radius:.42,groundY:ground.y-1,siteId:site.id},key)) {
      put('box',ox+.7,ground.y+.22,oz-.65,.65,.44,.45,0x775236);
      put('box',ox+.7,ground.y+.45,oz-.65,.68,.07,.48,0xa27a48);
      for(const dx of [-.2,.2])put('box',ox+.7+dx,ground.y+.24,oz-.65,.05,.47,.47,0x484a42);
      put('box',ox+.7,ground.y+.27,oz-.407,.1,.12,.025,0xbfa45b);
    }
  }
  removeChunk(key) {
    const group=this.chunks.get(key);
    if(group){this.root.remove(group);group.traverse(o=>{if(o.isMesh&&o.geometry!==this.grassGeometry)o.geometry.dispose();if(o.isInstancedMesh)o.dispose();});this.chunks.delete(key);}
    for(const [id,item] of this.collectables)if(item.chunkKey===key)this.collectables.delete(id);
  }
  createWildlife() {
    const count=96,positions=new Float32Array(count*3);
    this.firefliesGeometry=new THREE.BufferGeometry();this.firefliesGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.firefliesMaterial=new THREE.PointsMaterial({color:0xd6ed85,size:.085,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
    this.fireflies=new THREE.Points(this.firefliesGeometry,this.firefliesMaterial);this.fireflies.frustumCulled=false;this.root.add(this.fireflies);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.55,0,0,0,.045,.06,0,0,-.12,0,.045,.06,.55,0,0,0,0,-.12],3));geometry.computeVertexNormals();
    const material=new THREE.MeshLambertMaterial({color:0x313e46,side:THREE.DoubleSide});
    material.onBeforeCompile=shader=>{shader.uniforms.uLandscapeTime=this.uniforms.time;shader.vertexShader='uniform float uLandscapeTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      transformed.y += abs(position.x) * sin(uLandscapeTime * 7. + instanceMatrix[3].x * .4) * .65;
    `);};
    this.birds=new THREE.InstancedMesh(geometry,material,12);this.birds.frustumCulled=false;this.root.add(this.birds);this.birdMatrix=new THREE.Matrix4();this.birdQuaternion=new THREE.Quaternion();
  }
  update(dt,{position,timeOfDay=.3,wind=.5,daylight=1,quality=1}={}) {
    if(!finitePosition(position))return;
    dt=clamp(Number(dt)||0,0,.1);this.clock+=dt;this.uniforms.time.value=this.clock;
    this.uniforms.wind.value=clamp(typeof wind==='number'?wind:wind?.strength??.5,.08,2);
    const level=quality==='low'||quality===0?0:quality==='high'||quality===2?2:1,radius=level===0?1:2;
    const cx=Math.floor(position.x/SIZE),cz=Math.floor(position.z/SIZE),center=`${cx},${cz},${level}`;
    if(center!==this.center){
      this.center=center;this.pending=[];
      for(const key of this.chunks.keys()){const [x,z]=key.split(',').map(Number);if(Math.abs(x-cx)>radius||Math.abs(z-cz)>radius)this.removeChunk(key);}
      for(let z=-radius;z<=radius;z++)for(let x=-radius;x<=radius;x++)if(!this.chunks.has(`${cx+x},${cz+z}`))this.pending.push({cx:cx+x,cz:cz+z,d:x*x+z*z});
      this.pending.sort((a,b)=>a.d-b.d);
    }
    this.revisionCooldown-=dt;
    if(this.world.revision!==this.revision&&this.revisionCooldown<=0){
      this.revision=this.world.revision;this.revisionCooldown=.4;
      const queued=new Set(this.pending.map(c=>`${c.cx},${c.cz}`));
      for(const key of this.chunks.keys())if(!queued.has(key)){const [x,z]=key.split(',').map(Number);this.pending.push({cx:x,cz:z,d:(x-cx)**2+(z-cz)**2});}
      this.pending.sort((a,b)=>a.d-b.d);
    }
    if(this.pending.length){const c=this.pending.shift();this.buildChunk(c.cx,c.cz,level);}
    const night=clamp((.4-daylight)*3.5,0,1);this.fireflies.visible=night>.02;
    if(this.fireflies.visible){
      this.firefliesMaterial.opacity=night*.8;const data=this.firefliesGeometry.attributes.position;
      const anchorX=Math.floor(position.x/16)*16,anchorZ=Math.floor(position.z/16)*16;
      for(let i=0;i<data.count;i++){
        const x=anchorX+(hash(i,2,this.world.seedId+1901)-.5)*45+Math.sin(this.clock*.35+i)*1.2;
        const z=anchorZ+(hash(i,4,this.world.seedId+1902)-.5)*45+Math.cos(this.clock*.3+i*.6)*1.2;
        const y=this.world.height(Math.floor(x),Math.floor(z))+1.3+Math.sin(this.clock*.7+i)*.6+hash(i,5,17)*2;
        data.setXYZ(i,x,y,z);
      }
      data.needsUpdate=true;
    }
    this.birds.visible=daylight>.22;
    if(this.birds.visible){
      const anchorX=Math.floor(position.x/64)*64,anchorZ=Math.floor(position.z/64)*64;
      for(let i=0;i<this.birds.count;i++){
        const phase=this.clock*.07+i*.16,flock=Math.floor(i/4),radius=22+flock*12;
        const x=anchorX+Math.cos(phase+flock)*radius,z=anchorZ+Math.sin(phase+flock)*radius;
        const y=Math.max(position.y+16,this.world.height(Math.floor(x),Math.floor(z))+18)+Math.sin(i*.7+this.clock*.23)*2;
        this.birdQuaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),-phase-flock);
        this.birdMatrix.compose(new THREE.Vector3(x,y,z),this.birdQuaternion,new THREE.Vector3(.6,.6,.6));this.birds.setMatrixAt(i,this.birdMatrix);
      }
      this.birds.instanceMatrix.needsUpdate=true;
    }
  }
  raycast(origin,dir,reach=5) {
    if(!finitePosition(origin)||!finitePosition(dir)||!Number.isFinite(reach)||reach<=0)return null;
    const direction=new THREE.Vector3(dir.x,dir.y,dir.z).normalize();if(!direction.lengthSq())return null;
    let result=null;
    for(const item of this.collectables.values()) {
      const offset=item.position.clone().sub(origin),projection=offset.dot(direction);
      if(projection<0||projection>reach+item.radius)continue;
      const perpendicular=offset.lengthSq()-projection*projection;if(perpendicular>item.radius*item.radius)continue;
      const distance=Math.max(0,projection-Math.sqrt(item.radius*item.radius-perpendicular));
      if(distance>reach||(result&&distance>=result.distance))continue;
      if(!this.isAvailable(item))continue;
      const obstacle=blockRaycast(this.world,origin,direction,distance,false);
      if(obstacle&&obstacle.distance<distance-.03)continue;
      result={id:item.id,type:item.type,name:item.name,position:item.position.clone(),distance,siteId:item.siteId};
    }
    return result;
  }
  isAvailable(item) {
    const x=Math.floor(item.position.x),z=Math.floor(item.position.z);
    return !this.harvested.has(item.id)&&solid(this.world.get(x,item.groundY,z))&&this.world.get(x,item.groundY+1,z)===0;
  }
  harvest(id) {
    const item=this.collectables.get(id);
    if(!item||!this.isAvailable(item))return null;
    this.harvested.add(id);this.collectables.delete(id);
    const [cx,cz]=item.chunkKey.split(',').map(Number);
    if(!this.pending.some(c=>c.cx===cx&&c.cz===cz))this.pending.unshift({cx,cz,d:0});
    if(item.type==='cache')return {items:[[100,4],[101,2],[105,2]],message:'Provisions récupérées : bâtons, charbon et pommes.',siteId:item.siteId};
    if(item.type==='mushrooms')return {items:[[146,2]],message:'2 champignons récoltés.'};
    return {items:[[145,3]],message:'3 baies sauvages récoltées.'};
  }
  serialize() { return {version:1,harvested:[...this.harvested]}; }
  restore(data) {
    if(!data||typeof data!=='object')return;
    const ids=Array.isArray(data.harvested)?data.harvested:[];
    this.harvested=new Set(ids.slice(0,50000).filter(id=>typeof id==='string'&&/^(?:berry:-?\d+:-?\d+|mushroom:-?\d+:-?\d+|cache:site:-?\d+:-?\d+)$/.test(id)));
    for(const key of [...this.chunks.keys()])this.removeChunk(key);this.center='';this.pending=[];
  }
  setWorld(world) {
    for(const key of [...this.chunks.keys()])this.removeChunk(key);
    this.world=world;this.harvested.clear();this.pending=[];this.center='';this.revision=world.revision;this.clock=0;
  }
  dispose() {
    for(const key of [...this.chunks.keys()])this.removeChunk(key);
    this.scene.remove(this.root);this.grassGeometry.dispose();this.material.dispose();this.grassMaterial.dispose();
    for(const geometry of Object.values(this.parts))geometry.dispose();
    this.firefliesGeometry.dispose();this.firefliesMaterial.dispose();this.birds.geometry.dispose();this.birds.material.dispose();this.birds.dispose();
  }
}
