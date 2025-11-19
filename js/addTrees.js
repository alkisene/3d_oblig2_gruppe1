import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";

const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

const objLoader = new OBJLoader()
const mtlLoader = new MTLLoader();
let treeTemplate = null; // cached, textured model
// let materialsLoaded = false;

export async function initTreePlacer({camera, scene, container, lod, displacementMap}){

    if (!lod) {
        console.error("initTreePlacer: lod is undefined");
        return;
    }
    if (!displacementMap || !displacementMap.image) {
        console.error("initTreePlacer: displacementMap/image not ready");
        return;
    }

    const sampleHeight = createHeightSampler(displacementMap, lod);

    function onDoubleClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(lod, true); // true = recurse into children
        if (!hits.length) return;

        const hit = hits[0];            // <- keep the whole intersection
        const point = hit.point.clone(); // <- clone the Vector3

        if (hit.uv) {
            const height = sampleHeight(hit.uv);
            if(height < 5) { // We don't place trees too near the shore or in water
                return;
            }
            point.y = height - 1;
        }

        console.log(point);
        spawnTree(point, scene);
    }

    container.addEventListener('dblclick', onDoubleClick);
    return function disposeRaycast() {
        container.removeEventListener('dblclick', onDoubleClick);
    };
}

// Helpers
function spawnTree(point, scene) {
    // If we've already loaded the tree once, just clone it
    if (treeTemplate) {
        const tree = treeTemplate.clone(true);
        tree.position.copy(point);
        const scalar = Math.random() * 5 + 3;
        tree.scale.set(scalar, scalar, scalar);
        scene.add(tree);
        return;
    }

    // First time: load materials, then OBJ, then cache template
    mtlLoader.setPath("asset/Tree 02/");
    mtlLoader.setResourcePath("asset/Tree 02/"); // where textures live

    mtlLoader.load("Tree.mtl", (materials) => {
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.setPath("asset/Tree 02/");

        objLoader.load("Tree.obj", (object) => {
            treeTemplate = object; // cache original

            const tree = object.clone(true);
            tree.position.copy(point);
            const scalar = Math.random() * 5 + 3;
            tree.scale.set(scalar, scalar, scalar);
            scene.add(tree);
        });
    });
}

// --- create a sampler from the displacement map ---
function createHeightSampler(displacementMap, lod) {
    const img = displacementMap.image;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    // Try to reuse the material’s displacementScale / Bias so it matches the terrain
    let displacementScale = 1;
    let displacementBias  = 0;

    // grab first mesh material inside the LOD
    const mesh = lod.children.find(c => c.isMesh);
    if (mesh) {
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) {
            if (typeof mat.displacementScale === "number") displacementScale = mat.displacementScale;
            if (typeof mat.displacementBias  === "number") displacementBias  = mat.displacementBias;
        }
    }

    return function sampleHeight(uv) {
        // uv from raycaster: (0,0) bottom-left, (1,1) top-right
        const x = Math.min(img.width  - 1, Math.max(0, Math.floor(uv.x * img.width)));
        const y = Math.min(img.height - 1, Math.max(0, Math.floor((1 - uv.y) * img.height))); // flip Y

        const i = (y * img.width + x) * 4;
        const r = data[i]; // assume grayscale height in red channel 0–255

        const h01 = r / 255; // 0..1
        return h01 * displacementScale + displacementBias; // world height
    };
}

