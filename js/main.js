"use strict";
// kjør "npx vite" for å kjøre programmet. og så på lokalhost linken som blir gennerert

// hentet eksempel kode fra : https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain_raycast.html

import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';
import {Water} from "three/addons/objects/Water.js";
import {Sky} from "three/addons/objects/Sky";

import {initRaycast} from "./raycaster.js";
import {initCameraControls, updateCameraControls} from "./cameraControls.js";
import {loadAssets} from "./loaders.js";
import {createLODMesh} from "./LOD.js";
import {createCelestialEntity} from "./celestialEntity.js";
import {initTreePlacer, populateTreesRandomly} from "./addTrees";


import { SnowEffect } from './SnowEffect.js';

let container, stats;

let camera, controls, scene, renderer;

let snow;

let worldWidth = 256;
let worldDepth = 256;

let mesh;
let helper;
let sun, moon, directionalLight, moonLight, water, sky, fog;
let raycastHandler;
let treePlacer;
let clock;

const WATER_TIME_SCALE = 1.0;
const sunColor = new THREE.Color(0xffffff);
const moonColor = new THREE.Color(0x88aaff);
init().catch(err => console.error(err));

async function init() {
    container = document.getElementById('container');
    container.innerHTML = '';

    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);

    // bruker MSAA 4x eller det høyeste tilgjengelig.
    renderer.samples = Math.min(4, renderer.capabilities.maxSamples)

    const {
        displacementMap,
        diffuseMap,
        normalMap,
        roughnessMap,
        specularMap,
        waterNormalMap,
        sunTexture,
        moonTexture
    } = await loadAssets(renderer);

    ({camera, controls} = initCameraControls(renderer.domElement));
    clock = new THREE.Clock();
    renderer.setAnimationLoop(animate);

    scene = new THREE.Scene();
    sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);

    const skyUniforms = sky.material.uniforms; // ignore shit works
    skyUniforms['turbidity'].value = 10;
    skyUniforms['rayleigh'].value = 3;
    skyUniforms['mieCoefficient'].value = 0.005;
    skyUniforms['mieDirectionalG'].value = 0.7;

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5000, 5000, 2000);
    scene.add(directionalLight);

    sun = createCelestialEntity(scene, sunTexture, 100, 32, 32, 3000, 5000, 2000);
    directionalLight.position.copy(sun.position);

    moon = createCelestialEntity(scene, moonTexture, 150, 32, 32, 3000, 5000, 2000);

    moonLight = new THREE.DirectionalLight(moonColor, 0.0);
    moonLight.position.copy(moon.position);
    scene.add(moonLight);


    snow = new SnowEffect({
        scene: scene,
        count: 20000,
        size: 130,
        radius: 2,
        areaScale: 20,
        snowFallSpeed: 1
    });
    snow.points.frustumCulled = false; // default køllingen lager hull i snøen...finnes sikkert en bedre løsning


    const {
        lod,
        highResMesh
    } = createLODMesh(scene, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, worldWidth, worldDepth);

    const waterGeometry = new THREE.PlaneGeometry(7500, 7500);
    const sunDirection = new THREE.Vector3(3000, 5000, 2000).normalize();

    fog = new THREE.FogExp2(scene.background,0.00025);
    scene.fog = fog;


    water = new Water(waterGeometry, {
        textureHeight: 2048,
        textureWidth: 2048,
        waterNormals: waterNormalMap,
        sunDirection: sunDirection,
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    });
    water.rotateX(-Math.PI / 2);
    water.position.y = 0;
    scene.add(water);

    mesh = highResMesh;

    const geometryHelper = new THREE.ConeGeometry(20, 100, 3);
    geometryHelper.translate(0, 50, 0);
    geometryHelper.rotateX(Math.PI / 2);
    helper = new THREE.Mesh(geometryHelper, new THREE.MeshNormalMaterial());
    scene.add(helper);

    raycastHandler = initRaycast({camera, renderer, lod, helper, container});
    stats = new Stats();
    container.appendChild(stats.dom);

    treePlacer = initTreePlacer({camera, scene, container, lod, displacementMap});

    populateTreesRandomly(500, 1, 5, 2048)

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const delta = clock.getDelta();
    const time = Date.now() * 0.001;

    updateCameraControls(delta);

    // Sun orbit
    sun.position.x = Math.cos(time) * 5000;
    sun.position.y = Math.sin(time) * 3000 + 2000;
    sun.position.z = 2000;

    // Moon 180° out of phase so it rises as the sun sets
    const moonPhase = time + Math.PI;
    moon.position.x = Math.cos(moonPhase) * 5000;
    moon.position.y = Math.sin(moonPhase) * 3000 + 2000;
    moon.position.z = 2000;

    // Keep directional light following the sun
    directionalLight.position.copy(sun.position);
    moonLight.position.copy(moon.position);
    sky.material.uniforms['sunPosition'].value.copy(sun.position);


    // Adjust moonlight intensity based on sun height
    const nightFactor = THREE.MathUtils.clamp(1 - (sun.position.y / 2000), 0, 1);
    moonLight.intensity = 0.3 * nightFactor;

    water.material.uniforms.sunColor.value.copy(sunColor).lerp(moonColor, nightFactor);
    water.material.uniforms.sunDirection.value.copy(sun.position).normalize();
    water.material.uniforms.sunDirection.value.copy(moon.position).normalize();

    // snow
    snow.update();

    render(delta);
    stats.update();
}

function render(delta) {
    water.material.uniforms['time'].value += delta * WATER_TIME_SCALE; // fart på vatnet
    renderer.render(scene, camera);
}
