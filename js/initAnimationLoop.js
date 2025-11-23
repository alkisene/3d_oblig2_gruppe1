const _zeroVec = {};
import { handleControllerMovement, updateCameraControls } from "./cameraControls.js";
import { updateCelestialEntities } from "./CelestialEntitiesController.js";
import { updateBoat, updateCameraFollow } from "./daBoat.js";
import { WATER_TIME_SCALE } from "./config.js";
import {updateTreeLODs} from "./GPTTrees.js";

// Factory that returns the animate function to pass to renderer.setAnimationLoop
export function createAnimate({ clock, sun, moon, directionalLight, moonLight, sky, water, snow, camera, renderer, scene, player, controls, stats }) {
    if (!clock || !renderer || !camera || !scene) throw new Error("createAnimate: missing required params");

    return function animate() {
        const delta = Math.min(clock.getDelta(), 0.05);
        const time = Date.now() * 0.0001;

        //if using XR, handle controller movement, else update camera controls
        if (renderer.xr && renderer.xr.isPresenting) {
            handleControllerMovement(renderer, camera, player, delta);
        } else {
            updateCameraControls(delta);
        }

        // Celestial Entities
        updateCelestialEntities(delta, sun, moon, directionalLight, moonLight, sky, water, time);

        // Snow
        if (snow) snow.update();

        // Boat
        const boatPos = updateBoat(delta);
        updateCameraFollow(boatPos, camera);

        // Water time uniform (if exists)
        if (water?.material?.uniforms?.time) {
            water.material.uniforms.time.value += delta * WATER_TIME_SCALE;
        }
        try {
            updateTreeLODs(camera);
        } catch (e) {
            // ignore if tree module isn't initialized yet
        }

        renderer.render(scene, camera);
        stats?.update();
    };
}