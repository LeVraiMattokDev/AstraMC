import * as THREE from './vendor/three.module.js';

// Shared, bounded GPU resources. Geometry belonging to a chunk is disposed with it.
export function createTerrainMaterials(atlas) {
  const terrain = new THREE.MeshStandardMaterial({map:atlas,vertexColors:true,roughness:.92,metalness:0});
  const uniforms={time:{value:0},wetness:{value:0},wind:{value:.25}};
  terrain.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{uTerrainTime:uniforms.time,uWetness:uniforms.wetness,uWind:uniforms.wind});
    shader.vertexShader='attribute float foliage;\nvarying vec3 vTerrainWorld; varying vec3 vTerrainNormal;\nuniform float uTerrainTime;\nuniform float uWind;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vec3 wp=(modelMatrix*vec4(position,1.0)).xyz;
      transformed.x+=foliage*sin(wp.x*.63+wp.z*.41+uTerrainTime*1.8)*(.012+uWind*.035);
      transformed.z+=foliage*cos(wp.x*.32+wp.z*.7+uTerrainTime*1.3)*(.01+uWind*.023);
      vTerrainWorld=wp;vTerrainNormal=normalize(mat3(modelMatrix)*normal);`);
    shader.fragmentShader='varying vec3 vTerrainWorld; varying vec3 vTerrainNormal;\nuniform float uWetness;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.34,uWetness*max(0.0,vTerrainNormal.y)*.7);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      diffuseColor.rgb*=1.0-uWetness*.16;`);
  };
  terrain.customProgramCacheKey=()=> 'astramc-terrain-v3';
  const glass=new THREE.MeshPhysicalMaterial({map:atlas,vertexColors:true,transparent:true,opacity:.7,roughness:.1,metalness:.03,depthWrite:false,side:THREE.DoubleSide});
  const waterUniforms={uTime:{value:0},uDay:{value:1},uRain:{value:0},uSun:{value:new THREE.Vector3(.4,.8,-.2)},uCamera:{value:new THREE.Vector3()},...THREE.UniformsUtils.clone(THREE.ShaderLib.basic.uniforms)};
  const water=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:true,uniforms:waterUniforms,
    vertexShader:`varying vec3 vWaterPosition;
      varying vec3 vWaterNormal;
      uniform float uTime;
      #include <fog_pars_vertex>
      void main(){
        vec3 p=position;
        vec3 wp=(modelMatrix*vec4(p,1.)).xyz;
        if(normal.y>.5){p.y+=sin(wp.x*.7+wp.z*.41+uTime*1.1)*.035+sin(wp.z*1.4-wp.x*.27+uTime*.8)*.018;}
        vWaterPosition=(modelMatrix*vec4(p,1.)).xyz;
        vWaterNormal=normal;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.);
        gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`uniform float uTime; uniform float uDay; uniform float uRain;
      uniform vec3 uSun; uniform vec3 uCamera;
      varying vec3 vWaterPosition; varying vec3 vWaterNormal;
      #include <common>
      #include <fog_pars_fragment>
      void main(){
        vec2 p=vWaterPosition.xz;
        float a=p.x*.7+p.y*.41+uTime*1.1;
        float b=p.y*1.4-p.x*.27+uTime*.8;
        vec3 n=normalize(vWaterNormal+vec3(cos(a)*.10+cos(b)*.04,0.,sin(b)*.09));
        vec3 eye=normalize(uCamera-vWaterPosition);
        float fresnel=pow(1.-max(0.,dot(eye,n)),3.);
        float glint=pow(max(0.,dot(reflect(-uSun,n),eye)),180.)*uDay;
        float ripple=sin(p.x*5.+sin(p.y*3.+uTime)*.5+uTime)*sin(p.y*5.1-uTime*.7);
        vec3 deep=mix(vec3(.012,.045,.075),vec3(.035,.25,.25),uDay);
        vec3 sky=mix(vec3(.07,.10,.18),vec3(.42,.66,.72),uDay);
        vec3 color=mix(deep,sky,fresnel*.82)+glint*vec3(1.,.85,.55)*1.6;
        color+=vec3(.035,.065,.06)*ripple*uDay*(.3+uRain);
        gl_FragColor=vec4(color,.64+fresnel*.25);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`});
  return {materials:[terrain,glass,water],update(dt,state,camera,timeOfDay){uniforms.time.value+=dt;uniforms.wetness.value=state.wetness||0;uniforms.wind.value=state.wind||.2;waterUniforms.uTime.value+=dt;waterUniforms.uDay.value=state.daylight??1;waterUniforms.uRain.value=state.precipitation||0;waterUniforms.uCamera.value.copy(camera.position);const a=timeOfDay*Math.PI*2;waterUniforms.uSun.value.set(Math.cos(a),Math.sin(a),-.3).normalize();}};
}

const palette={stone:0x62685e,wood:0x674c33,metal:0x4b5551,brass:0xba955a,ember:0xe96d24,glow:0xffd58c};
const utilityMaterials=Object.fromEntries(Object.entries(palette).map(([key,color])=>[key,new THREE.MeshStandardMaterial({color,roughness:key==='metal'||key==='brass'?.36:.86,metalness:key==='metal'||key==='brass'?.65:0,emissive:key==='glow'?color:key==='ember'?0xb84307:0,emissiveIntensity:key==='glow'?1.8:key==='ember'?.8:0})]));
function part(group,geometry,material,x,y,z){const mesh=new THREE.Mesh(geometry,utilityMaterials[material]);mesh.position.set(x,y,z);mesh.castShadow=material!=='glow';mesh.receiveShadow=true;group.add(mesh);return mesh;}
export function buildUtility(id){
  const group=new THREE.Group();
  if(id===29){
    for(let i=0;i<9;i++){const a=i*Math.PI*2/9;const rock=part(group,new THREE.DodecahedronGeometry(.14,0),'stone',.5+Math.cos(a)*.34,.1,.5+Math.sin(a)*.34);rock.scale.y=.65;rock.rotation.set(i*.7,i,0);}
    for(let i=0;i<3;i++){const log=part(group,new THREE.CylinderGeometry(.065,.085,.65,7),'wood',.5,.15,.5);log.rotation.set(Math.PI/2,0,i*Math.PI/3);}
    part(group,new THREE.SphereGeometry(.24,8,4),'ember',.5,.16,.5).scale.y=.2;
    const flame=part(group,new THREE.ConeGeometry(.17,.47,7),'glow',.5,.41,.5);flame.userData.flame=true;
  }else if(id===30){
    part(group,new THREE.BoxGeometry(.84,.49,.7),'wood',.5,.265,.5);
    part(group,new THREE.BoxGeometry(.9,.14,.76),'wood',.5,.58,.5);
    for(const x of [.19,.81])part(group,new THREE.BoxGeometry(.035,.59,.78),'metal',x,.335,.5);
    part(group,new THREE.BoxGeometry(.13,.16,.04),'brass',.5,.49,.9);
  }else if(id===31){
    part(group,new THREE.BoxGeometry(.29,.055,.29),'metal',.5,.06,.5);
    part(group,new THREE.BoxGeometry(.29,.055,.29),'metal',.5,.49,.5);
    part(group,new THREE.CylinderGeometry(.055,.055,.055,8),'brass',.5,.56,.5);
    for(const dx of [-.12,.12])for(const dz of [-.12,.12])part(group,new THREE.BoxGeometry(.025,.42,.025),'metal',.5+dx,.28,.5+dz);
    part(group,new THREE.BoxGeometry(.15,.32,.15),'glow',.5,.28,.5);
  }
  return group;
}
