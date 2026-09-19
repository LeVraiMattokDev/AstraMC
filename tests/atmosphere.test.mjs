import test from 'node:test';
import assert from 'node:assert/strict';
import {WeatherClimate,Atmosphere} from '../dist/atmosphere.js';

const tick=(weather,seconds,options={})=>{for(let i=0;i<seconds*4;i++)weather.update(.25,{timeOfDay:.25,biome:'forest',...options});};

test('weather changes gradually, stays bounded and dries after rain',()=>{
  const weather=new WeatherClimate('valley');weather.setWeather('storm');weather.update(.1,{});
  assert.ok(weather.precipitation>0&&weather.precipitation<.1);
  tick(weather,90);assert.ok(weather.precipitation>.99);assert.ok(weather.wetness>.9);assert.ok(weather.wind<1);
  weather.setWeather('clear');tick(weather,400);assert.ok(weather.precipitation<.001);assert.equal(weather.wetness,0);
});

test('weather and transitions continue deterministically after saving',()=>{
  const first=new WeatherClimate('river');tick(first,390);const restored=new WeatherClimate('river');restored.restore(first.serialize());
  tick(first,430);tick(restored,430);assert.deepEqual(restored.serialize(),first.serialize());
});

test('paused climate does not run while a menu is open',()=>{
  const weather=new WeatherClimate('snow');weather.setWeather('snow');tick(weather,17);const before=weather.serialize();
  tick(weather,60,{paused:true});assert.deepEqual(weather.serialize(),before);
});

test('being under a roof prevents getting wet during a sustained storm',()=>{
  const exposed=new WeatherClimate('rain'),sheltered=new WeatherClimate('rain');exposed.setWeather('rain');sheltered.setWeather('rain');
  tick(exposed,60);tick(sheltered,60,{sheltered:true});assert.ok(exposed.wetness>.4);assert.equal(sheltered.wetness,0);
});

test('snow biomes are colder and automatic precipitation follows the biome',()=>{
  const cold=new WeatherClimate('ice'),hot=new WeatherClimate('sand');cold.restore({mode:'auto',weather:'rain',remaining:300});
  tick(cold,40,{biome:{id:'snow'},height:40});tick(hot,40,{biome:{id:'desert'},height:15});
  assert.equal(cold.weather,'snow');assert.ok(cold.temperature<5);assert.ok(hot.temperature>35);
  cold.update(.25,{biome:'forest'});assert.equal(cold.weather,'rain');
});

test('corrupt climate save values cannot introduce nonfinite state',()=>{
  const weather=new WeatherClimate();weather.restore({mode:'broken',weather:'constructor',remaining:Infinity,elapsed:NaN,cycle:-400,temperature:-1000,precipitation:900,wetness:-900});
  assert.equal(weather.mode,'auto');assert.equal(weather.weather,'clear');
  for(const value of Object.values(weather.serialize()))if(typeof value==='number')assert.ok(Number.isFinite(value));
  assert.equal(weather.precipitation,1);assert.equal(weather.wetness,0);assert.equal(weather.setWeather('hail'),false);
});

test('shelter detection handles built roofs, transparent glass and clear skies',()=>{
  const instance=Object.create(Atmosphere.prototype);instance.world={get:(x,y,z)=>x===3&&z===4&&y===9?10:0};
  assert.equal(instance.checkShelter({x:3.5,y:5,z:4.5}),true);assert.equal(instance.checkShelter({x:3.5,y:10,z:4.5}),false);assert.equal(instance.checkShelter({x:5,y:5,z:4}),false);
});

test('precipitation hits the highest roof or water surface and caches column heights',()=>{
  let reads=0;const instance=Object.create(Atmosphere.prototype);instance.roofCache=new Map();instance.world={get:(x,y,z)=>{reads++;return y===8?7:0;}};
  assert.equal(instance.roofHeight(1.4,2.8),9);const before=reads;assert.equal(instance.roofHeight(1.7,2.1),9);assert.equal(reads,before);
});
