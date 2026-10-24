import {spikeDifficulties} from '../game/SpikeDefense.js';
export function installSpikeLobby(parent,{onChange,onCreate,onJoin,onLeave}){
 const root=document.createElement('section');root.className='spike-lobby';root.hidden=true;
 const label=document.createElement('label');label.textContent='Dificultad';const difficulty=document.createElement('select');for(const [id,d] of Object.entries(spikeDifficulties))difficulty.add(new Option(d.name,id));label.append(difficulty);
 const partnerLabel=document.createElement('label');partnerLabel.textContent='Equipo defensor';const partner=document.createElement('select');for(const [id,name] of [['solo','Solo · 1 vs 5'],['bot','Con un bot · 2 vs 5'],['friend','Con un amigo · 2 vs 5']])partner.add(new Option(name,id));partnerLabel.append(partner);
 const friends=document.createElement('div');friends.className='spike-friend-room';friends.hidden=true;
 const create=document.createElement('button');create.type='button';create.textContent='Crear sala e invitar';
 const input=document.createElement('input');input.placeholder='Código de sala';input.maxLength=10;input.setAttribute('aria-label','Código de sala de Haven');
 const join=document.createElement('button');join.type='button';join.textContent='Unirme';
 const row=document.createElement('div');row.className='spike-room-join';row.append(input,join);
 const status=document.createElement('p');status.setAttribute('role','status');
 const leave=document.createElement('button');leave.textContent='Salir de la sala';leave.type='button';leave.hidden=true;
 const heading=document.createElement('h3');heading.className='entry-section-title';heading.textContent='Partida';
 friends.append(create,row,status,leave);root.append(heading,label,partnerLabel,friends);parent.append(root);
 const update=()=>{friends.hidden=partner.value!=='friend';onChange?.({difficulty:difficulty.value,partner:partner.value});};
 difficulty.onchange=update;partner.onchange=update;
 const run=async fn=>{create.disabled=join.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{create.disabled=join.disabled=false;}};
 create.onclick=()=>run(()=>onCreate());join.onclick=()=>run(()=>onJoin(input.value));leave.onclick=()=>{onLeave();status.textContent='';leave.hidden=true;};
 return {root,options:()=>({difficulty:difficulty.value,partner:partner.value}),message(text){status.textContent=text;},room(info,host){status.textContent=`Sala ${info.code} · ${info.members.map(m=>'@'+m.username).join(' + ')} · ${info.members.length}/${info.capacity||2} jugadores. ${host?'Comparte el código con tu amigo.':'Pulsa Listo para entrar.'}`;leave.hidden=false;difficulty.disabled=!host;},show(visible,survival=false){root.hidden=!visible;partner.options[2].textContent=survival?'Con amigos · hasta 4 jugadores':'Con un amigo · 2 vs 5';},reset(){partner.value='solo';difficulty.value='basic';friends.hidden=true;status.textContent='';leave.hidden=true;difficulty.disabled=false;},dispose(){root.remove();}};
}
