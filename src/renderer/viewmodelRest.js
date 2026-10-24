import * as THREE from 'three';

/** Resting offset of the gun viewmodel in camera space (metres), before bob, recoil and ADS. */
export const VIEWMODEL_REST_OFFSET = new THREE.Vector3(0.015, -0.035, -0.18);
/** Sideways slide toward the centre while aiming down sights. */
export const VIEWMODEL_ADS_SHIFT = -0.1;
