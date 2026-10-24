import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configureStorage,read,save} from '../src/lib/storage.js';
import {createSyncQueue} from '../src/account/sync.js';
import {normalizeUsername,usernamePattern,validateAvatar} from '../src/account/service.js';
import {modeGuides} from '../src/data/mode-guides.js';
test('guest storage resets on every session and never writes localStorage',()=>{
 let writes=0;globalThis.localStorage={setItem(){writes++;},getItem(){throw Error('Guest must not read persistent data');}};
 configureStorage();save('wa-profile',{dpi:1600});assert.equal(read('wa-profile',{}).dpi,1600);
 configureStorage();assert.deepEqual(read('wa-profile',{}),{});assert.equal(writes,0);
});
test('registered caches are isolated between identities and hydrate cloud settings',()=>{
 const persisted=new Map();globalThis.localStorage={setItem:(k,v)=>persisted.set(k,v),getItem:k=>persisted.get(k)};
 const sent=[];configureStorage({id:'alice',initial:{'wa-profile':{dpi:800}},onSave:(...args)=>sent.push(args)});
 assert.equal(read('wa-profile',{}).dpi,800);save('wa-history',[{hits:5}]);
 configureStorage({id:'bob'});assert.deepEqual(read('wa-history',[]),[]);
 configureStorage({id:'alice'});assert.equal(read('wa-history',[])[0].hits,5);assert.equal(sent.length,1);
 configureStorage();assert.deepEqual(read('wa-history',[]),[]);
});
test('cloud queue serializes rapid edits and retains failed saves for retry',async()=>{
 const values=[];let resolveFirst;let attempts=0;
 const queue=createSyncQueue({write:async(k,value)=>{attempts++;if(attempts===1)await new Promise(r=>resolveFirst=r);values.push(value);}});
 queue.save('wa-profile',1);queue.save('wa-profile',2);resolveFirst();
 await new Promise(r=>setTimeout(r,0));
 assert.deepEqual(values,[1,2]);assert.equal(queue.pending,0);
 let failed=true,errorCount=0;const retry=createSyncQueue({write:async()=>{if(failed)throw Error('offline');},onError:()=>errorCount++});
 retry.save('wa-profile',3);await new Promise(r=>setTimeout(r,0));assert.equal(retry.pending,1);assert.equal(errorCount,1);
 failed=false;await retry.retry();assert.equal(retry.pending,0);
});
test('usernames normalize to a unique lowercase representation; avatars reject unsafe formats and oversize files',()=>{
 assert.equal(normalizeUsername(' Wadri_01 '),'wadri_01');
 for(const name of ['abc','wadri_01','user123'])assert(usernamePattern.test(name));
 for(const name of ['ab','Upper','has space','<script>','a'.repeat(21)])assert(!usernamePattern.test(name));
 assert.throws(()=>validateAvatar({type:'image/svg+xml',size:100}));
 assert.throws(()=>validateAvatar({type:'image/png',size:3*1024*1024}));
 assert.doesNotThrow(()=>validateAvatar({type:'image/webp',size:1000}));
});
test('all training modes include objective, controls and scoring guidance',()=>{
 assert.ok(modeGuides.length>=9);
 for(const guide of modeGuides)for(const field of ['goal','tip','score'])assert(guide[field].length>20);
});
