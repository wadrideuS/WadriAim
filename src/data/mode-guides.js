export const modeGuides = [
  {
    goal: 'Ajusta la mira con movimientos cortos y elimina los puntos.',
    tip: 'Prioriza movimientos pequeños. Detente antes de disparar.',
    score: 'Cada objetivo eliminado cuenta como un acierto.',
  },
  {
    goal: 'Pasa rápidamente de un objetivo al siguiente y dispara.',
    tip: 'Los agentes tienen 150 de vida (100 + escudo pesado): con Vandal o Sheriff, un headshot basta.',
    score: 'Consigue el mayor número de aciertos en 60 segundos.',
  },
  {
    goal: 'Mantén la mira sobre el punto mientras se mueve.',
    tip: 'Mantén pulsado el disparo y sigue al objetivo con suavidad. Oirás un clic mientras aciertas.',
    score: 'Puntúas por el tiempo que mantienes la mira sobre el objetivo.',
  },
  {
    goal: 'Elimina los bots disparando únicamente a la cabeza.',
    tip: 'Los impactos al cuerpo no eliminan al objetivo.',
    score: 'Cada headshot válido suma un acierto.',
  },
  {
    goal: 'Encuentra y elimina el objetivo antes de que desaparezca.',
    tip: 'Tienes 1,5 segundos por aparición. Con 150 de vida, ve a la cabeza.',
    score: 'Cada eliminación suma. Los objetivos caducados no dan puntos.',
  },
  {
    goal: 'Elimina todos los objetivos para pasar a la siguiente oleada.',
    tip: 'Cambia de objetivo con control; no persigas al que ya cayó.',
    score: 'Completa tantas oleadas y aciertos como puedas.',
  },
  {
    goal: 'Consigue tu máxima puntuación en solo 45 segundos.',
    tip: 'Puntos estáticos, pero solo duran 650 ms. Munición ilimitada.',
    score: '100 puntos por acierto, más bonificación por velocidad y racha.',
  },
  {goal:'Recorre las plataformas en orden hasta llegar a la meta.',tip:'WASD para moverte, espacio para saltar y Shift para ajustar el aterrizaje.',score:'Ganas puntos por avanzar y por terminar rápido. Tienes 10 vidas y hasta 10 niveles aleatorios. Cada caída quita una vida.'},
  {goal:'Aterriza sobre plataformas más pequeñas sin perder el control.',tip:'Suelta la dirección antes de caer y corrige suavemente en el aire.',score:'Completa las plataformas en orden. Tienes 10 vidas y hasta 10 niveles aleatorios. Avanzas automáticamente al terminar.'},
  {goal:'Encadena saltos sobre las plataformas y completa circuitos progresivos.',tip:'W para tomar impulso; A/D y ratón para corregir en el aire. Pulsa espacio justo al aterrizar. Puedes anticiparlo hasta 160 ms; mantenerlo pulsado no salta automáticamente. Ctrl agacha y Shift camina.',score:'100 puntos por plataforma y bonus por saltos encadenados. Cada caída rompe la racha y quita una de tus 10 vidas. Completa hasta 10 niveles aleatorios.'},
  {goal:'Acierta a los bots que aparecen en laterales y encima de las coberturas.',tip:'Revisa lados, alturas y distancias. Los muros bloquean tus disparos; los bots salen despacio y permanecen visibles.',score:'Máximo cinco bots. Al eliminar uno, aparece otro en un ángulo diferente. Suma aciertos durante 60 segundos.'},
  {goal:'Defiende la spike contra cinco bots en Haven C. Todos comienzan con 150 de vida.',tip:'Usa las cajas y los muros como cobertura. Los bots navegan por el mapa, disparan y pueden desactivar la spike. Elige Básico, Difícil o VCT AIMER.',score:'Elimina a los cinco antes de 60 segundos. Si la spike explota o te eliminan, pierdes. Juega 1v5, con un bot aliado o en una sala con un amigo.'},
  {goal:'Sobrevive a oleadas ilimitadas de cinco atacantes en el mapa tutorial.',tip:'Entre oleadas tienes 8 segundos de descanso, recuperas 25 de vida y recargas. Los enemigos ganan vida, velocidad y precisión. Juega solo, con un bot o con tres amigos.',score:'El reto termina al caer todo el equipo. Cada baja y cada oleada completada suman puntos; no hay límite de tiempo.'},
  {goal:'Esquiva todas las flashes y cegueras del juego y elimina al enemigo que asoma después.',tip:'Flashes (Phoenix, Skye, Breach, KAY/O, Yoru, Vyse): gira la cara antes de que exploten. Paranoia: sal de su línea. Leer, Dizzy y Prowler: dispárales. Fakeout: no le dispares al señuelo.',score:'100 por esquiva, 75 por habilidad destruida, 150 por baja (200 a la cabeza). Si te ciegan, pierdes la racha.'},
  {goal:'Elimina agentes que hacen strafe, se agachan, asoman tras coberturas y aparecen en ventanas y torres.',tip:'Los de las ventanas solo se quedan un momento. Ajusta la altura de la mira al subir y bajar la vista.',score:'Cada baja suma un acierto. 150 de vida: el daño depende del arma, la zona y la distancia.'},
];
export function renderModeGuide(node, mode) {
 const guide=modeGuides[mode],movement=[7,8,9].includes(mode);
 node.replaceChildren();
 const title=document.createElement('small');title.className='brief-label';title.textContent='TECLAS';
 const controls=document.createElement('div');controls.className='simple-controls';
 const rows=[['W A S D','Moverse'],['Espacio','Saltar'],['Ctrl','Agacharse'],['Shift','Caminar'],['Esc','Pausa']];
 if(!movement)rows.push(['M1','Disparar'],['R','Recargar']);
 for(const [keys,label] of rows){const row=document.createElement('div');const keybox=document.createElement('span');for(const key of keys.split(' ')){const k=document.createElement('kbd');k.textContent=key;keybox.append(k);}const text=document.createElement('span');text.textContent=label;row.append(keybox,text);controls.append(row);}
 const tip=document.createElement('p');tip.textContent=guide.tip;
 const score=document.createElement('p');score.textContent=guide.score;score.className='brief-score';
 node.append(title,controls,tip,score);node.hidden=false;
}
