export const peekWalls=[
 {x:-6,z:-10,w:3.4,d:.55,h:3.2},
 {x:0,z:-15,w:5,d:.65,h:2.9},
 {x:6,z:-11.5,w:3.4,d:.55,h:3.2},
 {x:0,z:-21,w:8,d:.65,h:4.2},
 {x:-12,z:-12,w:.6,d:25,h:6},
 {x:12,z:-12,w:.6,d:25,h:6},
 {x:0,z:-25,w:24,d:.6,h:6},
];
// Several sides, heights and distances: no two live bots share a slot.
export const peekSlots=[
 {hiddenX:-5,visibleX:-3.55,z:-10.5,base:0},
 {hiddenX:1.8,visibleX:3.3,z:-15.6,base:0},
 {hiddenX:5.2,visibleX:3.5,z:-12.1,base:0},
 {hiddenX:-6.6,visibleX:-8.5,z:-13,base:0},
 {hiddenX:6.5,visibleX:8.5,z:-15,base:0},
 {hiddenX:-5.8,visibleX:-5.8,z:-10.5,base:1.75,rise:true},
 {hiddenX:1.2,visibleX:1.2,z:-15.5,base:1.45,rise:true},
 {hiddenX:6.2,visibleX:6.2,z:-12.1,base:1.75,rise:true},
 {hiddenX:-1.7,visibleX:-1.7,z:-21.5,base:2.75,rise:true},
 {hiddenX:2.4,visibleX:2.4,z:-21.5,base:2.75,rise:true},
];
let recentPeekSlots=[];
export function spawnPeek(id,elapsed,random,targets=[]){
 const occupied=new Set(targets.filter(t=>!t.dead && t.id!==id).map(t=>t.slot));
 const previous=targets.find(t=>t.id===id)?.slot;
 let available=peekSlots.map((_,i)=>i).filter(i=>!occupied.has(i)&&i!==previous);
 const fresh=available.filter(i=>!recentPeekSlots.includes(i));
 if(fresh.length)available=fresh;
 else recentPeekSlots=recentPeekSlots.filter(i=>occupied.has(i));
 const slot=available[Math.min(available.length-1,Math.floor(random()*available.length))];
 recentPeekSlots.push(slot);
 const p=peekSlots[slot];
 return {id,slot,...p,x:p.hiddenX,y:p.base+1.65-(p.rise?2:0),hp:1,dead:false,born:elapsed,respawnAt:0,generation:elapsed};
}
export function tickPeek(s,dt){
 for(let i=0;i<s.targets.length;i++){
  let t=s.targets[i];
  if(t.dead){if(s.elapsed>=t.respawnAt)s.targets[i]=t=spawnPeek(t.id,s.elapsed,s.random,s.targets);else continue;}
  const age=s.elapsed-t.born;
  let reveal=Math.min(1,Math.max(0,age/.7));reveal=reveal*reveal*(3-2*reveal);
  t.x=t.hiddenX+(t.visibleX-t.hiddenX)*reveal;
  t.y=t.base+1.65-(t.rise?2*(1-reveal):0);
 }
}
