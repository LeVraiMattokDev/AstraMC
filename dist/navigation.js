const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Navigation {
  constructor(world,saved){this.world=world;this.visited=new Set();this.discovered=new Map();this.waypoint=null;this.cache=new Map();this.restore(saved);}
  setWorld(world){this.world=world;this.visited.clear();this.discovered.clear();this.cache.clear();this.waypoint=null;}
  visit(p,sites=[]){
    const cx=Math.floor(p.x/16),cz=Math.floor(p.z/16);
    for(let z=-2;z<=2;z++)for(let x=-2;x<=2;x++)this.visited.add(`${cx+x},${cz+z}`);
    while(this.visited.size>20000)this.visited.delete(this.visited.values().next().value);
    const found=[];for(const site of sites)if(Math.hypot(site.x-p.x,site.z-p.z)<24&&!this.discovered.has(site.id)){this.discovered.set(site.id,{id:site.id,name:site.name,type:site.type,x:site.x,y:site.y,z:site.z});found.push(site);}
    return found;
  }
  color(x,z){
    const key=`${x},${z}`;if(this.cache.has(key))return this.cache.get(key);
    const h=this.world.height(x,z),biome=this.world.biome(x,z).id;
    const color=h<=10?[55,105,115]:biome==='desert'?[188,168,110]:biome==='snow'?[189,204,195]:biome==='forest'?[61,99,71]:[110,134,82];
    const shade=clamp(1+(h-this.world.height(x-2,z-2))*.09,.65,1.18);
    const result=`rgb(${color.map(v=>Math.round(v*shade)).join(',')})`;this.cache.set(key,result);if(this.cache.size>40000)this.cache.clear();return result;
  }
  draw(canvas,{position,yaw=0,large=false,spawnPoint=null}={}){
    const c=canvas.getContext('2d'),w=canvas.width,h=canvas.height,scale=large?1.5:.8,step=large?6:4;
    c.clearRect(0,0,w,h);c.fillStyle='#14251f';c.fillRect(0,0,w,h);
    const left=position.x-w/scale/2,top=position.z-h/scale/2;
    for(let z=Math.floor(top/step)*step;z<top+h/scale;z+=step)for(let x=Math.floor(left/step)*step;x<left+w/scale;x+=step){
      if(!this.visited.has(`${Math.floor(x/16)},${Math.floor(z/16)}`))continue;
      c.fillStyle=this.color(x,z);c.fillRect((x-left)*scale,(z-top)*scale,Math.ceil(step*scale),Math.ceil(step*scale));
    }
    c.strokeStyle='#edf0c410';c.lineWidth=1;for(let i=0;i<w;i+=32){c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();}for(let i=0;i<h;i+=32){c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke();}
    const mark=(p,color,label)=>{const x=(p.x-left)*scale,y=(p.z-top)*scale;if(x<4||x>w-4||y<4||y>h-4)return;c.fillStyle=color;c.strokeStyle='#14211b';c.lineWidth=2;c.beginPath();c.arc(x,y,large?5:3,0,Math.PI*2);c.fill();c.stroke();if(large&&label){c.font='11px sans-serif';c.textAlign='center';c.fillStyle='#fff5d4';c.fillText(label,x,y-12);}};
    for(const site of this.discovered.values())mark(site,'#e4bc74',site.name);
    if(spawnPoint)mark(spawnPoint,'#b9d3d9','Votre camp');
    if(this.waypoint)mark(this.waypoint,'#f6d996','Destination');
    c.save();c.translate(w/2,h/2);c.rotate(-yaw);c.fillStyle='#ffebba';c.strokeStyle='#203a2a';c.lineWidth=2;c.beginPath();c.moveTo(0,-8);c.lineTo(5,6);c.lineTo(0,3);c.lineTo(-5,6);c.closePath();c.fill();c.stroke();c.restore();
    c.font=large?'bold 12px sans-serif':'bold 10px sans-serif';c.textAlign='center';c.fillStyle='#ecedce';c.fillText('N',w/2,15);
    if(large){c.fillStyle='#0d221ebb';c.fillRect(10,h-34,160,24);c.fillStyle='#eee8cb';c.font='10px sans-serif';c.textAlign='left';c.fillText('Zones sombres : terres inexplorées',18,h-18);}
    this.lastMap={position:{...position},scale,w,h};
  }
  setWaypointFromMap(x,y){if(!this.lastMap)return null;const m=this.lastMap;this.waypoint={x:Math.round(m.position.x+(x-m.w/2)/m.scale),z:Math.round(m.position.z+(y-m.h/2)/m.scale)};return this.waypoint;}
  serialize(){return {visited:[...this.visited],discovered:[...this.discovered.values()],waypoint:this.waypoint};}
  restore(saved){if(!saved||typeof saved!=='object')return;for(const key of Array.isArray(saved.visited)?saved.visited.slice(0,20000):[])if(typeof key==='string'&&/^-?\d+,-?\d+$/.test(key))this.visited.add(key);for(const p of Array.isArray(saved.discovered)?saved.discovered.slice(0,2000):[])if(p&&typeof p.id==='string'&&typeof p.name==='string'&&[p.x,p.y,p.z].every(Number.isFinite))this.discovered.set(p.id,p);if(saved.waypoint&&[saved.waypoint.x,saved.waypoint.z].every(Number.isFinite))this.waypoint={x:saved.waypoint.x,z:saved.waypoint.z};}
}
