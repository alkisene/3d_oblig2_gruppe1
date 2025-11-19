import * as THREE from "three";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";

const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

const objLoader = new OBJLoader()
const mtlLoader = new MTLLoader();
let treeTemplate = null; // cached, textured model
// let materialsLoaded = false;

const treePlacerState = {
    scene: null,
    lod:   null,
    sampleHeight: null,
    bbox: null,
};

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

// --- Random tree population based on density scalar (no raycasting) ---
export function populateTreesRandomly(treeCount = 100, treesPerFrame = 3) {
    const { scene, lod, sampleHeight, bbox } = treePlacerState;

    if (!scene || !lod || !sampleHeight || !bbox) {
        console.error("populateTreesRandomly: tree placer not initialized yet");
        return;
    }

    // ---- 1. Build the grid of valid spots (fast) ----
    const GRID_COLS = 128;
    const GRID_ROWS = 128;

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

            if (height <= 5) {
                grid[i][j] = null;
                continue;
            }

            const x = THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, u);
            // IMPORTANT: v is flipped in world Z due to rotateX(-PI/2)
            const z = THREE.MathUtils.lerp(bbox.max.z, bbox.min.z, v);

            const cell = {
                valid: true,
                x,
                z,
                height,
                i,
                j,
                listIndex: validCells.length,
            };

            grid[i][j] = cell;
            validCells.push({ i, j });
        }
    }

    // ---- 2. Helpers for the incremental placement ----
    function invalidateCell(i, j) {
        const cell = grid[i][j];
        if (!cell || !cell.valid) return;

        cell.valid = false;

        const index = cell.listIndex;
        const lastEntry = validCells[validCells.length - 1];

        if (index < validCells.length - 1) {
            validCells[index] = lastEntry;
            const movedCell = grid[lastEntry.i][lastEntry.j];
            movedCell.listIndex = index;
        }

        validCells.pop();
        cell.listIndex = -1;
    }

    let placed = 0;

    // ---- 3. Per-frame step using requestAnimationFrame ----
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

            // Kill this cell + 3×3 neighbours
            for (let di = -1; di <= 1; di++) {
                const ii = i + di;
                if (ii < 0 || ii >= GRID_COLS) continue;

                for (let dj = -1; dj <= 1; dj++) {
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

    // Kick off the async placement; returns immediately so the scene stays responsive.
    requestAnimationFrame(step);
}