import {exercises} from '../data/exercises.js';
import {arsenal} from '../data/weapons.js';
export function showSessionSummary(record,{onReplay,onHome}={}){
 document.querySelector('.session-summary')?.remove();
 const page=document.createElement('section');page.className='session-summary';page.setAttribute('aria-label','Resumen de rendimiento');
 const movement=[7,8,9].includes(record.mode),seconds=Math.max(.001,record.activeDuration||0);
 const heading=document.createElement('h1');heading.textContent=record.early?'Terminada antes de tiempo':record.defenseOutcome==='defended'?'¡Spike defendida!':record.defenseOutcome==='exploded'?'DERROTA · La spike explotó':record.defenseOutcome==='defused'?'Han desactivado la spike':record.defenseOutcome==='eliminated'?'Equipo eliminado':record.courseOutcome==='no-lives'?'Sin vidas · Buen intento':record.courseOutcome==='completed'?'¡10 niveles completados!':record.courseOutcome==='time'?'Tiempo terminado':'Entrenamiento completado';
 const breadcrumb=document.createElement('p');breadcrumb.className='summary-breadcrumb';breadcrumb.textContent='Inicio › Entrenamiento › '+exercises[record.mode][0]+' › Resumen de rendimiento';
 const mode=document.createElement('p');mode.className='eyebrow';mode.textContent='WADRIAIM · '+exercises[record.mode][0].toUpperCase();
 const subtitle=document.createElement('p');subtitle.className='summary-subtitle';subtitle.textContent='Equipamiento: '+arsenal[record.weapon].name;
 const grid=document.createElement('div');grid.className='summary-layout';
 const hero=document.createElement('article');hero.className='summary-hero';
 const number=document.createElement('strong');number.textContent=movement?record.score:record.hits;
 const label=document.createElement('p');label.textContent=movement?'Puntos':'Impactos';
 const badge=document.createElement('span');badge.className='summary-badge';badge.textContent=record.early?'Terminada antes de tiempo':'Sesión completada';hero.append(number,label,badge);
 const details=document.createElement('article');const h=document.createElement('h2');h.textContent='Resumen de la sesión';const metrics=document.createElement('div');metrics.className='summary-metrics';
 const time=`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
 const values=movement?[
 [record.completedCourses||0,'Circuitos completados'],[record.courseLevel||1,'Nivel alcanzado'],[record.jumps||0,'Saltos'],[record.falls||0,'Caídas'],[record.lives??0,'Vidas restantes'],[record.bestBunnyChain||0,'Mejor racha bunny'],[time,'Tiempo activo'],
 ]:[[record.shots,'Disparos'],[Math.max(0,record.shots-record.hits),'Fallos'],[record.accuracy+'%','Precisión'],[record.headshots||0,'Headshots'],[(record.hits?Math.round((record.headshots||0)/record.hits*100):0)+'%','Tasa de headshots'],[(record.hits/seconds).toFixed(2),'Impactos por segundo'],[time,'Tiempo activo']];
 for(const [value,label] of values){const item=document.createElement('div');const strong=document.createElement('strong');strong.textContent=value;const small=document.createElement('span');small.textContent=label;item.append(strong,small);metrics.append(item);}
 details.append(h,metrics);grid.append(hero,details);
 const actions=document.createElement('div');actions.className='summary-actions';
 const replay=document.createElement('button');replay.className='primary';replay.textContent='▶ Jugar de nuevo';
 const home=document.createElement('button');home.className='summary-back';home.textContent='← Volver al entrenamiento';
 const clear=()=>{page.remove();document.body.classList.remove('show-session-summary');};
 replay.onclick=()=>{clear();onReplay?.();};home.onclick=()=>{clear();onHome?.();};actions.append(replay,home);
 page.append(breadcrumb,mode,heading,subtitle,grid,actions);document.body.append(page);document.body.classList.add('show-session-summary');heading.tabIndex=-1;heading.focus();window.scrollTo(0,0);
 return clear;
}
