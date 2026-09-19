// Original procedural audio: no recordings or remote assets.
export class Ambience {
  constructor(){this.context=null;this.enabled=true;this.volume=.55;this.stepClock=0;this.birdClock=2;this.fireClock=0;this.lastFlash=0;}
  start(){
    if(!this.enabled)return;
    try{
      if(!this.context){
        const ctx=this.context=new (window.AudioContext||window.webkitAudioContext)();
        this.master=ctx.createGain();this.master.gain.value=this.volume*.45;this.master.connect(ctx.destination);
        this.buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate);const data=this.buffer.getChannelData(0);let n=0;
        for(let i=0;i<data.length;i++){n=(n+(Math.random()*2-1)*.13)/1.025;data[i]=n*2.3;}
        this.layers={};
        for(const [name,freq,type] of [['wind',350,'lowpass'],['rain',2600,'highpass'],['water',900,'bandpass']]){
          const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.buffer;source.loop=true;source.playbackRate.value=name==='rain'?2:name==='water'?.6:1;filter.type=type;filter.frequency.value=freq;filter.Q.value=.3;gain.gain.value=0;source.connect(filter).connect(gain).connect(this.master);source.start();this.layers[name]={gain,filter};
        }
      }
      if(this.context.state==='suspended')this.context.resume().catch(()=>{});
    }catch(e){this.enabled=false;}
  }
  setEnabled(enabled){this.enabled=enabled;if(enabled)this.start();if(this.master)this.master.gain.setTargetAtTime(enabled?this.volume*.45:0,this.context.currentTime,.15);}
  setVolume(value){this.volume=Math.max(0,Math.min(1,Number(value)||0));if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume*.45:0,this.context.currentTime,.1);}
  noise({frequency=400,duration=.13,volume=.2,rate=1,type='lowpass',delay=0}={}){
    if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime+delay,source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();source.buffer=this.buffer;source.playbackRate.value=rate;filter.type=type;filter.frequency.value=frequency;filter.Q.value=.6;gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);source.connect(filter).connect(gain).connect(this.master);source.start(t,Math.random());source.stop(t+duration+.02);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  }
  tone(frequency,end,duration,volume=.06,type='sine',pan=0){
    if(!this.enabled||!this.context)return;const ctx=this.context,t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),panner=ctx.createStereoPanner();osc.type=type;osc.frequency.setValueAtTime(frequency,t);osc.frequency.exponentialRampToValueAtTime(Math.max(1,end),t+duration);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(volume,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);panner.pan.value=pan;osc.connect(gain).connect(panner).connect(this.master);osc.start();osc.stop(t+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();panner.disconnect();};
  }
  action(kind){
    this.start();if(kind==='pickup'||kind==='craft'){this.tone(kind==='pickup'?540:440,kind==='pickup'?790:660,.12,.09,'sine');return;}
    if(kind==='eat'||kind==='drink'){this.noise({frequency:kind==='drink'?1100:1800,duration:.22,volume:.3});return;}
    this.noise({frequency:kind==='hurt'?200:kind==='break'?650:1100,duration:kind==='break'?.19:.11,volume:kind==='hurt'?.7:.4,rate:.8+Math.random()*.5});
  }
  update(dt,{active,weather,flash=0,wind=0,precipitation=0,daylight=1,sheltered=false,submerged=false,nearWater=false,nearFire=false,moving=false,running=false,grounded=false,groundBlock=1}={}){
    if(!this.context)return;const t=this.context.currentTime,playing=active?1:0;
    this.layers.wind.gain.gain.setTargetAtTime(playing*(submerged?.06:(.015+wind*.07)*(sheltered?.2:1)),t,.4);
    this.layers.rain.gain.gain.setTargetAtTime(playing*precipitation*(weather==='snow'?.005:.13)*(sheltered?.25:1),t,.3);
    this.layers.water.gain.gain.setTargetAtTime(playing*(submerged?.12:nearWater?.065:0),t,.3);
    if(!active||!this.enabled)return;
    this.stepClock-=dt;this.birdClock-=dt;this.fireClock-=dt;
    if(moving&&grounded&&this.stepClock<=0){this.stepClock=running?.29:.44;this.noise({frequency:[1,2,6,12].includes(groundBlock)?430:[4,7].includes(groundBlock)?1300:2100,duration:groundBlock===7?.2:.085,volume:running?.26:.17,rate:.8+Math.random()*.3});}
    if(daylight>.5&&!submerged&&!sheltered&&precipitation<.2&&this.birdClock<=0){this.birdClock=3+Math.random()*8;const f=1800+Math.random()*1000;this.tone(f,f*1.45,.16,.022,'sine',Math.random()*1.8-.9);}
    if(nearFire&&this.fireClock<=0){this.fireClock=.12+Math.random()*.3;this.noise({frequency:900+Math.random()*2200,duration:.025+Math.random()*.04,volume:.05+Math.random()*.07,type:'highpass'});}
    if(flash>.5&&this.lastFlash<=.5)this.noise({frequency:130,duration:3,volume:.7,rate:.3,delay:.7});this.lastFlash=flash;
  }
}
