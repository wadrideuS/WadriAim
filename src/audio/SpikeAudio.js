export class SpikeAudio {
 constructor(){this.audio=new Audio(import.meta.env.BASE_URL+'audio/spike/timer.mp3');this.audio.preload='auto';this.audio.preservesPitch=true;}
 async unlock(){try{this.audio.muted=true;await this.audio.play();this.audio.pause();this.audio.currentTime=0;}catch{}finally{this.audio.muted=false;}}
 sync(session,{volume=.35,muted=false}={}){
  this.audio.volume=volume;this.audio.muted=muted;
  if(session.mode!==11 || session.status!=='running' || session.elapsed<9){this.audio.pause();return;}
  const rate=Number.isFinite(this.audio.duration)&&this.audio.duration>0?this.audio.duration/51:1.01257;
  this.audio.playbackRate=rate;
  const expected=(session.elapsed-9)*rate;
  if(Math.abs(this.audio.currentTime-expected)>.22)this.audio.currentTime=Math.max(0,expected);
  if(this.audio.paused)void this.audio.play().catch(()=>{});
 }
 pause(){this.audio.pause();}
 stop(){this.audio.pause();this.audio.currentTime=0;}
 dispose(){this.stop();this.audio.removeAttribute('src');this.audio.load();}
}
