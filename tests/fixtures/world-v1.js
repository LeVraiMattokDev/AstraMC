export const SIZE = 16;
export const HEIGHT = 64;
export const SEA = 10;
export const BLOCKS = [
  { id: 0, name: 'Air' },
  { id: 1, name: 'Herbe', color: '#7aab47', tile: 0, top: 1, bottom: 2 },
  { id: 2, name: 'Terre', color: '#8b6142', tile: 2 },
  { id: 3, name: 'Pierre', color: '#92979e', tile: 3 },
  { id: 4, name: 'Sable', color: '#e0cf91', tile: 4 },
  { id: 5, name: 'Chêne', color: '#88603b', tile: 5, top: 6, bottom: 6 },
  { id: 6, name: 'Feuilles', color: '#51883b', tile: 7 },
  { id: 7, name: 'Eau', color: '#5da1be', tile: 8, transparent: true },
  { id: 8, name: 'Planches', color: '#c99b61', tile: 9 },
  { id: 9, name: 'Briques', color: '#b46c53', tile: 10 },
  { id: 10, name: 'Verre', color: '#b9e1e6', tile: 11, transparent: true },
  { id: 11, name: 'Pavés', color: '#777e87', tile: 12 },
  { id: 12, name: 'Neige', color: '#e9f1f2', tile: 13 },
  { id: 13, name: 'Laine blanche', color: '#efeee5', tile: 14 },
  { id: 14, name: 'Laine rouge', color: '#b84943', tile: 15 },
  { id: 15, name: 'Laine bleue', color: '#4769ad', tile: 16 },
  { id: 16, name: 'Laine jaune', color: '#e8bd43', tile: 17 },
  { id: 17, name: 'Minerai de charbon', color: '#5e6266', tile: 18 },
  { id: 18, name: 'Minerai de fer', color: '#bb977e', tile: 19 },
  { id: 19, name: 'Minerai de diamant', color: '#62d7d5', tile: 20 },
  { id: 20, name: 'Obsidienne', color: '#3f3559', tile: 21 },
  { id: 21, name: 'Grès', color: '#d8c492', tile: 22 },
  { id: 22, name: 'Laine verte', color: '#669b49', tile: 23 },
  { id: 23, name: 'Laine violette', color: '#9764b7', tile: 24 },
  { id: 24, name: 'Socle', color: '#45464b', tile: 25 },
];
export const PALETTE = BLOCKS.filter(b => b.id && b.id !== 24);
export const DEFAULT_HOTBAR = [1, 2, 3, 5, 8, 6, 10, 9, 4];
export const solid = id => id !== 0 && id !== 7;
export function seedNumber(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
export function hash(x, z, seed = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const mix = (a,b,t) => a + (b-a)*t;
function noise(x,z,seed) {
  const ix=Math.floor(x), iz=Math.floor(z), fx=x-ix, fz=z-iz;
  const u=fx*fx*(3-2*fx), v=fz*fz*(3-2*fz);
  return mix(mix(hash(ix,iz,seed),hash(ix+1,iz,seed),u),mix(hash(ix,iz+1,seed),hash(ix+1,iz+1,seed),u),v);
}
const index = (x,y,z) => (y*SIZE+z)*SIZE+x;
export class World {
  constructor(seed='Astra') {
    this.seed=String(seed); this.seedId=seedNumber(seed); this.chunks=new Map(); this.edits=new Map(); this.revision=0;
  }
  height(x,z) {
    const land=5+noise(x/85,z/85,this.seedId)*20+noise(x/29,z/29,this.seedId+10)*7+noise(x/10,z/10,this.seedId+20)*2;
    const river=Math.abs(x-(31+Math.sin(z/42+this.seedId%8)*17));
    const bank=Math.min(1,Math.max(0,(river-5)/15));
    return Math.max(4,Math.min(40,Math.floor(mix(SEA-3,land,bank*bank*(3-2*bank)))));
  }
  chunkKey(cx,cz) { return `${cx},${cz}`; }
  chunk(cx,cz) {
    const key=this.chunkKey(cx,cz);
    if(this.chunks.has(key)) return this.chunks.get(key);
    const data=new Uint8Array(SIZE*HEIGHT*SIZE);
    for(let z=0;z<SIZE;z++) for(let x=0;x<SIZE;x++) {
      const wx=cx*SIZE+x,wz=cz*SIZE+z,h=this.height(wx,wz);
      for(let y=0;y<=Math.max(h,SEA);y++) {
        let id=3;
        if(y===0) id=24;
        else if(y>h) id=7;
        else if(y===h) id=h<=SEA+1?4:h>29?12:1;
        else if(y>h-4) id=h<=SEA+1?4:2;
        else {
          const r=hash(wx+y*67,wz-y*13,this.seedId+7);
          if(y<8&&r>.975) id=19;
          else if(r>.96) id=18;
          else if(r<.038) id=17;
        }
        data[index(x,y,z)]=id;
      }
    }
    const put=(x,y,z,id,airOnly=false)=>{
      x-=cx*SIZE; z-=cz*SIZE;
      if(x>=0&&x<SIZE&&z>=0&&z<SIZE&&y>0&&y<HEIGHT&&(!airOnly||!data[index(x,y,z)]))data[index(x,y,z)]=id;
    };
    for(let gz=Math.floor((cz*SIZE-3)/7);gz<=Math.floor((cz*SIZE+SIZE+3)/7);gz++) for(let gx=Math.floor((cx*SIZE-3)/7);gx<=Math.floor((cx*SIZE+SIZE+3)/7);gx++) {
      if(hash(gx,gz,this.seedId+81)<.43) continue;
      const tx=gx*7+Math.floor(hash(gx,gz,this.seedId+82)*5),tz=gz*7+Math.floor(hash(gx,gz,this.seedId+83)*5);
      const h=this.height(tx,tz);
      if(h<=SEA+2||h>=29||Math.hypot(tx-8,tz-8)<6)continue;
      const trunk=4+Math.floor(hash(gx,gz,this.seedId+84)*3);
      for(let dy=trunk-2;dy<=trunk+1;dy++) {
        const radius=dy===trunk+1?1:2;
        for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
          if(Math.abs(dx)===2&&Math.abs(dz)===2)continue;
          put(tx+dx,h+dy,tz+dz,6,true);
        }
      }
      for(let y=1;y<=trunk;y++)put(tx,h+y,tz,5);
    }
    const edits=this.edits.get(key);
    if(edits) for(const [i,id] of edits)data[i]=id;
    this.chunks.set(key,data);return data;
  }
  get(x,y,z) {
    x=Math.floor(x);y=Math.floor(y);z=Math.floor(z);
    if(y<0)return 24;if(y>=HEIGHT)return 0;
    const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE);
    return this.chunk(cx,cz)[index(x-cx*SIZE,y,z-cz*SIZE)];
  }
  set(x,y,z,id) {
    if(![x,y,z,id].every(Number.isInteger)||y<=0||y>=HEIGHT||id<0||id>=BLOCKS.length||id===24)return false;
    const cx=Math.floor(x/SIZE),cz=Math.floor(z/SIZE),key=this.chunkKey(cx,cz),i=index(x-cx*SIZE,y,z-cz*SIZE);
    if(this.chunk(cx,cz)[i]===id)return false;
    this.chunk(cx,cz)[i]=id;
    if(!this.edits.has(key))this.edits.set(key,new Map());
    this.edits.get(key).set(i,id);this.revision++;return true;
  }
  serialize() { return [...this.edits].map(([key,values])=>[key,[...values]]); }
  restore(edits) {
    if(!Array.isArray(edits)||edits.length>10000)throw Error('Sauvegarde invalide');
    const next=new Map();let total=0;
    for(const [key,values] of edits) {
      if(typeof key!=='string'||!/^(-?\d+),(-?\d+)$/.test(key)||!Array.isArray(values))throw Error('Sauvegarde invalide');
      const m=new Map();
      for(const [i,id] of values){
        if(!Number.isInteger(i)||i<SIZE*SIZE||i>=SIZE*SIZE*HEIGHT||!Number.isInteger(id)||id<0||id>=24||++total>500000)throw Error('Sauvegarde invalide');
        m.set(i,id);
      }
      next.set(key,m);
    }
    this.edits=next;this.chunks.clear();
  }
}
export function raycast(world,origin,dir,range=7,includeWater=false) {
  let x=Math.floor(origin.x),y=Math.floor(origin.y),z=Math.floor(origin.z);
  const sx=Math.sign(dir.x),sy=Math.sign(dir.y),sz=Math.sign(dir.z);
  const dx=dir.x?Math.abs(1/dir.x):Infinity,dy=dir.y?Math.abs(1/dir.y):Infinity,dz=dir.z?Math.abs(1/dir.z):Infinity;
  let tx=dir.x?((sx>0?x+1-origin.x:origin.x-x)*dx):Infinity;
  let ty=dir.y?((sy>0?y+1-origin.y:origin.y-y)*dy):Infinity;
  let tz=dir.z?((sz>0?z+1-origin.z:origin.z-z)*dz):Infinity;
  let distance=0,normal={x:0,y:0,z:0};
  while(distance<=range) {
    const id=world.get(x,y,z);
    if(id&&(id!==7||includeWater))return {x,y,z,id,normal,distance};
    if(tx<ty&&tx<tz){x+=sx;distance=tx;tx+=dx;normal={x:-sx,y:0,z:0};}
    else if(ty<tz){y+=sy;distance=ty;ty+=dy;normal={x:0,y:-sy,z:0};}
    else{z+=sz;distance=tz;tz+=dz;normal={x:0,y:0,z:-sz};}
  }
  return null;
}
export function overlapsBlock(p,x,y,z) {
  return p.x+.3>x&&p.x-.3<x+1&&p.y+1.8>y&&p.y<y+1&&p.z+.3>z&&p.z-.3<z+1;
}
export function collides(world,p) {
  for(let y=Math.floor(p.y+.0001);y<=Math.floor(p.y+1.8-.0001);y++)
    for(let z=Math.floor(p.z-.3+.0001);z<=Math.floor(p.z+.3-.0001);z++)
      for(let x=Math.floor(p.x-.3+.0001);x<=Math.floor(p.x+.3-.0001);x++)
        if(solid(world.get(x,y,z)))return true;
  return false;
}
export function moveBody(world,p,delta) {
  const hit={x:false,y:false,z:false};
  const steps=Math.max(1,Math.ceil(Math.max(Math.abs(delta.x),Math.abs(delta.y),Math.abs(delta.z))/.2));
  for(let s=0;s<steps;s++)for(const axis of ['x','z','y']) {
    if(hit[axis]||delta[axis]===0)continue;
    const start=p[axis],amount=delta[axis]/steps;
    p[axis]=start+amount;
    if(collides(world,p)) {
      let low=0,high=1;
      for(let i=0;i<12;i++){const mid=(low+high)/2;p[axis]=start+amount*mid;if(collides(world,p))high=mid;else low=mid;}
      p[axis]=start+amount*low;hit[axis]=true;
    }
  }
  return hit;
}
