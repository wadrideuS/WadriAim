const pad=(x,z,h,w=2.2,d=2.2)=>({x,z,h,w,d});
export const movementCourses={
 7:{name:'Circuito de saltos',pads:[pad(0,2,.25,3,3),pad(0,-1.2,.65),pad(1.8,-4,1.15),pad(-.3,-6.9,1.65),pad(-2,-9.6,1.1),pad(0,-12.7,1.7),pad(2,-15.5,2.2),pad(0,-18.4,2.6),pad(0,-21.7,2.6,3,3)]},
 8:{name:'Aterrizaje preciso',pads:[pad(0,2,.25,3,3),pad(-1.2,-.8,.65,1.5,1.5),pad(1,-3.2,1,1.5,1.5),pad(-.8,-5.6,1.35,1.6,1.6),pad(-2.1,-8,.9,1.4,1.4),pad(.2,-10.3,1.3,1.4,1.4),pad(2,-12.8,1.65,1.5,1.5),pad(0,-15.3,2,1.35,1.35),pad(0,-18,2,2.5,2.5)]},
 9:{name:'Bunny Jump',pads:[pad(0,2,.3,4,4),pad(0,-.9,.3,3.2,3.2),pad(.4,-3.8,.3,3.2,3.2),pad(-.4,-6.7,.3,3.2,3.2),pad(-.8,-9.6,.3,3.2,3.2),pad(0,-12.5,.3,3.2,3.2),pad(.8,-15.4,.3,3.2,3.2),pad(.4,-18.3,.3,3.2,3.2),pad(0,-21.2,.3,4,4)]},
};
export function courseFor(mode, level=1, random=Math.random) {
 const base=movementCourses[mode];
 if(!base)return null;
 const difficulty=Math.min(9,Math.max(0,level-1));
 const bunny=mode===9,precise=mode===8;
 const count=8+Math.floor(difficulty/3);
 const pattern=Math.floor(random()*4),mirror=random()<.5?-1:1;
 const pads=[pad(0,2,.3,3.8,3.8)];
 let x=0,z=2,height=.3;
 for(let i=1;i<count;i++){
  const spacing=(bunny?3.45:3.05)+difficulty*(bunny?.07:.055)+(random()-.5)*.22;
  const turn=(bunny?.22:.34)+difficulty*.035;
  let heading=pattern===0?(i%2?turn:-turn):pattern===1?Math.sin(i*.7)*turn:pattern===2?(random()-.5)*turn*2:Math.sin(i*1.4)*turn;
  heading*=mirror;
  x=Math.max(-7,Math.min(7,x+Math.sin(heading)*spacing));z-=Math.cos(heading)*spacing;
  const rise=bunny?(difficulty<3?0:(random()-.45)*.22):pattern===3?.22+difficulty*.018:(random()-.3)*(.32+difficulty*.02);
  height=Math.max(.3,Math.min(4,height+rise));
  const width=Math.max(precise?1.05:1.35,(bunny?2.65:precise?1.7:2.25)-difficulty*(bunny?.11:precise?.07:.065));
  const last=i===count-1;
  pads.push(pad(x,z,height,last?3.5:width,last?3.5:width));
 }
 return {name:base.name,level,difficulty,pattern,pads};
}
function spawnCheckpoint(s){
 s.bunnyChain=0;s.jumpBuffer=0;s.hasLanded=false;s.groundedFor=1;
 const p=s.course.pads[s.checkpoint];s.position.x=p.x;s.position.z=p.z;s.jumpHeight=p.h;
 s.velocity={x:0,y:0,z:0};s.onGround=true;s.position.y=p.h+1.65;
}
export function resetCourse(session){
 session.lives=10;session.courseOutcome=null;
 session.bunnyChain=0;session.bestBunnyChain=0;session.jumpBuffer=0;session.groundedFor=1;session.hasLanded=false;
 session.courseLevel=1;session.completedCourses=0;session.completedPads=0;
 session.course=courseFor(session.mode,1,session.random);
 session.courseStep=0;session.checkpoint=0;session.falls=0;session.jumps=0;session.onGround=true;
 if(session.course)spawnCheckpoint(session);
}
export function requestCourseJump(s){
 if(s.mode===9 && !s.onGround){s.jumpBuffer=.16;return;}
 if(!s.onGround)return;
 if(s.mode===9){
  const speed=Math.hypot(s.velocity.x,s.velocity.z);
  if(s.hasLanded && s.groundedFor<=.16 && speed>3){
   s.bunnyChain++;s.bestBunnyChain=Math.max(s.bestBunnyChain,s.bunnyChain);
   const nextSpeed=Math.min(9,speed+.35);
   s.velocity.x*=nextSpeed/speed;s.velocity.z*=nextSpeed/speed;
   s.score+=25*Math.min(s.bunnyChain,10);
   s.feedback={text:'BUNNY ×'+s.bunnyChain,until:s.elapsed+.6};
  }else s.bunnyChain=0;
 }
 s.velocity.y=5.5;s.onGround=false;s.jumps++;s.jumpBuffer=0;
}
export function tickCourse(s,dt,keys){
 const wasGround=s.onGround;
 if(s.onGround)s.groundedFor+=dt;
 s.jumpBuffer=Math.max(0,s.jumpBuffer-dt);
 const forward=Number(keys.has('w')||keys.has('ArrowUp'))-Number(keys.has('s')||keys.has('ArrowDown'));
 const side=Number(keys.has('d')||keys.has('ArrowRight'))-Number(keys.has('a')||keys.has('ArrowLeft'));
 const norm=Math.max(1,Math.hypot(forward,side));
 const speed=s.weapon.speed*(keys.has('Shift')?.52:1)*(keys.has('Control')?.47:1);
 const wishX=(-Math.sin(s.yaw)*forward+Math.cos(s.yaw)*side)/norm;
 const wishZ=(-Math.cos(s.yaw)*forward-Math.sin(s.yaw)*side)/norm;
 if(s.mode===9 && !s.onGround){
  // Air steering adds only the missing component in the chosen direction.
  const along=s.velocity.x*wishX+s.velocity.z*wishZ;
  const acceleration=Math.min(Math.max(0,speed-along),speed*2.5*dt);
  s.velocity.x+=wishX*acceleration;s.velocity.z+=wishZ*acceleration;
  const magnitude=Math.hypot(s.velocity.x,s.velocity.z);
  if(magnitude>9){s.velocity.x*=9/magnitude;s.velocity.z*=9/magnitude;}
 }else{
  const response=1-Math.exp(-(s.onGround?24:4)*dt);
  const carry=s.mode===9 && s.groundedFor<=.16 && forward>0 && !keys.has('Shift') && !keys.has('Control');
  const groundSpeed=carry?Math.max(speed,Math.hypot(s.velocity.x,s.velocity.z)):speed;
  s.velocity.x+=(wishX*groundSpeed-s.velocity.x)*response;
  s.velocity.z+=(wishZ*groundSpeed-s.velocity.z)*response;
 }
 const oldX=s.position.x,oldZ=s.position.z,oldY=s.jumpHeight;
 let x=Math.max(-12,Math.min(12,oldX+s.velocity.x*dt)),z=Math.max(Math.min(...s.course.pads.map(p=>p.z))-5,Math.min(7,oldZ+s.velocity.z*dt));
 for(const p of s.course.pads){
  if(oldY>=p.h-.025)continue;
  if(Math.abs(x-p.x)<p.w/2+.2 && Math.abs(z-p.z)<p.d/2+.2){
   if(Math.abs(oldX-p.x)>=p.w/2+.19){x=oldX;s.velocity.x=0;}
   if(Math.abs(oldZ-p.z)>=p.d/2+.19){z=oldZ;s.velocity.z=0;}
  }
 }
 s.position.x=x;s.position.z=z;
 s.velocity.y-=16*dt;s.jumpHeight+=s.velocity.y*dt;s.onGround=false;
 let landed=-1,top=-1;
 if(s.velocity.y<=0) s.course.pads.forEach((p,i)=>{
  if(Math.abs(x-p.x)<=p.w/2-.07 && Math.abs(z-p.z)<=p.d/2-.07 && oldY>=p.h-.03 && s.jumpHeight<=p.h && p.h>top){landed=i;top=p.h;}
 });
 if(landed>=0){
  s.jumpHeight=top;s.velocity.y=0;s.onGround=true;
  if(!wasGround){s.groundedFor=0;s.hasLanded=true;}
  if(landed===s.courseStep+1){s.courseStep++;s.hits=++s.completedPads;s.score+=100;if(s.courseStep%3===0)s.checkpoint=s.courseStep;s.feedback={text:'CHECKPOINT '+s.courseStep,until:s.elapsed+.8};}
  if(s.mode===9 && s.jumpBuffer>0)requestCourseJump(s);
  if(s.courseStep===s.course.pads.length-1){s.score+=Math.max(0,Math.round(s.remaining*10));s.completedCourses++;if(s.completedCourses>=10){s.courseOutcome='completed';s.status='finished';return;}s.courseLevel++;s.course=courseFor(s.mode,s.courseLevel,s.random);s.courseStep=0;s.checkpoint=0;s.remaining=s.duration;s.elapsed=0;spawnCheckpoint(s);s.feedback={text:'NIVEL '+s.courseLevel,until:2};return;}
 }
 if(s.jumpHeight<=0){
  s.bunnyChain=0;s.jumpBuffer=0;s.hasLanded=false;s.groundedFor=1;
  s.falls++;s.lives--;if(s.lives<=0){s.courseOutcome='no-lives';s.status='finished';return;}const p=s.course.pads[s.checkpoint];s.position.x=p.x;s.position.z=p.z;s.jumpHeight=p.h;s.courseStep=s.checkpoint;s.velocity={x:0,y:0,z:0};s.onGround=true;s.feedback={text:'Vuelve a intentarlo',until:s.elapsed+.9};
 }
 s.crouch+=((keys.has('Control')?1:0)-s.crouch)*(1-Math.exp(-14*dt));
 s.position.y=1.65+s.jumpHeight-s.crouch*.55;
 s.moveSpeed=Math.hypot(s.velocity.x,s.velocity.z);s.bob+=s.moveSpeed*dt*1.6;
 if(s.remaining===0){s.courseOutcome='time';s.status='finished';}
}
