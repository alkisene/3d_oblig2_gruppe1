import {initControls, initVRControllers} from "./cameraControls.js";

export function setupUIAndInput(renderer, camera, scene, player) {
    initVRControllers(renderer, scene, camera, player);
    return initControls(camera, renderer.domElement);
}