import * as THREE from 'three';
import {initCamera} from "./cameraControls.js";
import {VRButton} from "three/addons/webxr/VRButton.js";

export async function initRenderer() {
    const camera = initCamera();
    const container = document.getElementById('container');
    container.innerHTML = '';

    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);

    // MSAA
    renderer.samples = Math.min(2, renderer.capabilities.maxSamples || 2);
    renderer.shadowMap.enabled = true;

    // VR
    document.body.appendChild(VRButton.createButton(renderer));
    renderer.xr.enabled = true;

    container.appendChild(renderer.domElement);
    return {renderer, camera, container};
}