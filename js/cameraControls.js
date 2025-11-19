import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

const move = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
};

const moveSpeed = 1000;
const verticalSpeed = 500;

let camera, controls;

function onKeyDown(e) {
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
            move.forward = true;
            break;
        case 'KeyS':
        case 'ArrowDown':
            move.backward = true;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            move.left = true;
            break;
        case 'KeyD':
        case 'ArrowRight':
            move.right = true;
            break;
        case 'Space':
            move.up = true;
            e.preventDefault();
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            move.down = true;
            e.preventDefault();
            break;
        case 'KeyR':
            camera.position.set(1500, 900, 1500);
            controls.target.set(0, 0, 0);
            controls.update();
            break;
    }
}

function onKeyUp(e) {
    switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
            move.forward = false;
            break;
        case 'KeyS':
        case 'ArrowDown':
            move.backward = false;
            break;
        case 'KeyA':
        case 'ArrowLeft':
            move.left = false;
            break;
        case 'KeyD':
        case 'ArrowRight':
            move.right = false;
            break;
        case 'Space':
            move.up = false;
            e.preventDefault();
            break;
        case 'ShiftLeft':
        case 'ShiftRight':
            move.down = false;
            e.preventDefault();
            break;
    }
}

function updateKeyboardMovement(delta) {
    if (!camera || !controls) return;
    if (!(move.forward || move.backward || move.left || move.right || move.up || move.down)) return;

    const horizSpeed = moveSpeed * delta;
    const vertSpeed = verticalSpeed * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0) forward.normalize();

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    const deltaVec = new THREE.Vector3();

    if (move.forward) deltaVec.addScaledVector(forward, horizSpeed);
    if (move.backward) deltaVec.addScaledVector(forward, -horizSpeed);
    if (move.left) deltaVec.addScaledVector(right, -horizSpeed);
    if (move.right) deltaVec.addScaledVector(right, horizSpeed);
    if (move.up) deltaVec.y += vertSpeed;
    if (move.down) deltaVec.y -= vertSpeed;

    camera.position.add(deltaVec);
    controls.target.add(deltaVec);

    const minX = -3750, maxX = 3750;
    const minZ = -3750, maxZ = 3750;

    const corrected = new THREE.Vector3(
        THREE.MathUtils.clamp(camera.position.x, minX, maxX),
        camera.position.y,
        THREE.MathUtils.clamp(camera.position.z, minZ, maxZ)
    );
    const correction = corrected.clone().sub(camera.position);

    camera.position.add(correction);
    controls.target.add(correction);

    if (camera.position.y < 40) camera.position.y = 45;
}

export function initCameraControls(rendererDom) {
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 20000);
    controls = new OrbitControls(camera, rendererDom);
    controls.minDistance = 10;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI / 2;

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return {camera, controls};
}

export function updateCameraControls(delta) {
    if (controls && camera) {
        updateKeyboardMovement(delta);
        controls.update();
    }
}
