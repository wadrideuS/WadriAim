import nav from '../data/survival-navigation.json' with {type:'json'};
import {createNavigation} from './navigation-grid.js';

/** Defender corner, north-west of the main hall: both entries ahead and an open view down the hall. */
export const SURVIVAL_DEFENDER_SPAWN = { x: -12.1, z: 11.6 };
/** Attackers walk in from the south room (through its doorways) and down the north-east corridor. */
export const SURVIVAL_ENTRIES = [
  { name: 'sala-sur', slots: [{ x: -9.3, z: -2.4 }, { x: -6.5, z: -3.8 }, { x: -3.7, z: -2.4 }] },
  { name: 'pasillo-noreste', slots: [{ x: 2.6, z: 14.4 }, { x: 4.7, z: 15.1 }, { x: 6.8, z: 17.9 }] },
];

export const survivalNavigation=createNavigation(nav,{
  spawn:[SURVIVAL_DEFENDER_SPAWN.x,SURVIVAL_DEFENDER_SPAWN.z],
  objective:[-12,12],
  entries:SURVIVAL_ENTRIES.flatMap(entry=>entry.slots.map(slot=>[slot.x,slot.z])),
});
