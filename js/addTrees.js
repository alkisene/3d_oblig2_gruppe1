import * as THREE from "three";
import {OBJLoader} from "three/examples/jsm/loaders/OBJLoader.js";
import {MTLLoader} from "three/examples/jsm/loaders/MTLLoader.js";

const TREE_PATH = "asset/Tree 02/";
const TREE_HIGH = "Tree.obj";
const TREE_MID = "Tree_mid.obj";
const TREE_LOW = "tree_low.obj";
const TREE_MTL = "Tree.mtl";
const TREE_BILLBOARD_TEX = "tree_billboard.png";

// LOD distances
const LOD_DIST_HIGH = 0;
const LOD_DIST_MID = 100;
const LOD_DIST_LOW = 1000;
const LOD_DIST_BILLBOARD = 3000;

const fallbackMaterial = new THREE.MeshStandardMaterial({
    color: 0x4E523F,
    roughness: 0.8,
});

const mouse = new THREE.Vector2();
const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();

let treeTemplate = null;
let treeTemplateMid = null;
let treeTemplateLow = null;
let treeBillboardTemplate = null;

const treePlacerState = {
    scene: null,
    lod: null,
    sampleHeight: null,
    bbox: null,
};

export function initTreePlacer({camera, scene, container, lod, displacementMap}) {
    if (!lod) {
        console.error("initTreePlacer: lod is undefined");
        return;
    }
    if (!displacementMap?.image) {
        console.error("initTreePlacer: displacementMap/image not ready");
        return;
    }

    const sampleHeight = createHeightSampler(displacementMap, lod);

    treePlacerState.scene = scene;
    treePlacerState.lod = lod;
    treePlacerState.sampleHeight = sampleHeight;
    treePlacerState.bbox = new THREE.Box3().setFromObject(lod);

    const ray = new THREE.Raycaster();

    function onDoubleClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(lod, true);
        if (!hits.length) return;

        const hit = hits[0];
        const point = hit.point.clone();

        if (hit.uv) {
            const height = sampleHeight(hit.uv);
            if (height < 5 || height > 30) return;
            point.y = height - 1;
        }

        spawnTree(point, scene);
    }

    container.addEventListener("dblclick", onDoubleClick);
    return () => container.removeEventListener("dblclick", onDoubleClick);
}

function getTreeBillboardTemplate() {
    if (treeBillboardTemplate) return treeBillboardTemplate;

    const textureLoader = new THREE.TextureLoader();
    const map = textureLoader.load(`${TREE_PATH}${TREE_BILLBOARD_TEX}`);

    const geometry = new THREE.PlaneGeometry(8, 16);
    const material = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotateY(Math.PI);
    mesh.userData = {...mesh.userData, isTreeBillboard: true};

    treeBillboardTemplate = mesh;
    return treeBillboardTemplate;
}

function createTreeLod(point) {
    const lod = new THREE.LOD();
    lod.userData = {...lod.userData, isTreeLod: true};

    const treeHigh = treeTemplate.clone(true);
    const treeMid = treeTemplateMid.clone(true);
    const treeLow = treeTemplateLow.clone(true);
    const billboard = getTreeBillboardTemplate().clone(true);

    lod.addLevel(treeHigh, LOD_DIST_HIGH);
    lod.addLevel(treeMid, LOD_DIST_MID);
    lod.addLevel(treeLow, LOD_DIST_LOW);
    lod.addLevel(billboard, LOD_DIST_BILLBOARD);

    lod.position.copy(point);
    const scalar = Math.random() * 5 + 3;
    lod.scale.setScalar(scalar);

    return lod;
}

function spawnTree(point, scene) {
    if (treeTemplate && treeTemplateMid && treeTemplateLow) {
        scene.add(createTreeLod(point));
        return;
    }

    mtlLoader.setPath(TREE_PATH);
    mtlLoader.setResourcePath(TREE_PATH);

    mtlLoader.load(TREE_MTL, (materials) => {
        materials.preload();
        objLoader.setPath(TREE_PATH);

        const loadWithMaterials = (name) =>
            new Promise((resolve) => {
                objLoader.setMaterials(materials);
                objLoader.load(name, resolve);
            });

        const loadSimple = (name) =>
            new Promise((resolve) => {
                objLoader.load(name, resolve);
            });

        Promise.all([
            loadWithMaterials(TREE_HIGH),
            loadSimple(TREE_MID),
            loadSimple(TREE_LOW),
        ]).then(([objHigh, objMid, objLow]) => {
            objMid.traverse((child) => {
                if (child.isMesh) child.material = fallbackMaterial;
            });
            objLow.traverse((child) => {
                if (child.isMesh) child.material = fallbackMaterial;
            });

            enableShadows(objHigh);
            enableShadows(objMid);
            enableShadows(objLow);

            treeTemplate = objHigh;
            treeTemplateMid = objMid;
            treeTemplateLow = objLow;

            scene.add(createTreeLod(point));
        });
    });
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

    const mesh = lod.children.find((c) => c.isMesh);
    if (mesh) {
        const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        displacementScale = mat?.displacementScale ?? displacementScale;
        displacementBias = mat?.displacementBias ?? displacementBias;
    }

    return (uv) => {
        const x = Math.min(img.width - 1, Math.max(0, Math.floor(uv.x * img.width)));
        const y = Math.min(
            img.height - 1,
            Math.max(0, Math.floor((1 - uv.y) * img.height)),
        );

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
    gridResolution = 256,
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

    const grid = Array.from({length: GRID_COLS}, () =>
        new Array(GRID_ROWS).fill(null),
    );

    const validCells = [];

    for (let i = 0; i < GRID_COLS; i++) {
        const u = (i + 0.5) / GRID_COLS;
        for (let j = 0; j < GRID_ROWS; j++) {
            const v = (j + 0.5) / GRID_ROWS;

            const height = sampleHeight({x: u, y: v});
            if (height <= 5 || height >= 200) continue;

            const x = THREE.MathUtils.lerp(bbox.min.x, bbox.max.x, u);
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
            validCells.push({i, j});
        }
    }

    function invalidateCell(i, j) {
        const cell = grid[i][j];
        if (!cell?.valid) return;

        cell.valid = false;

        const index = cell.listIndex;
        const last = validCells.pop();
        if (!last || index === validCells.length + 1) {
            cell.listIndex = -1;
            return;
        }

        validCells[index] = last;
        const movedCell = grid[last.i][last.j];
        movedCell.listIndex = index;
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

            if (!cell?.valid) {
                invalidateCell(i, j);
                continue;
            }

            const position = new THREE.Vector3(cell.x, cell.height - 1, cell.z);
            spawnTree(position, scene);
            placed++;
            spawnedThisFrame++;

            for (let di = -radiusCells; di <= radiusCells; di++) {
                const ii = i + di;
                if (ii < 0 || ii >= GRID_COLS) continue;

                for (let dj = -radiusCells; dj <= radiusCells; dj++) {
                    const jj = j + dj;
                    if (jj < 0 || jj >= GRID_ROWS) continue;

                    if (grid[ii][jj]?.valid) invalidateCell(ii, jj);
                }
            }
        }

        if (placed < treeCount && validCells.length > 0) {
            requestAnimationFrame(step);
        } else {
            console.log(
                `populateTreesRandomly: requested ${treeCount}, placed ${placed}, remaining valid spots: ${validCells.length}`,
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

export function updateTreeBillboards(camera) {
    if (!treePlacerState.scene) return;

    const camPos = camera.position.clone();

    treePlacerState.scene.traverse((obj) => {
        if (obj.userData?.isTreeBillboard) {
            camPos.y = obj.position.y;
            obj.lookAt(camPos);
        }
    });
}