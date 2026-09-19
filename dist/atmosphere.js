import * as THREE from './vendor/three.module.js';
import {HEIGHT, hash, seedNumber} from './world.js';

const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const mix=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const WEATHER=new Set(['auto','clear','rain','storm','snow']);
const WEATHER_STRENGTH={clear:0,rain:.72,storm:1,snow:.65};
const numeric=(v,fallback)=>Number.isFinite(v)?v:fallback;

/** Deterministic, serializable climate. The simulation clock stops with the game. */
export class WeatherClimate {
  constructor(seed='Astra'){this.seed=seedNumber(seed);this.reset();}
  reset(){this.mode='auto';this.weather='clear';this.elapsed=0;this.cycle=0;this.remaining=115+hash(this.seed,13)*90;this.precipitation=0;this.wetness=0;this.wind=.18;this.temperature=20;}
  setWeather(mode){if(!WEATHER.has(mode))return false;this.mode=mode;if(mode!=='auto')this.weather=mode;return true;}
  update(dt,{timeOfDay=.17,biome='plains',height=20,sheltered=false,paused=false}={}){
    dt=paused?0:clamp(numeric(dt,0),0,1);this.elapsed+=dt;
    const biomeId=typeof biome==='string'?biome:biome?.id||'plains';
    if(this.mode==='auto'){
      this.remaining-=dt;
      if(this.remaining<=0){
        this.cycle++;const chance=hash(this.cycle,71,this.seed);
        this.weather=chance<(biomeId==='desert'?.83:.48)?'clear':biomeId==='snow'?'snow':chance>.87?'storm':'rain';
        this.remaining=160+hash(this.cycle,72,this.seed)*200;
      }
      if(this.weather==='rain'&&biomeId==='snow')this.weather='snow';
      else if(this.weather==='snow'&&biomeId!=='snow')this.weather='rain';
    }
    const target=WEATHER_STRENGTH[this.weather];
    this.precipitation=mix(this.precipitation,target,1-Math.exp(-dt/10));
    const windTarget=(this.weather==='storm'?.82:this.weather==='clear'?.17:.42)+Math.sin(this.elapsed*.035)*.08;
    this.wind=mix(this.wind,windTarget,1-Math.exp(-dt/8));
    const base={snow:-3,desert:34,forest:20,plains:23}[biomeId]??22;
    const temperature=base+Math.sin((timeOfDay-.04)*Math.PI*2)*6-Math.max(0,height-22)*.16-this.precipitation*4;
    this.temperature=mix(this.temperature,temperature,1-Math.exp(-dt/6));
    const exposed=sheltered?0:this.precipitation*(this.weather==='snow'?.2:1);
    this.wetness=clamp(this.wetness+dt*(exposed*.02-(1-exposed)*.003));
    return {weather:this.weather,temperature:this.temperature,wind:this.wind,precipitation:this.precipitation,sheltered:!!sheltered,wetness:this.wetness};
  }
  serialize(){return {mode:this.mode,weather:this.weather,elapsed:this.elapsed,cycle:this.cycle,remaining:this.remaining,precipitation:this.precipitation,wetness:this.wetness,wind:this.wind,temperature:this.temperature};}
  restore(data){
    if(!data||typeof data!=='object')return;
    this.mode=WEATHER.has(data.mode)?data.mode:'auto';
    this.weather=Object.hasOwn(WEATHER_STRENGTH,data.weather)?data.weather:'clear';
    this.elapsed=clamp(numeric(data.elapsed,0),0,1e9);this.cycle=Math.floor(clamp(numeric(data.cycle,0),0,1e7));
    this.remaining=clamp(numeric(data.remaining,160),1,400);this.precipitation=clamp(numeric(data.precipitation,0));
    this.wetness=clamp(numeric(data.wetness,0));this.wind=clamp(numeric(data.wind,.18));this.temperature=clamp(numeric(data.temperature,20),-50,60);
    if(this.mode!=='auto')this.weather=this.mode;
  }
}

function radialTexture(kind){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');
  if(kind==='moon'){
    ctx.fillStyle='#e8eef6';ctx.beginPath();ctx.arc(64,64,59,0,Math.PI*2);ctx.fill();
    const shade=ctx.createRadialGradient(42,39,5,75,67,72);shade.addColorStop(0,'rgba(255,255,255,.5)');shade.addColorStop(.6,'rgba(181,192,211,.06)');shade.addColorStop(1,'rgba(93,115,151,.8)');ctx.fillStyle=shade;ctx.fill();
    ctx.save();ctx.clip();
    for(let n=0;n<29;n++){const x=12+hash(n,1)*104,y=12+hash(n,2)*104,r=2+hash(n,3)*12;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(88,107,141,.25)');g.addColorStop(.68,'rgba(101,124,147,.17)');g.addColorStop(1,'rgba(145,160,188,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);}ctx.restore();
  }else{
    const gradient=ctx.createRadialGradient(64,64,0,64,64,64);
    if(kind==='sun'){gradient.addColorStop(0,'rgba(255,253,231,1)');gradient.addColorStop(.82,'rgba(255,251,222,1)');gradient.addColorStop(.91,'rgba(255,237,186,.96)');gradient.addColorStop(1,'rgba(255,237,186,0)');}
    else{gradient.addColorStop(0,'rgba(255,245,222,.8)');gradient.addColorStop(.1,'rgba(255,233,193,.42)');gradient.addColorStop(.34,'rgba(255,217,169,.13)');gradient.addColorStop(1,'rgba(255,215,173,0)');}
    ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function cloudTexture(){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
  // Many feathered billows give a soft irregular silhouette without image assets.
  for(let n=0;n<68;n++){
    const a=hash(n,81)*Math.PI*2,r=Math.sqrt(hash(n,82)),x=256+Math.cos(a)*r*175,y=132+Math.sin(a)*r*55;
    const rx=22+hash(n,83)*52,ry=15+hash(n,84)*40;
    ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'rgba(255,255,255,.30)');g.addColorStop(.42,'rgba(255,255,255,.21)');g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
const SKY_VERTEX=`varying vec3 vDirection;
void main(){vDirection=position;vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_Position=p.xyww;}`;
const SKY_FRAGMENT=`uniform vec3 zenith;uniform vec3 horizon;uniform vec3 nadir;uniform vec3 sunDirection;uniform vec3 duskColor;uniform float dusk;uniform float daylight;uniform float flash;varying vec3 vDirection;
void main(){vec3 d=normalize(vDirection);float up=max(d.y,0.0);vec3 col=mix(horizon,zenith,pow(up,.48));col=mix(col,nadir,(1.0-smoothstep(-.32,0.0,d.y)));float sunward=pow(max(dot(d,sunDirection),0.0),5.0);float haze=exp(-abs(d.y)*7.0);col+=duskColor*dusk*haze*(.16+.72*sunward);col+=vec3(1.0,.89,.68)*pow(max(dot(d,sunDirection),0.0),28.0)*.105*daylight;col+=vec3(.55,.62,.78)*flash*.34;gl_FragColor=vec4(col,1.0);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
const RAIN_VERTEX=`attribute float variation;uniform float snow;uniform float pixelRatio;varying float vFade;varying float vVariation;
void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(mix(65.0,45.0,snow)*pixelRatio/max(2.0,-mv.z),1.0,mix(17.0,10.0,snow));vFade=clamp(-mv.z*.12,0.0,1.0)*clamp((29.0+mv.z)/9.0,0.0,1.0);vVariation=variation;}`;
const RAIN_FRAGMENT=`uniform vec3 color;uniform float opacity;uniform float snow;varying float vFade;varying float vVariation;
void main(){vec2 uv=gl_PointCoord-.5;float rain=(1.0-smoothstep(.07,.16,abs(uv.x+uv.y*.16)))*(1.0-smoothstep(.22,.5,abs(uv.y)));float flake=1.0-smoothstep(.12,.49,length(uv));float a=mix(rain,flake,snow)*opacity*vFade*(.55+vVariation*.45);if(a<.012)discard;gl_FragColor=vec4(color,a);
#include <colorspace_fragment>
}`;

/**
 * Visual atmosphere owns only objects/materials it creates. Existing lights remain owned by the caller.
 * update() leaves fog and the scene background untouched underwater.
 * Environment values can drive audio, exposure survival, or terrain wet-surface uniforms.
 */
export class Atmosphere {
  constructor({scene,renderer,camera,world,hemi,sunlight}){
    Object.assign(this,{scene,renderer,camera,world,hemi,sunlight});this.climate=new WeatherClimate(world?.seed);
    this.root=new THREE.Group();this.root.name='Astra atmosphere';scene.add(this.root);this.disposed=false;
    this.elapsed=0;this.shelterClock=0;this.sheltered=false;this.roofCache=new Map();this.lastRevision=-1;
    this.precipitationKind='rain';this.flash=0;this.lightningWait=8;this.lightningIndex=0;this.lastPosition=new THREE.Vector3();
    this.sunDirection=new THREE.Vector3();this.tmpColor=new THREE.Color();this.fogColor=new THREE.Color();
    this.skyUniforms={zenith:{value:new THREE.Color()},horizon:{value:new THREE.Color()},nadir:{value:new THREE.Color()},sunDirection:{value:this.sunDirection},duskColor:{value:new THREE.Color('#eaa074')},dusk:{value:0},daylight:{value:1},flash:{value:0}};
    this.sky=new THREE.Mesh(new THREE.SphereGeometry(1,40,24),new THREE.ShaderMaterial({uniforms:this.skyUniforms,vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT,side:THREE.BackSide,depthWrite:false,depthTest:false,fog:false}));
    this.sky.scale.setScalar(175);this.sky.renderOrder=-1000;this.sky.frustumCulled=false;this.root.add(this.sky);
    this.textures=[radialTexture('sun'),radialTexture('moon'),radialTexture('glow'),cloudTexture()];
    const makeSprite=(texture,size,additive=false)=>{const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,fog:false,toneMapped:false,blending:additive?THREE.AdditiveBlending:THREE.NormalBlending});const sprite=new THREE.Sprite(material);sprite.scale.set(size,size,1);sprite.renderOrder=-980;this.root.add(sprite);return sprite;};
    this.sun=makeSprite(this.textures[0],8);this.sunGlow=makeSprite(this.textures[2],44,true);this.moon=makeSprite(this.textures[1],6.8);this.moonGlow=makeSprite(this.textures[2],24,true);this.moonGlow.material.color.set('#c1d7ff');
    const starPositions=[],starColors=[];
    for(let n=0;n<820;n++){const az=hash(n,14)*Math.PI*2,el=Math.asin(hash(n,15)*.99+.005),r=165;starPositions.push(Math.cos(az)*Math.cos(el)*r,Math.sin(el)*r,Math.sin(az)*Math.cos(el)*r);const bright=.45+hash(n,16)*.55;starColors.push(bright*.87,bright*.93,bright);}
    const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));starGeometry.setAttribute('color',new THREE.Float32BufferAttribute(starColors,3));
    this.stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({size:.38,vertexColors:true,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));this.stars.renderOrder=-990;this.root.add(this.stars);
    this.cloudGeometry=new THREE.PlaneGeometry(1,1);this.cloudMaterial=new THREE.MeshBasicMaterial({map:this.textures[3],color:'#ffffff',transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false,opacity:.84});this.clouds=[];
    for(let n=0;n<34;n++){const cloud=new THREE.Mesh(this.cloudGeometry,this.cloudMaterial);cloud.rotation.x=-Math.PI/2;cloud.rotation.z=hash(n,21)*Math.PI;cloud.scale.set(46+hash(n,22)*46,26+hash(n,23)*22,1);cloud.userData={x:hash(n,24)*300-150,z:hash(n,25)*300-150,y:65+hash(n,26)*27};cloud.renderOrder=-950;this.root.add(cloud);this.clouds.push(cloud);}
    this.particleCount=1050;this.particlePositions=new Float32Array(this.particleCount*3);this.particleVariations=new Float32Array(this.particleCount);this.particleFloor=new Float32Array(this.particleCount);this.particleSpawn=new Uint32Array(this.particleCount);
    for(let n=0;n<this.particleCount;n++){this.particleVariations[n]=hash(n,35);this.particlePositions[n*3+1]=-999;}
    const rainGeometry=new THREE.BufferGeometry();rainGeometry.setAttribute('position',new THREE.BufferAttribute(this.particlePositions,3).setUsage(THREE.DynamicDrawUsage));rainGeometry.setAttribute('variation',new THREE.BufferAttribute(this.particleVariations,1));
    this.rainUniforms={color:{value:new THREE.Color('#c9e0ed')},opacity:{value:0},snow:{value:0},pixelRatio:{value:renderer.getPixelRatio()}};
    this.rain=new THREE.Points(rainGeometry,new THREE.ShaderMaterial({uniforms:this.rainUniforms,vertexShader:RAIN_VERTEX,fragmentShader:RAIN_FRAGMENT,transparent:true,depthWrite:false,fog:false}));this.rain.frustumCulled=false;this.rain.visible=false;scene.add(this.rain);
    // One small line geometry is reused for the rare distant lightning strike.
    const bolt=new Float32Array(12*3);const boltGeometry=new THREE.BufferGeometry();boltGeometry.setAttribute('position',new THREE.BufferAttribute(bolt,3).setUsage(THREE.DynamicDrawUsage));
    this.lightning=new THREE.Line(boltGeometry,new THREE.LineBasicMaterial({color:0xe7efff,transparent:true,opacity:0,depthWrite:false,fog:false,toneMapped:false}));this.lightning.frustumCulled=false;scene.add(this.lightning);
    sunlight.shadow.mapSize.set(1024,1024);Object.assign(sunlight.shadow.camera,{left:-34,right:34,top:34,bottom:-34,near:.5,far:190});sunlight.shadow.camera.updateProjectionMatrix();// The 68 m / 1024 px shadow map needs about one texel of receiver offset.
    // A little depth bias also stabilizes broad snowy faces at low sun angles.
    sunlight.shadow.bias=-.00035;sunlight.shadow.normalBias=.085;sunlight.shadow.radius=2;
    if(!sunlight.target.parent){scene.add(sunlight.target);this.ownsLightTarget=true;}
    this.state={daylight:1,night:false,weather:'clear',temperature:20,wind:.18,precipitation:0,sheltered:false,wetness:0};
  }
  setWeather(mode,immediate=false){const changed=this.climate.setWeather(mode);if(changed&&immediate&&mode!=='auto'){this.climate.precipitation=WEATHER_STRENGTH[mode];this.climate.wind=mode==='storm'?.82:mode==='clear'?.18:.42;}return changed;}
  setWorld(world){this.world=world;this.climate=new WeatherClimate(world?.seed);this.roofCache.clear();this.shelterClock=0;this.lastRevision=-1;this.particlePositions.fill(-999);this.elapsed=0;this.flash=0;this.lightningWait=8;this.precipitationKind='rain';}
  serialize(){return this.climate.serialize();}
  restore(data){this.climate.restore(data);this.elapsed=this.climate.elapsed;this.precipitationKind=this.climate.weather==='snow'?'snow':'rain';}
  roofHeight(x,z){
    x=Math.floor(x);z=Math.floor(z);const key=`${x},${z}`;if(this.roofCache.has(key))return this.roofCache.get(key);
    let roof=-1;for(let y=HEIGHT-1;y>=0;y--){const id=this.world.get(x,y,z);if(id&&id!==27){roof=y+1;break;}}
    if(this.roofCache.size>1600)this.roofCache.clear();this.roofCache.set(key,roof);return roof;
  }
  checkShelter(position){
    const x=Math.floor(position.x),z=Math.floor(position.z),y=Math.ceil(position.y+1.6);
    for(let h=y;h<HEIGHT;h++){const id=this.world.get(x,h,z);if(id&&id!==7&&id!==27)return true;}
    return false;
  }
  spawnParticle(n,position,initial=false){
    const cycle=++this.particleSpawn[n],offset=n*3;
    const x=position.x+(hash(n,cycle*3+201)-.5)*39,z=position.z+(hash(n,cycle*3+202)-.5)*39;
    this.particlePositions[offset]=x;this.particlePositions[offset+1]=position.y+(initial?hash(n,cycle*3+203)*25-3:22+hash(n,cycle*3+203)*4);this.particlePositions[offset+2]=z;
    this.particleFloor[n]=this.roofHeight(x,z);if(this.particlePositions[offset+1]<this.particleFloor[n])this.particlePositions[offset+1]=-999;
  }
  updateParticles(dt,position,state,quality){
    const count=quality==='low'?350:quality==='medium'?650:this.particleCount;
    this.rain.geometry.setDrawRange(0,Math.ceil(count*state.precipitation));
    if(state.weather!=='clear')this.precipitationKind=state.weather;
    const snow=this.precipitationKind==='snow';
    this.rain.visible=state.precipitation>.015;this.rainUniforms.snow.value=snow?1:0;this.rainUniforms.opacity.value=.24+state.precipitation*.34;
    this.rainUniforms.color.value.set(snow?'#f0f5ff':'#b8d4e5');this.rainUniforms.pixelRatio.value=this.renderer.getPixelRatio();
    if(!this.rain.visible)return;
    for(let n=0;n<count;n++){
      const k=n*3,x=this.particlePositions[k],y=this.particlePositions[k+1],z=this.particlePositions[k+2];
      if(y<position.y-4||y<this.particleFloor[n]||Math.abs(x-position.x)>22||Math.abs(z-position.z)>22){this.spawnParticle(n,position,y===-999);continue;}
      this.particlePositions[k]+=dt*(state.wind*(snow?2.5:4)+Math.sin(this.elapsed*1.3+n)*(snow?.65:.15));
      this.particlePositions[k+1]-=dt*(snow?1.4+this.particleVariations[n]*1.1:18+this.particleVariations[n]*8);
      this.particlePositions[k+2]+=dt*Math.sin(this.elapsed*.12)*(snow?1:2)*state.wind;
      // Roof cache also catches rain blown sideways beneath overhangs.
      this.particleFloor[n]=this.roofHeight(this.particlePositions[k],this.particlePositions[k+2]);
      const id=this.world.get(Math.floor(this.particlePositions[k]),Math.floor(this.particlePositions[k+1]),Math.floor(this.particlePositions[k+2]));
      if((id&&id!==27)||this.particlePositions[k+1]<this.particleFloor[n]){this.particlePositions[k+1]=-999;}
    }
    this.rain.geometry.attributes.position.needsUpdate=true;
  }
  updateLightning(dt,position,state){
    this.flash=Math.max(0,this.flash-dt*4.5);this.lightningWait-=dt;
    if(state.weather==='storm'&&state.precipitation>.7&&this.lightningWait<=0){
      this.lightningIndex++;this.lightningWait=7+hash(this.lightningIndex,451,this.climate.seed)*16;this.flash=1;
      const a=hash(this.lightningIndex,452,this.climate.seed)*Math.PI*2,x=position.x+Math.cos(a)*55,z=position.z+Math.sin(a)*55,points=this.lightning.geometry.attributes.position.array;
      for(let n=0;n<12;n++){points[n*3]=x+(hash(n,this.lightningIndex+460)-.5)*(n?7:0);points[n*3+1]=85-n*5;points[n*3+2]=z+(hash(n,this.lightningIndex+480)-.5)*4;}
      this.lightning.geometry.attributes.position.needsUpdate=true;
    }
    this.lightning.visible=this.flash>.05;this.lightning.material.opacity=this.flash;this.skyUniforms.flash.value=this.flash;
  }
  update(dt,{position,timeOfDay=.17,biome,paused=false,submerged=false,quality='high',viewDistance=72}={}){
    if(this.disposed)return this.state;
    position=position||this.camera.position;dt=clamp(numeric(dt,0),0,.25);const simDt=paused?0:dt;this.elapsed+=simDt;
    if(this.lastRevision!==this.world.revision){this.roofCache.clear();this.lastRevision=this.world.revision;this.shelterClock=0;}
    this.shelterClock-=dt;if(this.shelterClock<=0){this.shelterClock=.3;this.sheltered=this.checkShelter(position);}
    const state=this.climate.update(simDt,{timeOfDay,biome:biome||this.world.biome(position.x,position.z),height:position.y,sheltered:this.sheltered,paused});
    const a=timeOfDay*Math.PI*2,altitude=Math.sin(a),daylight=smooth(-.12,.36,altitude),night=altitude<-.12,dusk=(1-smooth(.0,.48,Math.abs(altitude)))*(.6+daylight*.4);
    Object.assign(this.state,state,{daylight,night});this.sunDirection.set(Math.cos(a)*.94,altitude,-.24).normalize();
    const overcast=state.precipitation*(state.weather==='storm'?.94:.68),uniforms=this.skyUniforms;
    uniforms.daylight.value=daylight;uniforms.dusk.value=dusk*(1-overcast*.8);
    uniforms.zenith.value.set('#111c35').lerp(this.tmpColor.set('#377bc1'),daylight).lerp(this.tmpColor.set('#687d8b'),overcast*daylight);
    uniforms.horizon.value.set('#313e5a').lerp(this.tmpColor.set('#c0ddef'),daylight).lerp(this.tmpColor.set('#81919a'),overcast*daylight);
    uniforms.nadir.value.copy(uniforms.horizon.value).multiplyScalar(.84);
    this.root.position.copy(this.camera.position);this.stars.rotation.y=this.elapsed*.000035;
    const horizonFade=smooth(-.055,.08,altitude),moonFade=smooth(-.05,.12,-altitude);
    this.sun.position.copy(this.sunDirection).multiplyScalar(151);this.sunGlow.position.copy(this.sun.position);this.sun.material.opacity=horizonFade*(1-overcast*.95);this.sunGlow.material.opacity=horizonFade*(1-overcast)*(.65+dusk*.35);this.sun.material.color.set('#fff1cf').lerp(this.tmpColor.set('#ffb96f'),dusk*.55);
    this.moon.position.copy(this.sunDirection).multiplyScalar(-150);this.moonGlow.position.copy(this.moon.position);this.moon.material.opacity=moonFade*(1-overcast*.91);this.moonGlow.material.opacity=moonFade*.24*(1-overcast);
    this.stars.material.opacity=Math.pow(1-daylight,2)*(1-overcast*.95)*.95;
    this.cloudMaterial.color.set('#44506e').lerp(this.tmpColor.set('#fffaf0'),daylight).lerp(this.tmpColor.set('#c7a188'),dusk*.28).lerp(this.tmpColor.set('#73808b'),overcast*.82);this.cloudMaterial.opacity=.62+overcast*.29;
    const cloudWind=this.elapsed*(.45+state.wind*.4);
    for(let n=0;n<this.clouds.length;n++){
      const cloud=this.clouds[n],p=cloud.userData;
      cloud.position.set(((p.x+cloudWind-this.camera.position.x)%300+450)%300-150,p.y-this.camera.position.y,((p.z+cloudWind*.22-this.camera.position.z)%300+450)%300-150);
      cloud.visible=!submerged&&(quality!=='low'||n%2===0);
    }
    const underground=this.sheltered&&position.y<this.world.height(position.x,position.z)-2;
    this.hemi.color.set('#aabde3').lerp(this.tmpColor.set('#d2e7ff'),daylight);this.hemi.groundColor.set('#25364d').lerp(this.tmpColor.set('#727765'),daylight);
    this.hemi.intensity=(underground?.2:.55+daylight*1.8)*(1-overcast*.22)+this.flash*.5;
    this.sunlight.color.set('#b6c9f3').lerp(this.tmpColor.set('#fff2d7'),daylight).lerp(this.tmpColor.set('#ffc08a'),dusk*.65);
    this.sunlight.intensity=(underground?.045:.22+daylight*2.8)*(1-overcast*.77)+this.flash*2.2;
    const shadowDirection=this.shadowDirection||(this.shadowDirection=new THREE.Vector3());shadowDirection.copy(this.sunDirection);if(night)shadowDirection.multiplyScalar(-1);shadowDirection.y=Math.max(Math.tan(Math.PI/18)*Math.hypot(shadowDirection.x,shadowDirection.z),shadowDirection.y);shadowDirection.normalize();
    const snap=.0625;this.sunlight.target.position.set(Math.round(position.x/snap)*snap,position.y+2,Math.round(position.z/snap)*snap);this.sunlight.position.copy(this.sunlight.target.position).addScaledVector(shadowDirection,100);this.sunlight.target.updateMatrixWorld();
    this.sunlight.castShadow=quality!=='low';
    if(!submerged){
      this.fogColor.copy(uniforms.horizon.value).lerp(this.tmpColor.set('#dcab86'),dusk*.16*(1-overcast));
      if(!this.scene.fog||!this.scene.fog.isFog)this.scene.fog=new THREE.Fog(this.fogColor,25,viewDistance);
      this.scene.fog.color.copy(this.fogColor);this.scene.fog.near=Math.max(10,viewDistance*(.52-overcast*.25));this.scene.fog.far=Math.max(24,viewDistance*(1-overcast*.32));
      if(this.scene.background?.isColor)this.scene.background.copy(this.fogColor);
    }
    this.sky.visible=!submerged;this.sun.visible=this.sunGlow.visible=!submerged;this.moon.visible=this.moonGlow.visible=!submerged;this.stars.visible=!submerged;
    this.updateParticles(simDt,position,state,quality);if(submerged)this.rain.visible=false;
    this.updateLightning(simDt,position,state);if(submerged)this.lightning.visible=false;
    this.lastPosition.set(position.x,position.y,position.z);this.state.flash=this.flash;return this.state;
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.scene.remove(this.root,this.rain,this.lightning);if(this.ownsLightTarget)this.scene.remove(this.sunlight.target);
    const geometries=new Set(),materials=new Set();for(const object of [this.root,this.rain,this.lightning])object.traverse(child=>{if(child.geometry)geometries.add(child.geometry);if(child.material)materials.add(child.material);});
    for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of this.textures)texture.dispose();this.roofCache.clear();
  }
}
