import {supabase} from '../account/service.js';
const checked=({data,error})=>{if(error)throw error;return data;};
export class SpikeRoom {
 constructor({mode=11,onMessage,onMembers,onError}){this.mode=mode;this.peerChannels=new Map();this.lastSeen=new Map();this.peers=[];this.onMessage=onMessage;this.onMembers=onMembers;this.onError=onError;this.channels=[];this.peer=null;this.ready=false;this.lastPeerAt=0;this.closed=false;}
 async open(code){
  if(!supabase)throw Error('Supabase no está configurado.');
  const {data}=await supabase.auth.getUser();if(!data.user)throw Error('Inicia sesión para jugar con un amigo.');this.userId=data.user.id;
  this.info=checked(await supabase.rpc(code?'join_spike_room':this.mode===12?'create_survival_room':'create_spike_room',code?{code:code.trim().toUpperCase()}:{}));this.host=this.info.host===this.userId;
  if(this.info.mode && this.info.mode!==this.mode)throw Error('La sala pertenece a otro modo. Abre '+(this.info.mode===12?'Supervivencia':'Haven')+' para unirte.');
  this.publisher=await this.subscribe(this.userId);
  await this.refresh();this.poll=setInterval(()=>void this.refresh().catch(e=>this.onError?.(e.message)),3000);
  return this.info;
 }
 async subscribe(sender){
  const channel=supabase.channel(`spike:${this.info.id}:${sender}`,{config:{private:true,broadcast:{self:false,ack:false}}});
  channel.on('broadcast',{event:'game'},({payload})=>{
    if(sender===this.userId||this.closed)return;
    this.lastPeerAt=performance.now();this.lastSeen.set(sender,this.lastPeerAt);this.onMessage?.(payload,sender);
  });
  this.channels.push(channel);
  await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('No se pudo conectar a la sala privada.')),12000);channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timeout);resolve();}else if(['CHANNEL_ERROR','TIMED_OUT'].includes(status)){clearTimeout(timeout);reject(Error('No se pudo conectar a la sala privada.'));}});});return channel;
 }
 async refresh(){
  if(this.closed)return;
  this.info=checked(await supabase.rpc('spike_room_info',{room:this.info.id}));
  this.peers=this.info.members.filter(m=>m.id!==this.userId);this.peer=this.peers[0]||null;
  const listen=this.host?this.peers:this.peers.filter(p=>p.id===this.info.host);
  for(const peer of listen)if(!this.peerChannels.has(peer.id)){this.peerChannels.set(peer.id,await this.subscribe(peer.id));this.lastSeen.set(peer.id,performance.now());}
  this.onMembers?.(this.info,this.host);
 }
 send(payload){if(!this.publisher||this.closed)return;void this.publisher.send({type:'broadcast',event:'game',payload}).catch(()=>{});}
 async close(){if(this.closed)return;this.closed=true;clearInterval(this.poll);for(const c of this.channels)void supabase.removeChannel(c);if(this.info)void supabase.rpc('leave_spike_room',{room:this.info.id});}
}
