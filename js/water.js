import * as THREE from 'three';
import {Water} from 'three/addons/objects/Water.js';

const waterGeometry = new THREE.PlaneGeometry(7500, 7500);

export function createWater(scene, waterNormalMap, sunDirection) {
    return new Water(waterGeometry, {
        textureHeight: 512,
        textureWidth: 512,
        waterNormals: waterNormalMap,
        sunDirection: sunDirection,
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 2.5,
        fog: scene.fog !== undefined
    });
}