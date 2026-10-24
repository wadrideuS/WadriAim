import test from 'node:test';
import assert from 'node:assert/strict';
import {TrainingSession} from '../src/game/TrainingSession.js';
import {courseFor,tickCourse} from '../src/game/movement-courses.js';
test('movement uses only the knife and advances immediately to a fresh harder course',()=>{
 const s=new TrainingSession();s.reset(7,'vandal');s.start();
 assert.equal(s.weaponId,'karambit');assert.equal(s.shoot(),false);
 const old=s.course;const last=old.pads.at(-1);
 s.courseStep=old.pads.length-2;s.position.x=last.x;s.position.z=last.z;s.jumpHeight=last.h+.01;s.velocity.y=-1;
 tickCourse(s,.02,new Set());
 assert.equal(s.status,'running');assert.equal(s.completedCourses,1);assert.equal(s.courseLevel,2);assert.notEqual(s.course,old);
 assert.equal(s.courseStep,0);assert.equal(s.remaining,s.duration);assert.ok(s.course.pads[1].w<old.pads[1].w);
 assert.equal(s.position.z,s.course.pads[0].z);
});
test('progressive movement keeps landing surfaces usable and falling restores a checkpoint',()=>{
 for(const mode of [7,8]) for(const level of [1,2,20]) assert.ok(courseFor(mode,level).pads.every(p=>p.w>=1&&p.d>=1));
 const s=new TrainingSession();s.reset(8,'ghost');s.start();s.checkpoint=3;s.courseStep=5;s.position.x=10;s.jumpHeight=-1;
 tickCourse(s,.02,new Set());assert.equal(s.falls,1);assert.equal(s.courseStep,3);assert.equal(s.position.x,s.course.pads[3].x);
});
