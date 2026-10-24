const layout=[['w','W'],['a','A'],['s','S'],['d','D'],['Control','CTRL'],[' ','ESPACIO'],['Shift','SHIFT']];
export function installKeystrokes(parent){
 const panel=document.createElement('section');
 panel.className='movement-keystrokes';panel.setAttribute('aria-label','Teclas de movimiento');panel.hidden=true;
 const title=document.createElement('small');title.textContent='MOVIMIENTO';
 const keys=document.createElement('div');keys.className='keystroke-grid';
 const buttons=layout.map(([key,label])=>{
  const node=document.createElement('kbd');node.textContent=label;node.dataset.key=key;
  node.className=key===' '?'key-space':key==='Control'?'key-control':key==='Shift'?'key-shift':'key-'+key;
  keys.append(node);return {key,node};
 });
 const metrics=document.createElement('div');metrics.className='keystroke-metrics';
 panel.append(title,keys,metrics);parent.append(panel);
 return {
  update(session,pressed=new Set()){
   panel.hidden=!session.course;
   const active=session.status==='running';
   for(const {key,node} of buttons)node.classList.toggle('pressed',active&&pressed.has(key));
   metrics.textContent=session.mode===9?`${Math.hypot(session.velocity.x,session.velocity.z).toFixed(1)} m/s · BUNNY ×${session.bunnyChain}`:'';
  },
  clear(){for(const {node} of buttons)node.classList.remove('pressed');},
  dispose(){panel.remove();},
 };
}
