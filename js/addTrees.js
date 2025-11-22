import * as THREE from "three";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";

const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

const objLoader = new OBJLoader()
const mtlLoader = new MTLLoader();
let treeTemplate= null, treeTemplateMid = null, treeTemplateLow = null; // cached, textured model
// let materialsLoaded = false;

const treePlacerState = {
    scene: null,
    lod:   null,
    sampleHeight: null,
    bbox: null,
};

export function initTreePlacer({camera, scene, container, lod, displacementMap}){

    if (!lod) {
        console.error("initTreePlacer: lod is undefined");
        return;
    }
    if (!displacementMap || !displacementMap.image) {
        console.error("initTreePlacer: displacementMap/image not ready");
        return;
    }

    const sampleHeight = createHeightSampler(displacementMap, lod);

    // Store state so we can do random placement later
    treePlacerState.scene = scene;
    treePlacerState.lod = lod;
    treePlacerState.sampleHeight = sampleHeight;
    treePlacerState.bbox = new THREE.Box3().setFromObject(lod);

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
            if(height < 5 || height > 30) { // We don't place trees too near the shore or in water
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
// Update the spawnTree function in js/addTrees.js
function spawnTree(point, scene) {
    if (treeTemplate && treeTemplateMid && treeTemplateLow) {
        const lod = new THREE.LOD();

        const treeHigh = treeTemplate.clone(true);
        const treeMid = treeTemplateMid.clone(true);
        const treeLow = treeTemplateLow.clone(true);

        lod.addLevel(treeHigh, 0);
        lod.addLevel(treeMid, 1500);
        lod.addLevel(treeLow, 3000);

        lod.position.copy(point);
        const scalar = Math.random() * 5 + 3;
        lod.scale.set(scalar, scalar, scalar);

        scene.add(lod);
        return;
    }

    // Load materials for high-res only
    mtlLoader.setPath("asset/Tree 02/");
    mtlLoader.setResourcePath("asset/Tree 02/");

    mtlLoader.load("Tree.mtl", (materials) => {
        materials.preload();
        objLoader.setPath("asset/Tree 02/");

        Promise.all([
            new Promise(resolve => {
                objLoader.setMaterials(materials);
                objLoader.load("Tree.obj", resolve);
            }),
            new Promise(resolve => {
                objLoader.load("Tree_mid.obj", resolve);
            }),
            new Promise(resolve => {
                objLoader.load("tree_low.obj", resolve);
            })
        ]).then(([objHigh, objMid, objLow]) => {
            // Apply a simple fallback material to LOD models
            const fallbackMaterial = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                roughness: 0.8
            });

            objMid.traverse(child => {
                if (child.isMesh) child.material = fallbackMaterial;
            });
            objLow.traverse(child => {
                if (child.isMesh) child.material = fallbackMaterial;
            });

            enableShadows(objHigh);
            enableShadows(objMid);
            enableShadows(objLow);

            treeTemplate = objHigh;
            treeTemplateMid = objMid;
            treeTemplateLow = objLow;

            const lod = new THREE.LOD();
            lod.addLevel(objHigh.clone(true), 0);
            lod.addLevel(objMid.clone(true), 1500);
            lod.addLevel(objLow.clone(true), 3000);

            lod.position.copy(point);
            const scalar = Math.random() * 5 + 3;
            lod.scale.set(scalar, scalar, scalar);

            scene.add(lod);
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
    let displacementScale = 400;
    let displacementBias  = -17;

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

// treeCount:     how many trees total
// treesPerFrame: how many new trees to spawn per animation frame
// personalSpace: min spacing around a tree, in WORLD units (XZ plane)
// gridResolution: number of cells along each side of the logical grid
export function populateTreesRandomly(
    treeCount = 500,
    treesPerFrame = 10,
    personalSpace = 25,
    gridResolution = 256
) {
    const { scene, lod, sampleHeight, bbox } = treePlacerState;

    if (!scene || !lod || !sampleHeight || !bbox) {
        console.error("populateTreesRandomly: tree placer not initialized yet");
        return;
    }

    const GRID_COLS = gridResolution;
    const GRID_ROWS = gridResolution;

    // Compute world size of each grid cell
    const width  = bbox.max.x - bbox.min.x;
    const depth  = bbox.max.z - bbox.min.z; // can be negative, we'll use abs below
    const cellSizeX = width / GRID_COLS;
    const cellSizeZ = Math.abs(depth) / GRID_ROWS;
    const cellWorldSize = Math.max(cellSizeX, cellSizeZ);

    // Convert personal space (world units) -> radius in grid cells
    const radiusCells = Math.max(0, Math.ceil(personalSpace / cellWorldSize));

    // --- 1. Build grid of valid spots ---
    const grid = new Array(GRID_COLS);
    for (let i = 0; i < GRID_COLS; i++) {
        grid[i] = new Array(GRID_ROWS);
    }

    const validCells = [];

    for (let i = 0; i < GRID_COLS; i++) {
        const u = (i + 0.5) / GRID_COLS;
        for (let j = 0; j < GRID_ROWS; j++) {
            const v = (j + 0.5) / GRID_ROWS;

            const height = sampleHeight({ x: u, y: v });
            if (height <= 5 || height >= 200) {
                grid[i][j] = null;
                continue;
            }

            const x = THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, u);
            // flip v → world Z because of rotateX(-PI/2)
            const z = THREE.MathUtils.lerp(bbox.max.z, bbox.min.z, v);

            grid[i][j] = {
                valid: true,
                x,
                z,
                height,
                i,
                j,
                listIndex: validCells.length,
            };
            validCells.push({ i, j });
        }
    }

    function invalidateCell(i, j) {
        const cell = grid[i][j];
        if (!cell || !cell.valid) return;

        cell.valid = false;

        const index = cell.listIndex;
        const lastEntry = validCells[validCells.length - 1];

        if (index < validCells.length - 1) {
            // move last entry into this slot
            validCells[index] = lastEntry;
            const movedCell = grid[lastEntry.i][lastEntry.j];
            movedCell.listIndex = index;
        }

        validCells.pop();
        cell.listIndex = -1;
    }

    let placed = 0;

    // --- 2. Per-frame spawning ---
    function step() {
        let spawnedThisFrame = 0;

        while (
            spawnedThisFrame < treesPerFrame &&
            placed < treeCount &&
            validCells.length > 0
            ) {
            const randIndex = Math.floor(Math.random() * validCells.length);
            const { i, j } = validCells[randIndex];
            const cell = grid[i][j];

            if (!cell || !cell.valid) {
                invalidateCell(i, j);
                continue;
            }

            const position = new THREE.Vector3(cell.x, cell.height - 1, cell.z);
            spawnTree(position, scene);
            placed++;
            spawnedThisFrame++;

            // Invalidate everything in "personal space" radius (in cells)
            for (let di = -radiusCells; di <= radiusCells; di++) {
                const ii = i + di;
                if (ii < 0 || ii >= GRID_COLS) continue;

                for (let dj = -radiusCells; dj <= radiusCells; dj++) {
                    const jj = j + dj;
                    if (jj < 0 || jj >= GRID_ROWS) continue;

                    if (grid[ii][jj] && grid[ii][jj].valid) {
                        invalidateCell(ii, jj);
                    }
                }
            }
        }

        if (placed < treeCount && validCells.length > 0) {
            requestAnimationFrame(step);
        } else {
            console.log(
                `populateTreesRandomly: requested ${treeCount}, placed ${placed}, remaining valid spots: ${validCells.length}`
            );
        }
    }

    requestAnimationFrame(step);
}

const enableShadows = (obj) => {
    obj.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
};
