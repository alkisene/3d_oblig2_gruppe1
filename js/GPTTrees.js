// javascript
import * as THREE from "three";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";

const mouse = new THREE.Vector2();
const ray = new THREE.Raycaster();

const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

let treeTemplateHigh = null;
let treeTemplateMid = null;
let treeTemplateLow = null;

// Pool of instanced meshes and related data
const instancedPool = {
    high: null,
    mid: null,
    low: null,
    maxInstances: 0,
    used: 0,
    // uniforms shared between all three LOD meshes
    uniforms: null
};

// Reusable temporary objects
const _dummyObject = new THREE.Object3D();

const treePlacerState = {
    scene: null,
    lod: null,
    sampleHeight: null,
    bbox: null
};

const MAX_INSTANCES_DEFAULT = 15000;

// --- Shader for per\-instance LOD ---
const LOD_VERTEX_SNIPPET = /* glsl */`
    uniform vec3 uCameraPosition;
    uniform float uLodNear;
    uniform float uLodFar;

    attribute float instanceLodLevel;
`;

// actual logic injected into vertex shader main
const LOD_VERTEX_MAIN_LOGIC = /* glsl */`
    vec3 worldPos = transformed.xyz;
    vec3 instanceWorldPos = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    float distToCam = distance(uCameraPosition, instanceWorldPos);

    bool visibleInstance = false;

    if (instanceLodLevel < 0.5) {
        visibleInstance = distToCam < uLodNear;
    } else if (instanceLodLevel < 1.5) {
        visibleInstance = distToCam >= uLodNear && distToCam < uLodFar;
    } else {
        visibleInstance = distToCam >= uLodFar;
    }

    if (!visibleInstance) {
        transformed.xyz = vec3(0.0, -100000.0, 0.0);
    } else {
        transformed = worldPos;
    }
`;

// Helper to wrap MeshStandardMaterial and inject our LOD vertex logic
function createInstancedLodMaterial(baseMaterial, sharedUniforms) {
    const material = baseMaterial.clone();
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uCameraPosition = sharedUniforms.uCameraPosition;
        shader.uniforms.uLodNear = sharedUniforms.uLodNear;
        shader.uniforms.uLodFar = sharedUniforms.uLodFar;

        shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `#include <common>\n${LOD_VERTEX_SNIPPET}`
        );

        shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            `
            #include <project_vertex>
            ${LOD_VERTEX_MAIN_LOGIC}
            `
        );
    };

    material.needsUpdate = true;
    return material;
}

// Build instanced meshes from a loaded tree model group
function createInstancedMeshesFromModel(modelGroup, maxInstances, sharedUniforms, lodLevel) {
    let sourceMesh = null;
    modelGroup.traverse((child) => {
        if (child.isMesh && !sourceMesh) {
            sourceMesh = child;
        }
    });

    if (!sourceMesh) {
        throw new Error("createInstancedMeshesFromModel: no mesh found in modelGroup");
    }

    const baseGeometry = sourceMesh.geometry;
    const baseMaterial = Array.isArray(sourceMesh.material)
        ? sourceMesh.material[0]
        : sourceMesh.material;

    const geometry = baseGeometry.clone();
    const material = createInstancedLodMaterial(baseMaterial, sharedUniforms);

    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;

    // Attach attribute to the *instanced* geometry
    const lodArray = new Float32Array(maxInstances);
    lodArray.fill(lodLevel);
    instancedMesh.geometry.setAttribute(
        "instanceLodLevel",
        new THREE.InstancedBufferAttribute(lodArray, 1, false)
    );

    const identity = new THREE.Matrix4();
    for (let i = 0; i < maxInstances; i++) {
        instancedMesh.setMatrixAt(i, identity);
    }
    instancedMesh.instanceMatrix.needsUpdate = true;

    return instancedMesh;
}

// Create pool of three instanced LOD meshes
function buildInstancedLOD(scene, highModel, midModel, lowModel, maxInstances) {
    instancedPool.maxInstances = maxInstances;
    instancedPool.used = 0;

    instancedPool.uniforms = {
        uCameraPosition: {value: new THREE.Vector3()},
        uLodNear: {value: 1500.0},
        uLodFar: {value: 3000.0}
    };

    instancedPool.high = createInstancedMeshesFromModel(
        highModel,
        maxInstances,
        instancedPool.uniforms,
        0.0
    );
    instancedPool.mid = createInstancedMeshesFromModel(
        midModel,
        maxInstances,
        instancedPool.uniforms,
        1.0
    );
    instancedPool.low = createInstancedMeshesFromModel(
        lowModel,
        maxInstances,
        instancedPool.uniforms,
        2.0
    );

    scene.add(instancedPool.high);
    scene.add(instancedPool.mid);
    scene.add(instancedPool.low);
}

// Spawn by writing into the next free instance slot
function spawnTreeInstanced(position, scene) {
    if (!instancedPool.high) return;
    if (instancedPool.used >= instancedPool.maxInstances) return;

    const index = instancedPool.used++;

    _dummyObject.position.copy(position);
    _dummyObject.rotation.y = Math.random() * Math.PI * 2;
    const s = Math.random() * 5 + 3;
    _dummyObject.scale.setScalar(s);
    _dummyObject.updateMatrix();

    instancedPool.high.setMatrixAt(index, _dummyObject.matrix);
    instancedPool.mid.setMatrixAt(index, _dummyObject.matrix);
    instancedPool.low.setMatrixAt(index, _dummyObject.matrix);

    instancedPool.high.instanceMatrix.needsUpdate = true;
    instancedPool.mid.instanceMatrix.needsUpdate = true;
    instancedPool.low.instanceMatrix.needsUpdate = true;
}

// Fallback: used until models are loaded and pool is ready
function spawnTreeFallback(point, scene) {
    if (instancedPool.high && instancedPool.mid && instancedPool.low) {
        spawnTreeInstanced(point, scene);
        return;
    }

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
                objLoader.setMaterials(materials);
                objLoader.load("Tree_mid.obj", resolve);
            }),
            new Promise(resolve => {
                objLoader.setMaterials(materials);
                objLoader.load("tree_low.obj", resolve);
            })
        ]).then(([objHigh, objMid, objLow]) => {
            const fallbackMaterial = new THREE.MeshStandardMaterial({
                color: 0x228B22,
                roughness: 0.8
            });

            objMid.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material = fallbackMaterial;
                }
            });
            objLow.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    child.material = fallbackMaterial;
                }
            });

            objHigh.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            treeTemplateHigh = objHigh;
            treeTemplateMid = objMid;
            treeTemplateLow = objLow;

            buildInstancedLOD(
                treePlacerState.scene,
                objHigh,
                objMid,
                objLow,
                instancedPool.maxInstances || MAX_INSTANCES_DEFAULT
            );

            spawnTreeInstanced(point, treePlacerState.scene);
        });
    });
}

export function initTreePlacer({
                                   camera,
                                   scene,
                                   container,
                                   lod,
                                   displacementMap,
                                   maxInstances = MAX_INSTANCES_DEFAULT
                               }) {
    if (!lod) {
        console.error("initTreePlacer: lod is undefined");
        return;
    }
    if (!displacementMap || !displacementMap.image) {
        console.error("initTreePlacer: displacementMap/image not ready");
        return;
    }

    treePlacerState.scene = scene;
    treePlacerState.lod = lod;
    treePlacerState.sampleHeight = createHeightSampler(displacementMap, lod);
    treePlacerState.bbox = new THREE.Box3().setFromObject(lod);

    instancedPool.maxInstances = maxInstances;

    function onDoubleClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(lod, true);
        if (!hits.length) return;

        const hit = hits[0];
        const point = hit.point.clone();

        if (hit.uv) {
            const height = treePlacerState.sampleHeight(hit.uv);
            if (height < 5 || height > 30) {
                return;
            }
            point.y = height - 1;
        }

        spawnTreeFallback(point, scene);
    }

    container.addEventListener("dblclick", onDoubleClick);
    return function disposeTreePlacer() {
        container.removeEventListener("dblclick", onDoubleClick);
    };
}

function createHeightSampler(displacementMap, lod) {
    const img = displacementMap.image;
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;

    let displacementScale = 400;
    let displacementBias = -17;

    const mesh = lod.children.find(c => c.isMesh);
    if (mesh) {
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        if (mat) {
            if (typeof mat.displacementScale === "number") displacementScale = mat.displacementScale;
            if (typeof mat.displacementBias === "number") displacementBias = mat.displacementBias;
        }
    }

    return function sampleHeight(uv) {
        const x = Math.min(img.width - 1, Math.max(0, Math.floor(uv.x * img.width)));
        const y = Math.min(img.height - 1, Math.max(0, Math.floor((1 - uv.y) * img.height)));

        const i = (y * img.width + x) * 4;
        const r = data[i];

        const h01 = r / 255;
        return h01 * displacementScale + displacementBias;
    };
}

export function populateTreesRandomly(
    treeCount = 500,
    treesPerFrame = 10,
    personalSpace = 25,
    gridResolution = 256
) {
    const {scene, lod, sampleHeight, bbox} = treePlacerState;

    if (!scene || !lod || !sampleHeight || !bbox) {
        console.error("populateTreesRandomly: tree placer not initialized yet");
        return;
    }

    const GRID_COLS = gridResolution;
    const GRID_ROWS = gridResolution;

    const width = bbox.max.x - bbox.min.x;
    const depth = bbox.max.z - bbox.min.z;
    const cellSizeX = width / GRID_COLS;
    const cellSizeZ = Math.abs(depth) / GRID_ROWS;
    const cellWorldSize = Math.max(cellSizeX, cellSizeZ);

    const radiusCells = Math.max(0, Math.ceil(personalSpace / cellWorldSize));

    const grid = new Array(GRID_COLS);
    for (let i = 0; i < GRID_COLS; i++) {
        grid[i] = new Array(GRID_ROWS);
    }

    const validCells = [];

    for (let i = 0; i < GRID_COLS; i++) {
        const u = (i + 0.5) / GRID_COLS;
        for (let j = 0; j < GRID_ROWS; j++) {
            const v = (j + 0.5) / GRID_ROWS;

            const height = sampleHeight({x: u, y: v});
            if (height <= 5 || height >= 200) {
                grid[i][j] = null;
                continue;
            }

            const x = THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, u);
            const z = THREE.MathUtils.lerp(bbox.max.z, bbox.min.z, v);

            grid[i][j] = {
                valid: true,
                x,
                z,
                height,
                i,
                j,
                listIndex: validCells.length
            };
            validCells.push({i, j});
        }
    }

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

    function step() {
        let spawnedThisFrame = 0;

        while (
            spawnedThisFrame < treesPerFrame &&
            placed < treeCount &&
            validCells.length > 0
            ) {
            const randIndex = Math.floor(Math.random() * validCells.length);
            const {i, j} = validCells[randIndex];
            const cell = grid[i][j];

            if (!cell || !cell.valid) {
                invalidateCell(i, j);
                continue;
            }

            const position = new THREE.Vector3(cell.x, cell.height - 1, cell.z);

            spawnTreeFallback(position, scene);

            placed++;
            spawnedThisFrame++;

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

export function updateTreeLODs(camera) {
    if (!camera || !instancedPool.uniforms) return;
    instancedPool.uniforms.uCameraPosition.value.copy(camera.position);
}
