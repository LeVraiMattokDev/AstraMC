import * as THREE from './vendor/three.module.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function noise(x,y,seed=0){let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^(seed|0);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function seedNumber(value){if(Number.isFinite(value))return value|0;let h=2166136261;for(const c of String(value??'Astra'))h=Math.imul(h^c.charCodeAt(0),16777619);return h|0;}

function barkTexture(endGrain=false){
  const size=64,data=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const random=noise(x,y,173),radius=Math.hypot(x-31.5,y-31.5);
    const groove=Math.sin(x*.9+Math.sin(y*.13+x*.18)*.3)+Math.sin(x*2.3)*.35;
    const rings=Math.sin(radius*1.3+noise(x>>3,y>>3,22)*.9);
    const light=endGrain?1+(rings*.065)+(random-.5)*.1: .79+groove*.15+(random-.5)*.15;
    const base=endGrain?[157,129,87]:[115,96,72],i=(y*size+x)*4;
    data[i]=clamp(base[0]*light,0,255);data[i+1]=clamp(base[1]*light,0,255);data[i+2]=clamp(base[2]*light,0,255);data[i+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

/** Decorative tree meshes centred on the original voxels, preserving mining targets.
 * build() inputs are integer voxel corners in local chunk coordinates. The returned
 * group stays at the origin, so its parent supplies the chunk's world translation.
 * Each mesh owns its geometry; materials/textures are shared until dispose().
 */
export class NaturalTrees {
  constructor(){
    this.time={value:0};this.wind={value:.4};
    this.barkTexture=barkTexture();this.endGrainTexture=barkTexture(true);
    this.leafMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.93,metalness:0});
    this.barkMaterial=new THREE.MeshStandardMaterial({color:0xffffff,map:this.barkTexture,roughness:.98,metalness:0});
    this.endMaterial=new THREE.MeshStandardMaterial({color:0xffffff,map:this.endGrainTexture,roughness:.95,metalness:0});
    this.leafMaterial.onBeforeCompile=shader=>{
      shader.uniforms.uNaturalTreeTime=this.time;shader.uniforms.uNaturalTreeWind=this.wind;
      shader.vertexShader='uniform float uNaturalTreeTime;\nuniform float uNaturalTreeWind;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        float naturalTreePhase = instanceMatrix[3].x * .61 + instanceMatrix[3].z * .43 + instanceMatrix[3].y * .19;
        float naturalTreeBend = max(0., position.y + .74) * uNaturalTreeWind;
        transformed.x += sin(uNaturalTreeTime * 1.45 + naturalTreePhase) * naturalTreeBend * .041;
        transformed.z += cos(uNaturalTreeTime * 1.17 + naturalTreePhase * .8) * naturalTreeBend * .026;
      `);
    };
    this.leafMaterial.customProgramCacheKey=()=> 'astramc-organic-tree-leaves-v1';
    this.matrix=new THREE.Matrix4();this.rotation=new THREE.Quaternion();this.axis=new THREE.Vector3(0,1,0);this.position=new THREE.Vector3();this.scale=new THREE.Vector3();this.color=new THREE.Color();
  }
  build(leaves=[],logs=[],{cx=0,cz=0,seed=0,biome='forest'}={}){
    const group=new THREE.Group();group.name='Natural trees';
    const seedId=seedNumber(seed),biomeId=typeof biome==='object'?biome?.id:biome;
    const baseColor=new THREE.Color(biomeId==='snow'?0x526d52:biomeId==='plains'?0x728746:0x5f7a46);
    if(leaves.length){
      // Icosahedra use just 20 triangles, giving soft, irregular canopy silhouettes.
      const geometry=new THREE.IcosahedronGeometry(.735,0);
      const mesh=new THREE.InstancedMesh(geometry,this.leafMaterial,leaves.length);mesh.name='Organic canopy';
      for(let i=0;i<leaves.length;i++){
        const [x,y,z]=leaves[i],wx=x+cx*16,wz=z+cz*16,r=noise(wx+y*31,wz-y*19,seedId);
        this.rotation.setFromAxisAngle(this.axis,r*Math.PI*.4);
        this.position.set(x+.5,y+.5,z+.5);
        this.scale.set(.95+noise(wx+y,wz,seedId+2)*.14,.93+noise(wx,wz+y,seedId+3)*.14,.95+noise(wx-y,wz,seedId+4)*.14);
        this.matrix.compose(this.position,this.rotation,this.scale);mesh.setMatrixAt(i,this.matrix);
        this.color.copy(baseColor).offsetHSL((r-.5)*.028,(r-.5)*.08,(r-.5)*.055);mesh.setColorAt(i,this.color);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;
      mesh.computeBoundingSphere();mesh.boundingSphere.radius+=.15;group.add(mesh);
    }
    if(logs.length){
      // Adjacent cylinders share radius and orientation along each trunk column.
      const geometry=new THREE.CylinderGeometry(.415,.415,1.025,7,1,false);
      const mesh=new THREE.InstancedMesh(geometry,[this.barkMaterial,this.endMaterial,this.endMaterial],logs.length);mesh.name='Natural bark trunks';
      for(let i=0;i<logs.length;i++){
        const [x,y,z]=logs[i],wx=x+cx*16,wz=z+cz*16,r=noise(wx,wz,seedId+17),radius=.97+r*.07;
        this.rotation.setFromAxisAngle(this.axis,r*Math.PI*.6);this.position.set(x+.5,y+.5,z+.5);this.scale.set(radius,1,radius);
        this.matrix.compose(this.position,this.rotation,this.scale);mesh.setMatrixAt(i,this.matrix);
        this.color.setRGB(.93+r*.07,.93+r*.07,.93+r*.07);mesh.setColorAt(i,this.color);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();group.add(mesh);
    }
    return group;
  }
  update(dt,wind=.4){
    this.time.value+=clamp(Number(dt)||0,0,.1);
    const strength=typeof wind==='number'?wind:wind?.strength??.4;
    this.wind.value=clamp(Number(strength)||0,0,2);
  }
  dispose(){
    this.leafMaterial.dispose();this.barkMaterial.dispose();this.endMaterial.dispose();this.barkTexture.dispose();this.endGrainTexture.dispose();
  }
}
