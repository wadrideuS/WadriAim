// Rebuild from the isolated opening tap: automatic fire overlaps its full tail.
// Slicing the later full-auto recording into 91 ms fragments caused audible cuts.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
execFileSync(process.execPath,['scripts/extract-shot.mjs','phantom',process.argv[2] || 'assets/source-audio/phantom.mp3','0.3670068027','0.72'],{stdio:'inherit'});
fs.copyFileSync('public/audio/phantom/shot.wav','public/audio/phantom/tap-natural-v2.wav');
const packs=JSON.parse(fs.readFileSync('src/data/sound-packs.json'));
for(const key of Object.keys(packs.phantom))if(key.startsWith('burst'))delete packs.phantom[key];
packs.phantom.shot='audio/phantom/tap-natural-v2.wav';
fs.writeFileSync('src/data/sound-packs.json',JSON.stringify(packs,null,2)+'\n');
