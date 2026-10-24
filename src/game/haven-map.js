import nav from '../data/haven-navigation.json' with {type:'json'};
import {createNavigation} from './navigation-grid.js';
export const havenNavigation=createNavigation(nav,{spawn:[-7,8.3],objective:[.440542,2.417399],entries:[[-18,-18],[-17,-15],[18,2],[21,2],[17,3]],spawnZones:[{name:'Main',minX:-21,maxX:-14,minZ:-24,maxZ:-12},{name:'CT',minX:15,maxX:24,minZ:0,maxZ:5}]});
export const havenSpawn=havenNavigation.spawn,havenSpike=havenNavigation.objective,havenEnemySpawns=havenNavigation.entries;
export const nearestHavenPoint=havenNavigation.nearest,canWalkHaven=havenNavigation.canWalk,havenBlocked=havenNavigation.blocked,havenPath=havenNavigation.path,moveHaven=havenNavigation.move,randomHavenSpawns=havenNavigation.randomSpawns;
