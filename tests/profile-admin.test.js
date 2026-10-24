import {test} from 'node:test';
import assert from 'node:assert/strict';
import {vctTeams,vctRegions,teamPalettes,teamPalette,teamById} from '../src/data/vct-teams.js';
import {teamLogos} from '../src/data/team-logos.js';
import {summarizeHistory} from '../src/account/stats.js';
import {summarizeModes} from '../src/account/admin.js';
import {TrainingSession} from '../src/game/TrainingSession.js';
test('official partner catalog has four regions, 32 unique teams and all logos',()=>{
 assert.equal(vctRegions.length,4);assert.equal(vctTeams.length,32);assert.equal(new Set(vctTeams.map(t=>t.id)).size,32);
 for(const [region] of vctRegions)assert.equal(vctTeams.filter(t=>t.region===region).length,8);
 for(const team of vctTeams){assert.ok(teamLogos[team.id]);assert.ok(teamPalettes['team-'+team.id]);}
 assert.equal(teamPalette(teamById('g2')).accent,'#ff173d');assert.equal(teamPalette(teamById('g2')).bg,'#050505');assert.equal(teamPalette(teamById('fnc')).accent,'#ff7900');assert.equal(teamPalette(teamById('blg')).secondary,'#86c9e4');
});
test('profile groups current and old rounds and does not invent HS for old data',()=>{
 const stats=summarizeHistory([{mode:0,hits:10,score:0,headshots:3,accuracy:50},{name:'Microflicks',hits:15,accuracy:80},{mode:6,score:400,hits:3,headshots:1,accuracy:100}]);
 assert.equal(stats[0].sessions,2);assert.equal(stats[0].best,15);assert.equal(stats[0].headshots,3);assert.equal(stats[0].accuracy,65);assert.equal(stats[6].best,400);assert.equal(stats[1].sessions,0);
});
test('admin mode counters exclude visitors and paused players',()=>{
 const result=summarizeModes([{activity:'playing',mode:0},{activity:'paused',mode:0},{activity:'browsing',mode:null},{activity:'playing',mode:6}]);
 assert.equal(result[0].playing,1);assert.equal(result[6].playing,1);
});
test('completed rounds report headshot eliminations and reset for new rounds',()=>{
 const session=new TrainingSession();session.eliminate(session.targets[0],'head');assert.equal(session.result().headshots,1);assert.equal(session.result().mode,0);session.reset(0,'vandal');assert.equal(session.result().headshots,0);
});
