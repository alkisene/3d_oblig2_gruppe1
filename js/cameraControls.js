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

//reusable vectors to avoid creating new ones for each movement
const vForward = new THREE.Vector3();
const vUp = new THREE.Vector3(0, 1, 0);
const vRight = new THREE.Vector3();
const deltaVec = new THREE.Vector3();
const corrected = new THREE.Vector3();
const correction = new THREE.Vector3();

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

    camera.getWorldDirection(vForward);
    vForward.y = 0;
    if (vForward.lengthSq() > 0) vForward.normalize();

    vRight.crossVectors(vForward, vUp).normalize();

    deltaVec.set(0, 0, 0);

    if (move.forward) deltaVec.addScaledVector(vForward, horizSpeed);
    if (move.backward) deltaVec.addScaledVector(vForward, -horizSpeed);
    if (move.left) deltaVec.addScaledVector(vRight, -horizSpeed);
    if (move.right) deltaVec.addScaledVector(vRight, horizSpeed);
    if (move.up) deltaVec.y += vertSpeed;
    if (move.down) deltaVec.y -= vertSpeed;

    camera.position.add(deltaVec);
    controls.target.add(deltaVec);

    const minX = -3750, maxX = 3750;
    const minZ = -3750, maxZ = 3750;

    corrected.set(
        THREE.MathUtils.clamp(camera.position.x, minX, maxX),
        camera.position.y,
        THREE.MathUtils.clamp(camera.position.z, minZ, maxZ)
    );
    correction.copy(corrected).sub(camera.position);

    camera.position.add(correction);
    controls.target.add(correction);

    if (camera.position.y < 40) camera.position.y = 45;
}

export function initCameraControls(rendererDom) {
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 20000);
    controls = new OrbitControls(camera, rendererDom);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0;
    controls.maxDistance = 100;
    controls.maxPolarAngle = Math.PI;

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
//VR Controller Movement handling
export function handleControllerMovement(renderer, camera, player, delta) {
    const session = renderer.xr.getSession();
    if (!session) {
        console.log("No XR session active");
        return;
    }

    if (session.inputSources.length === 0) {
        console.log("No input sources detected");
        return;
    }

    const dt = Math.min(delta, 0.05);
    const speed = 1.0 * (dt * 60);

    for (const source of session.inputSources) {
        if (!source.gamepad) continue;

        const gp = source.gamepad;

        let xAxis = 0;
        let yAxis = 0;
        const rx = gp.axes[2] ?? 0;
        const ry = gp.axes[3] ?? 0;
        const lx = gp.axes[0] ?? 0;
        const ly = gp.axes[1] ?? 0;

        if (Math.abs(rx) > 0.05 || Math.abs(ry) > 0.05) {
            xAxis = rx;
            yAxis = ry;
        } else if (Math.abs(lx) > 0.05 || Math.abs(ly) > 0.05) {
            xAxis = lx;
            yAxis = ly;
        } else {
            continue;
        }

        camera.getWorldDirection(vForward);

        // Move the rig
        player.position.addScaledVector(vForward, -yAxis * speed);

        vRight.crossVectors(vForward, camera.up).normalize();
        player.position.addScaledVector(vRight, xAxis * speed);
    }
}