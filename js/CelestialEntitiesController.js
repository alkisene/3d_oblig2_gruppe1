import * as THREE from 'three';
import {moonColor, sunColor} from "./config.js";
import {createCelestialEntity} from "./celestialEntities.js";

export function initCelestialEntities(scene, sunTexture, moonTexture) {

    //Creates moon and sun entities
    const sun = createCelestialEntity(scene, sunTexture, 100, 32, 32, 3000, 5000, 2000);
    const moon = createCelestialEntity(scene, moonTexture, 150, 32, 32, 3000, 5000, 2000);
    return {sun, moon};
}

export function updateCelestialEntities(delta, sun, moon, directionalLight, moonLight, sky, water, time) {
    if (!sun || !moon) return;

    // Orbit positions
    sun.position.x = Math.cos(time) * 5000;
    sun.position.y = Math.sin(time) * 3000 + 2000;
    sun.position.z = 2000;
    //moon is always opposite the sun
    const moonPhase = time + Math.PI;
    moon.position.x = Math.cos(moonPhase) * 5000;
    moon.position.y = Math.sin(moonPhase) * 3000 + 2000;
    moon.position.z = 2000;

    if (directionalLight) directionalLight.position.copy(sun.position);
    if (moonLight) moonLight.position.copy(moon.position);

    if (sky && sky.material && sky.material.uniforms && sky.material.uniforms.sunPosition) {
        sky.material.uniforms.sunPosition.value.copy(sun.position);
    }
    //rorates the moon
    const moonSpinSpeed = 0.6; // radians per second
    moon.rotation.y += moonSpinSpeed * delta;
    moon.rotation.y = moon.rotation.y % (2 * Math.PI);

    //hides the moon when underground
    moon.visible = moon.position.y > -150;
    // nightFactor: 0 = day, 1 = night
    const nightFactor = THREE.MathUtils.clamp(1 - (sun.position.y / 2000), 0, 1);

    if (typeof moonLight !== 'undefined' && moonLight !== null) {
        moonLight.intensity = 0.3 * nightFactor;
    }

    // Update water shader uniforms if available
    if (water && water.material && water.material.uniforms) {
        const u = water.material.uniforms;
        if (u.sunColor && u.sunColor.value) {
            u.sunColor.value.copy(sunColor).lerp(moonColor, nightFactor);
        }
        if (u.sunDirection && u.sunDirection.value) {
            const sunDir = sun.position.clone().normalize();
            const moonDir = moon.position.clone().normalize();
            const blended = sunDir.lerp(moonDir, nightFactor).normalize();
            u.sunDirection.value.copy(blended);
        }
    }

    return {nightFactor};
}