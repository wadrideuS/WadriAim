export function createNavigation(nav,options){
const walkable=new Set(nav.walkable);
const cellPoint=id=>({x:nav.minX+(id%nav.width)*nav.cell,z:nav.minZ+Math.floor(id/nav.width)*nav.cell});
const cellId=(x,z)=>Math.round((z-nav.minZ)/nav.cell)*nav.width+Math.round((x-nav.minX)/nav.cell);
function nearestHavenPoint(x,z){let best=null,distance=Infinity;for(const id of walkable){const p=cellPoint(id),d=(p.x-x)**2+(p.z-z)**2;if(d<distance){distance=d;best=p;}}return best;}
function segmentDistance(x,z,s){const [ax,az,bx,bz]=s,dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-ax-t*dx,z-az-t*dz);}
function canWalkHaven(x,z){return walkable.has(cellId(x,z))&&!nav.segments.some(s=>segmentDistance(x,z,s)<.28);}
const cross=(ax,az,bx,bz)=>ax*bz-az*bx;
function havenBlocked(a,b){return nav.segments.some(([cx,cz,dx,dz])=>{const rx=b.x-a.x,rz=b.z-a.z,sx=dx-cx,sz=dz-cz,den=cross(rx,rz,sx,sz);if(Math.abs(den)<1e-8)return false;const t=cross(cx-a.x,cz-a.z,sx,sz)/den,u=cross(cx-a.x,cz-a.z,rx,rz)/den;return t>.001&&t<.999&&u>=0&&u<=1;});}
function havenPath(from,to){
 const a=nearestHavenPoint(from.x,from.z),b=nearestHavenPoint(to.x,to.z),start=cellId(a.x,a.z),end=cellId(b.x,b.z),queue=[start],previous=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){const id=queue[i];if(id===end)break;for(const next of [id-1,id+1,id-nav.width,id+nav.width]){
  if(!walkable.has(next)||previous.has(next))continue;
  const p=cellPoint(id),q=cellPoint(next);if(Math.abs(p.x-q.x)>nav.cell*1.1||havenBlocked(p,q))continue;
  previous.set(next,id);queue.push(next);
 }}
 if(!previous.has(end))return [];
 const path=[];for(let at=end;at!==start;at=previous.get(at))path.unshift(cellPoint(at));return path;
}
function moveHaven(position,dx,dz){const x=position.x+dx,z=position.z+dz;
 if(canWalkHaven(x,position.z)&&!havenBlocked(position,{x,z:position.z}))position.x=x;
 if(canWalkHaven(position.x,z)&&!havenBlocked(position,{x:position.x,z}))position.z=z;
}
const havenSpawn=nearestHavenPoint(...options.spawn);
const havenSpike=nearestHavenPoint(...options.objective);
const reachable=new Set(),queue=[cellId(havenSpike.x,havenSpike.z)];reachable.add(queue[0]);
for(let i=0;i<queue.length;i++)for(const n of [queue[i]-1,queue[i]+1,queue[i]-nav.width,queue[i]+nav.width]){if(!walkable.has(n)||reachable.has(n))continue;const a=cellPoint(queue[i]),b=cellPoint(n);if(Math.abs(a.x-b.x)>nav.cell*1.1||havenBlocked(a,b))continue;reachable.add(n);queue.push(n);}
function connectedPoint(x,z){let best=null,distance=Infinity;for(const id of reachable){const p=cellPoint(id),d=(x-p.x)**2+(z-p.z)**2;if(d<distance){distance=d;best=p;}}return best;}
const havenEnemySpawns=options.entries.map(([x,z])=>connectedPoint(x,z));

const spawnCandidates=[];
for(const id of reachable){
 const p=cellPoint(id),distance=Math.hypot(p.x-havenSpike.x,p.z-havenSpike.z);
 if(options.spawnZones){if(!options.spawnZones.some(zone=>p.x>=zone.minX&&p.x<=zone.maxX&&p.z>=zone.minZ&&p.z<=zone.maxZ))continue;}
 else if(distance<10||distance>24||Math.hypot(p.x-havenSpawn.x,p.z-havenSpawn.z)<9)continue;
 if(spawnCandidates.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>(options.spawnZones?1:2.8)))spawnCandidates.push(p);
}
let previousSpawnIds=new Set();
function randomHavenSpawns(random=Math.random){
 let available=spawnCandidates.map((_,i)=>i).filter(i=>!previousSpawnIds.has(i));
 if(available.length<5)available=spawnCandidates.map((_,i)=>i);
 const selected=[];
 while(selected.length<5 && available.length){const at=Math.min(available.length-1,Math.floor(random()*available.length));selected.push(available.splice(at,1)[0]);}
 if(options.spawnZones){
  for(const zone of options.spawnZones){const belongs=i=>{const p=spawnCandidates[i];return p.x>=zone.minX&&p.x<=zone.maxX&&p.z>=zone.minZ&&p.z<=zone.maxZ;};
   if(!selected.some(belongs)){const replacement=available.find(belongs);if(replacement!==undefined){selected[selected.length-1]=replacement;available.splice(available.indexOf(replacement),1);}}
  }
 }
 previousSpawnIds=new Set(selected);
 return selected.map(i=>({...spawnCandidates[i]}));
}

return {spawn:havenSpawn,objective:havenSpike,entries:havenEnemySpawns,point:cellPoint,nearest:nearestHavenPoint,canWalk:canWalkHaven,blocked:havenBlocked,path:havenPath,move:moveHaven,randomSpawns:randomHavenSpawns};
}
