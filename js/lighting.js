import * as THREE from "three";

const d = 4000; // Terrain is 7500, so 4000 radius covers it
export function initDirectionalLight() {
    let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.castShadow = true;

    directionalLight.shadow.mapSize.set(2048,2048);  // Higher resolution shadows
    const d = 4000; // Terrain is 7500, so 4000 radius covers it
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 15000; // Needs to reach from sky to ground
    directionalLight.shadow.bias = -0.0005;     // Reduces shadow "acne"

    directionalLight.position.set(5000, 5000, 2000);
    return directionalLight;
}

export function initMoonLight(moonColor) {
    let moonLight = new THREE.DirectionalLight(moonColor, 0.0);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024,1024); // Lower resolution for moonlight
    moonLight.shadow.camera.left = -d;
    moonLight.shadow.camera.right = d;
    moonLight.shadow.camera.top = d;
    moonLight.shadow.camera.bottom = -d;
    moonLight.shadow.camera.near = 0.5;
    moonLight.shadow.camera.far = 15000;
    moonLight.shadow.bias = -0.0005;
    return moonLight;
}