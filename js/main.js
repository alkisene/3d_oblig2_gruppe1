"use strict";
// kjør "npx vite" for å kjøre programmet. og så på lokalhost linken som blir gennerert

// hentet eksempel kode fra : https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain_raycast.html

import * as THREE from 'three';

import {worldDepth, worldWidth} from "./config.js";
import {initRaycast} from "./raycaster.js";
import {loadAssets} from "./assetLoaders.js";
import {createLODMesh, geometryHelper} from "./LOD.js";
import {initRenderer} from "./initRenderer.js";
import {initScene} from "./initScene.js";
import {initEnvironment} from "./initEnvironment.js";
import {initTerrainLOD} from "./initTerrainLOD.js";
import {createAnimate} from "./initAnimationLoop.js";
import {setupResizeHandler} from "./resize.js";
import {setupUIAndInput} from "./initUIAndInput.js";

let container, stats;
let lod;
let camera, controls, scene, renderer;
let mesh;
let helper;
let sun, moon, directionalLight, moonLight, water, sky, snow;
let raycastHandler;
const player = new THREE.Group();
const clock = new THREE.Clock();
let ambient;

bootstrap().catch(err => console.error(err));

async function bootstrap() {
    // 1) renderer + camera + DOM
    ({renderer, camera, container} = await initRenderer());

    // 2) create scene + stats
    ({scene, stats, ambient} = initScene({container}));

    // 3) setup UI + input (pass renderer, camera, scene, player)
    controls = setupUIAndInput(renderer, camera, scene, player);

    // 4) load assets (textures)
    const assets = await loadAssets(renderer);
    const {
        displacementMap,
        diffuseMap,
        normalMap,
        roughnessMap,
        specularMap,
        waterNormalMap,
        sunTexture,
        moonTexture,
        snowTexture
    } = assets;

    // 5) environment
    ({sun, moon, directionalLight, moonLight, sky, water, snow} =
        initEnvironment(scene, waterNormalMap, sunTexture, moonTexture, snowTexture));

    // 6) terrain + LOD (pass camera & container so tree/boat modules can attach)
    ({
        mesh,
        lod,
        helper
    } = initTerrainLOD(scene, camera, container, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, snowTexture, createLODMesh, geometryHelper, worldWidth, worldDepth));

    // 7) raycast helper (use the helper returned from terrain)
    raycastHandler = initRaycast({camera, renderer, lod, helper, container});

    // 8) create animate function and start loop
    const animate = createAnimate({
        clock,
        sun,
        moon,
        directionalLight,
        moonLight,
        sky,
        water,
        snow,
        camera,
        renderer,
        scene,
        player,
        controls,
        stats
    });
    renderer.setAnimationLoop(animate);

    // 9) resize handler
    setupResizeHandler(renderer, camera);
}