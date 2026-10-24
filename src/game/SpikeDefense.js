import {havenNavigation,moveHaven} from './haven-map.js';
import {survivalNavigation,SURVIVAL_ENTRIES} from './survival-map.js';
import {cameraYawFor,defenderLine,facingHeading,headingOfView,headingTo,waveSpawnPoints} from './defense-spawns.js';
const WAVE_SIZE=5;
/** Player plus a bot partner, or up to four friends in a room. */
const DEFENDER_COUNT=4;
export const spikeDifficulties={basic:{name:'Básico',speed:1.8,reaction:.85,interval:1.05,accuracy:.4,head:.04},hard:{name:'Difícil',speed:2.4,reaction:.4,interval:.65,accuracy:.7,head:.14},vct:{name:'VCT AIMER',speed:3.1,reaction:.12,interval:.22,accuracy:.99,head:.78}};
export function resetSpike(s,{difficulty='basic',partner='solo',spawn=null}={}){
 const survival=s.mode===12;
 s.navigation=survival?survivalNavigation:havenNavigation;
 // a spawn the player picked from the pause menu ("Aparecer aquí"), if it is still walkable
 const custom=spawn&&Number.isFinite(spawn.x)&&Number.isFinite(spawn.z)&&s.navigation.canWalk(spawn.x,spawn.z);
 const havenSpawn=custom?{x:spawn.x,z:spawn.z}:s.navigation.spawn,havenSpike=s.navigation.objective;
 s.spike={...havenSpike,defuse:0,outcome:null,difficulty,partner,survival,phase:'wave',wave:1,restLeft:0};s.health=150;s.hurtUntil=0;
 // survival: look at the doorways the attackers walk in through; Haven: look at the spike
 const front=survival?facingHeading(havenSpawn,SURVIVAL_ENTRIES.flatMap(entry=>entry.slots)):headingTo(havenSpawn,havenSpike);
 s.yaw=custom&&Number.isFinite(spawn.yaw)?spawn.yaw:cameraYawFor(front);
 const line=defenderLine(havenSpawn,s.yaw,DEFENDER_COUNT,s.navigation.nearest);
 const slot=partner==='friend'?s.defenderSlot||0:0;
 s.position={...(slot>0&&line[slot]?line[slot]:havenSpawn),y:1.65};
 s.companion=partner==='bot'?{...line[1],y:1.65,hp:150,nextShot:1.5,yaw:headingOfView(s.yaw)}:null;
 s.remotePlayer=null;s.remoteStats={};s.remotePlayers={};
 spawnDefenseWave(s);

}
export function spawnDefenseWave(s){
 const goal=s.spike.survival?s.position:s.spike;
 const points=s.spike.survival?waveSpawnPoints(SURVIVAL_ENTRIES,s.spike.wave,WAVE_SIZE):s.navigation.randomSpawns(s.random);
 s.targets=points.map((p,id)=>({id,x:p.x,z:p.z,yaw:headingTo(p,goal),y:1.65,hp:150+(s.spike.survival?(s.spike.wave-1)*12:0),dead:false,born:s.elapsed,generation:s.spike.wave,path:s.navigation.path(p,goal),pathAt:0,nextPathAt:s.elapsed+1.5,nextShot:s.elapsed+1.8+id*.3,reactionAt:0,lastVictim:null,weapon:'vandal'}));
}
export function damageSpikeBot(s,target,part,damage,owner='self'){
 target.hp=Math.max(0,target.hp-damage);
 s.emit('impact',{id:target.id,part});
 if(target.hp===0){
  if(owner==='self'){s.eliminate(target,part);s.score+=100;}
  else{target.dead=true;target.respawnAt=Infinity;s.emit('kill',{id:target.id,part,x:target.x,y:target.y,z:target.z,owner});if(owner?.userId){const stats=s.remoteStats[owner.userId];stats.hits++;stats.score+=100;if(part==='head')stats.headshots++;}}
 }
}
function defendResult(s,outcome){s.spike.outcome=outcome;s.status='finished';if(outcome==='defended')s.score+=500;}
export function tickSpike(s,dt){
 if(s.networkRole==='guest')return;
 const base=spikeDifficulties[s.spike.difficulty]||spikeDifficulties.basic;
 const progression=s.spike.survival?Math.min(1,(s.spike.wave-1)*.04):0;
 const d={...base,speed:base.speed*(1+progression*.45),interval:Math.max(.14,base.interval/(1+progression)),accuracy:Math.min(.99,base.accuracy+progression*.18)};
 if(s.health<=0 && !s.companion?.hp && !Object.values(s.remotePlayers||{}).some(p=>p.hp>0)){defendResult(s,'eliminated');return;}
 const live=s.targets.filter(t=>!t.dead);
 if(!live.length){
  if(!s.spike.survival){defendResult(s,'defended');return;}
  if(s.spike.phase!=='rest'){s.spike.phase='rest';s.spike.restLeft=8;s.score+=250;s.health=s.health>0?Math.min(150,s.health+25):s.health;s.ammo=s.weapon.mag;s.reloadLeft=0;if(s.companion)s.companion.hp=Math.min(150,s.companion.hp+25);}
  s.spike.restLeft=Math.max(0,s.spike.restLeft-dt);
  if(s.spike.restLeft===0){s.spike.wave++;s.spike.phase='wave';spawnDefenseWave(s);}
  return;
 }
 let defusing=false;
 for(const bot of live){
  const defenders=[...(s.health>0?[{...s.position,hp:s.health,kind:'self'}]:[]),...(s.companion?.hp>0?[{...s.companion,kind:'ally'}]:[]),...Object.entries(s.remotePlayers||{}).filter(([,p])=>p.hp>0).map(([id,p])=>({...p,kind:id}))];
  const visible=defenders.filter(p=>Math.hypot(p.x-bot.x,p.z-bot.z)<25&&!s.navigation.blocked(bot,p)).sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z));
  const victim=visible[0];
  if(victim){
   if(bot.lastVictim!==victim.kind){bot.lastVictim=victim.kind;bot.reactionAt=s.elapsed+d.reaction;}
   bot.yaw=Math.atan2(victim.x-bot.x,victim.z-bot.z);
   if(s.elapsed>=Math.max(bot.nextShot,bot.reactionAt)){
    bot.nextShot=s.elapsed+d.interval;
    const hit=s.random()<d.accuracy*(victim.kind==='self'&&s.moveSpeed>3?.78:1);
    s.emit('enemy-shot',{x:bot.x,y:1.35,z:bot.z,to:{x:victim.x,y:victim.y||1.3,z:victim.z},hit});
    if(hit){const amount=s.random()<d.head?160:40;if(victim.kind==='self'){s.health=Math.max(0,s.health-amount);s.hurtUntil=s.elapsed+.18;}else if(victim.kind==='ally')s.companion.hp=Math.max(0,s.companion.hp-amount);else s.remotePlayers[victim.kind].hp=Math.max(0,s.remotePlayers[victim.kind].hp-amount);}
   }
  }else bot.lastVictim=null;
  if(s.elapsed<1.5+bot.id*.25)continue;
  if(s.spike.survival && s.elapsed>=bot.nextPathAt){const target=defenders.sort((a,b)=>Math.hypot(a.x-bot.x,a.z-bot.z)-Math.hypot(b.x-bot.x,b.z-bot.z))[0];if(target){bot.path=s.navigation.path(bot,target);bot.pathAt=0;}bot.nextPathAt=s.elapsed+1.2;}
  const distance=Math.hypot(bot.x-s.spike.x,bot.z-s.spike.z);
  if(!s.spike.survival && distance<1.25){if(!defusing){s.spike.defuse+=dt;defusing=true;}continue;}
  const waypoint=bot.path[bot.pathAt];
  if(waypoint){const dx=waypoint.x-bot.x,dz=waypoint.z-bot.z,len=Math.hypot(dx,dz);if(len<.12)bot.pathAt++;else{const step=Math.min(len,d.speed*dt);bot.x+=dx/len*step;bot.z+=dz/len*step;if(!victim)bot.yaw=Math.atan2(dx,dz);}}
 }
 if(!defusing)s.spike.defuse=Math.max(0,s.spike.defuse-dt*.5);
 if(s.spike.defuse>=7){defendResult(s,'defused');return;}
 const ally=s.companion;
 if(ally?.hp>0 && s.elapsed>=ally.nextShot){
  const enemy=live.find(t=>!s.navigation.blocked(ally,t)&&Math.hypot(t.x-ally.x,t.z-ally.z)<24);
  ally.nextShot=s.elapsed+.65;
  if(enemy){ally.yaw=Math.atan2(enemy.x-ally.x,enemy.z-ally.z);s.emit('ally-shot',{x:ally.x,y:1.3,z:ally.z,to:{x:enemy.x,y:1.3,z:enemy.z}});if(s.random()<.72)damageSpikeBot(s,enemy,'body',40,'ally');}
 }
 if(!s.spike.survival && s.remaining===0)defendResult(s,'exploded');
}
export {moveHaven};
