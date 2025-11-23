import * as THREE from "three";
import {createSky} from "./celestialEntities.js";
import {initCelestialEntities} from "./CelestialEntitiesController.js";
import {initDirectionalLight, initMoonLight} from "./lighting.js";
import {createWater} from "./water.js";
import {SnowEffect} from "./snowEffect.js";

// Accept scene and textures, return created objects so caller can use them
export function initEnvironment(scene, waterNormalMap, sunTexture, moonTexture, snowTexture) {
    if (!scene) throw new Error("initEnvironment: scene required");

    const sunDirection = new THREE.Vector3(3000, 5000, 2000).normalize();
    const sky = createSky(scene, {turbidity: 10, rayleigh: 3, mieCoefficient: 0.005, mieDirectionalG: 0.7});

    const {sun, moon} = initCelestialEntities(scene, sunTexture, moonTexture);

    const directionalLight = initDirectionalLight();
    const moonLight = initMoonLight(0x88aaff);
    scene.add(directionalLight, moonLight);

    directionalLight.position.copy(sun.position);
    moonLight.position.copy(moon.position);

    sun.visible = false;

    const water = createWater(scene, waterNormalMap, sunDirection);
    water.rotateX(-Math.PI / 2);
    water.position.y = 0;
    scene.add(water);

    // create snow (snowTexture optional, snow shader uses its own texture)
    const snow = new SnowEffect({
        scene,
        count: 8000,
        size: 100,
        radius: 2,
        areaScale: 16,
        snowFallSpeed: 1,
        textureUrl: snowTexture ? undefined : undefined
    });
    snow.points.frustumCulled = false;

    return {sun, moon, directionalLight, moonLight, sky, water, snow};
}