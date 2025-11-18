"use strict";
// kjør "npx vite" for å kjøre programmet. og så på lokalhost linken som blir gennerert

// hentet eksempel kode fra : https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain_raycast.html

import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import {Water} from "three/addons/objects/Water.js";
import {initRaycast} from "./raycaster.js";
import {initCameraControls} from "./cameraControls.js";
import {loadAssets} from "./loaders.js";

let container, stats;

let camera, controls, scene, renderer, lod;

let worldWidth = 256;
let worldDepth = 256;

let mesh;
let helper;
let sun, directionalLight, water;
let raycastHandler;
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

    const {
        aagotnesHeightMap,
        diffuseMap,
        normalMap,
        roughnessMap,
        specularMap,
        waterNormalMap,
        sunTexture
    } = await loadAssets(renderer);
    
    ({camera, controls} = initCameraControls(renderer.domElement));

    renderer.setAnimationLoop(animate);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    //const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    //scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5000, 5000, 2000);
    scene.add(directionalLight);

    const sunGeometry = new THREE.SphereGeometry(100, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        map: sunTexture,
    });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.set(3000, 5000, 2000);
    scene.add(sun);

    directionalLight.position.copy(sun.position);


    lod = new THREE.LOD();
    const displaceMentScale = 400;
    const displaceMentBias = -100;

    const highResGeometry = new THREE.PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
    highResGeometry.rotateX(-Math.PI / 2);


    const highResMesh = new THREE.Mesh(highResGeometry, new THREE.MeshStandardMaterial({
        displacementMap: aagotnesHeightMap,
        displacementScale: displaceMentScale,
        displacementBias: displaceMentBias,
        normalMap: normalMap,
        roughnessMap: normalMap,
        metalnessMap: specularMap,
        metalness: 0.1,
        map: diffuseMap
    }));

    // Medium detail geometry (medium distance)
    const medResGeometry = new THREE.PlaneGeometry(7500, 7500, worldWidth / 2 - 1, worldDepth / 2 - 1);
    medResGeometry.rotateX(-Math.PI / 2);
    const medResMesh = new THREE.Mesh(medResGeometry, new THREE.MeshStandardMaterial({
        displacementMap: aagotnesHeightMap,
        displacementScale: displaceMentScale,
        displacementBias: displaceMentBias,
        metalnessMap: specularMap,
        metalness: 0.1,
        roughnessMap: roughnessMap,
        normalMap: normalMap,
        map: diffuseMap
    }));

    // Low detail geometry (far away)
    const lowResGeometry = new THREE.PlaneGeometry(7500, 7500, worldWidth / 4 - 1, worldDepth / 4 - 1);
    lowResGeometry.rotateX(-Math.PI / 2);
    const lowResMesh = new THREE.Mesh(lowResGeometry, new THREE.MeshStandardMaterial({
        displacementMap: aagotnesHeightMap,
        displacementScale: displaceMentScale,
        displacementBias: displaceMentBias,
        metalnessMap: specularMap,
        metalness: 0.1,
        roughnessMap: roughnessMap,
        normalMap: normalMap,
        map: diffuseMap
    }));

    lod.addLevel(highResMesh, 0);      // 0 to 2000 units
    lod.addLevel(medResMesh, 2000);    // 2000 to 5000 units
    lod.addLevel(lowResMesh, 5000);    // 5000+ units

    scene.add(lod);

    const waterGeometry = new THREE.PlaneGeometry(10000, 10000);
    const sundirection = new THREE.Vector3(3000, 5000, 2000).normalize();

    water = new Water(waterGeometry, {
        textureHeight: worldDepth,
        textureWidth: worldWidth,
        waterNormals: waterNormalMap,
        sunDirection: sundirection,
        sunColor: 0xffffff,
        waterColor: 0x001e0f,
        distortionScale: 3.7,
        fog: scene.fog !== undefined
    })
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

    window.addEventListener('resize', onWindowResize);
}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);

}


function animate() {


    const time = Date.now() * 0.00001;
    sun.position.x = Math.cos(time) * 5000;
    sun.position.y = Math.sin(time) * 3000 + 2000;
    sun.position.z = 2000;

    directionalLight.position.copy(sun.position);
    water.material.uniforms['sunDirection'].value.copy(sun.position).normalize();

    render();
    stats.update();

}

function render() {

    water.material.uniforms['time'].value += 1 / 60.0; // fart på vatnet
    renderer.render(scene, camera);

}


