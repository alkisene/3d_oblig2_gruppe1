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

export function initCamera() {
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 5500);
    camera.position.set(550, 480, 2250);
    camera.lookAt(0, 0, 0);
    return camera;
}

export function initControls(cam, rendererDom) {
    camera = cam || camera;
    controls = new OrbitControls(camera, rendererDom);
    controls.minDistance = 100;
    controls.maxDistance = 50000;
    controls.maxPolarAngle = Math.PI;
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return controls;
}

export function updateCameraControls(delta) {
    if (!controls || !camera) return;
    if (!controls.enabled) return;

    const isMoving =
        move.forward || move.backward ||
        move.left || move.right ||
        move.up || move.down;

    if (!isMoving && !controls.enableDamping) {
        return; // nothing to do
    }
    if (isMoving) {
        updateKeyboardMovement(delta);
    }
    controls.update();
}

//VR Controller Movement handling
const forward = new THREE.Vector3();
const right = new THREE.Vector3();

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
        camera.getWorldDirection(forward);

        // Move the rig
        player.position.addScaledVector(forward, -yAxis * speed);

        right.crossVectors(forward, camera.up).normalize();
        player.position.addScaledVector(right, xAxis * speed);
    }
}

export function initVRControllers(renderer, scene, camera, player) {
    const controller1 = renderer.xr.getController(0);
    const controller2 = renderer.xr.getController(1);
    scene.add(controller1);
    scene.add(controller2);

    const controllerGrip1 = renderer.xr.getControllerGrip(0);
    const controllerGrip2 = renderer.xr.getControllerGrip(1);

    player.add(camera);
    scene.add(player);
    player.add(controller1);
    player.add(controller2);
    player.add(controllerGrip1);
    player.add(controllerGrip2);
    player.position.set(0, 0, 0);

    renderer.xr.addEventListener('sessionstart', () => {
        controls.enabled = false;
        player.position.set(0, 50, 150);
    });

    renderer.xr.addEventListener('sessionend', () => {
        player.position.set(0, 0, 0);
        controls.enabled = true;
    });
}