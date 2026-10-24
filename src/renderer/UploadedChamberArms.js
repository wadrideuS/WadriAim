import * as THREE from 'three';
import { buildChamberViewmodel } from './ChamberArms.js';
/** Adapt the uploaded 154-bone Chamber rig, preserving its textured hands and sleeves. */
export function buildUploadedChamberArms(root, {curl=true}={}) {
 root.traverse(bone=>{
  if(!bone.isBone)return;
  const match=bone.name.match(/^([LR])_(Hand|Elbow|Thumb[0123]|Index[0123]|Middle[0123]|Pinky[0123]|Ring[0123])(.*)$/);
  if(!match)return;
  const side=match[1]==='L'?'Left':'Right';
  bone.name=side+(match[2]==='Elbow'?'ForeArm':match[2]==='Hand'?'Hand':'Hand'+match[2])+match[3];
 });
 root.updateMatrixWorld(true);
 root.userData.handBindMatrices=new Map();
 root.traverse(bone=>{if(bone.isBone)root.userData.handBindMatrices.set(bone.uuid,bone.matrixWorld.clone());});
 if(curl) for(const side of ['Left','Right']) {
  const bones=[];root.traverse(bone=>{if(bone.isBone)bones.push(bone);});
  const index=bones.find(bone=>bone.name.startsWith(side+'HandIndex1_'));
  const ring=bones.find(bone=>bone.name.startsWith(side+'HandRing1_'));
  if(!index||!ring)throw Error('El modelo no contiene los dedos del brazo '+side);
  const across=index.getWorldPosition(new THREE.Vector3()).sub(ring.getWorldPosition(new THREE.Vector3())).normalize();
  for(const bone of bones) {
   const match=bone.name.match(new RegExp('^'+side+'Hand(Index|Middle|Pinky|Ring|Thumb)([123])_'));
   if(!match)continue;
   const digit=match[1],joint=Number(match[2]);
   const angle=digit==='Thumb' ? (joint===1?0.25:0.5) : joint===1 ? (digit==='Index'&&side==='Right'?0.3:0.9) : joint===2 ? 1.15 : 0.65;
   const axis=across.clone().applyQuaternion(bone.getWorldQuaternion(new THREE.Quaternion()).invert());
   bone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis,side==='Left' ? -angle : angle));
   root.updateMatrixWorld(true);
  }
 }
 const arms=buildChamberViewmodel(root,{posed:true,customPose:true});
 arms.name='Uploaded Chamber first-person arms';
 const fit=arms.userData.fitToWeapon;
 arms.userData.fitToWeapon=(weapon,id)=>{fit(weapon,id);if(id==='karambit') {arms.children[0].visible=false;arms.children[1].position.add(new THREE.Vector3(.01,-.03,-.02));} arms.userData.grips={weapon:id};};
 return arms;
}
