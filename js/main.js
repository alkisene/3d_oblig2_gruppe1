"use strict";
// kjør "npx vite" for å kjøre programmet.

// hentet eksempel kode fra : https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain_raycast.html



import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {EXRLoader} from "three/addons";

let container, stats;

let camera, controls, scene, renderer;

let mesh;
let helper;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

init();

function init() {

    container = document.getElementById('container');
    container.innerHTML = '';

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 20000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1000;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI / 2;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(3000, 5000, 2000);
    scene.add(directionalLight);

    const exrLoader = new EXRLoader();
    const heightMapPath = 'asset/HeightMap/height_map.exr';
    const diffuseMapPath = 'asset/DiffuseMap/diffuse_map.exr';

    exrLoader.load(heightMapPath, (heightTex) => {

        heightTex.minFilter = THREE.LinearFilter;
        heightTex.magFilter = THREE.LinearFilter;

        const img = heightTex.image;
        const srcWidth = img.width;
        const srcHeight = img.height;

        const meshSegmentsX = 512;
        const meshSegmentsY = 512;

        const width = meshSegmentsX + 1;
        const height = meshSegmentsY + 1;

        const pixelData = img.data;

        function sampleHeight(u, v) {
            const x = Math.min(srcWidth - 1, Math.max(0, Math.floor(u * (srcWidth - 1))));
            const y = Math.min(srcHeight - 1, Math.max(0, Math.floor(v * (srcHeight - 1))));
            const idx = (y * srcWidth + x) * 4;
            return pixelData[idx];
        }

        const heightData = new Float32Array(width * height);
        for (let y = 0; y < height; y++) {
            const v = y / (height - 1);
            for (let x = 0; x < width; x++) {
                const u = x / (width - 1);
                heightData[y * width + x] = sampleHeight(u, v);
            }
        }

        // Normalize the height data
        let minHeight = Infinity;
        let maxHeight = -Infinity;
        for (let i = 0; i < heightData.length; i++) {
            minHeight = Math.min(minHeight, heightData[i]);
            maxHeight = Math.max(maxHeight, heightData[i]);
        }
        const range = maxHeight - minHeight;

        const outScale = 0.5;   // scales normalized heights (try 0.1 .. 1.0)
        const outOffset = 0;   // shifts baseline (keep 0.0 for no offset)

        const invRange = range !== 0 ? 1 / range : 0;

        for (let i = 0; i < heightData.length; i++) {
            const n = (heightData[i] - minHeight) * invRange; // normalize to 0..1
            heightData[i] = n * outScale + outOffset;         // apply scaling and offset
        }

        const terrainSize = 7500;
        const geometry = new THREE.PlaneGeometry(
            terrainSize,
            terrainSize,
            meshSegmentsX,
            meshSegmentsY
        );
        geometry.rotateX(-Math.PI / 2);

        const vertices = geometry.attributes.position.array;
        const heightScale = 1000;

        for (let i = 0, j = 0, l = heightData.length; i < l; i++, j += 3) {
            vertices[j + 1] = heightData[i] * heightScale;
        }
        geometry.computeVertexNormals();

        // Load EXR diffuse texture
        exrLoader.load(diffuseMapPath, (diffuseTexture) => {
            diffuseTexture.wrapS = THREE.ClampToEdgeWrapping;
            diffuseTexture.wrapT = THREE.ClampToEdgeWrapping;
            diffuseTexture.colorSpace = THREE.SRGBColorSpace;
            diffuseTexture.minFilter = THREE.LinearFilter;
            diffuseTexture.magFilter = THREE.LinearFilter;

            mesh = new THREE.Mesh(
                geometry,
                new THREE.MeshStandardMaterial({ map: diffuseTexture })
            );
            scene.add(mesh);

            const centerIndex =
                (Math.floor(height / 2) * width) + Math.floor(width / 2);
            controls.target.set(
                0,
                heightData[centerIndex] * heightScale + 500,
                0
            );
            camera.position.set(2000, controls.target.y + 2000, 0);
            controls.update();
        });
    });

    const geometryHelper = new THREE.ConeGeometry(20, 100, 3);
    geometryHelper.translate(0, 50, 0);
    geometryHelper.rotateX(Math.PI / 2);
    helper = new THREE.Mesh(geometryHelper, new THREE.MeshNormalMaterial());
    scene.add(helper);

    container.addEventListener('pointermove', onPointerMove);

    stats = new Stats();
    container.appendChild(stats.dom);

    window.addEventListener('resize', onWindowResize);
}


function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

}


function animate() {

    render();
    stats.update();

}

function render() {

    renderer.render( scene, camera );

}



function onPointerMove(event) {
    if (!mesh) return; // don't run until mesh is loaded

    pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    pointer.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const intersects = raycaster.intersectObject(mesh);

    if (intersects.length > 0) {
        helper.position.set(0, 0, 0);
        helper.lookAt(intersects[0].face.normal);
        helper.position.copy(intersects[0].point);
    }
}




