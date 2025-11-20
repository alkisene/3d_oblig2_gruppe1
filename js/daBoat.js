import * as THREE from "three";
import {OBJLoader} from "three/addons/loaders/OBJLoader";
import {MTLLoader} from "three/addons/loaders/MTLLoader";
import {TGALoader} from 'three/addons/loaders/TGALoader.js';

const points = [
    new THREE.Vector3(-476.72, 1, 782.35),
    new THREE.Vector3(-1903.91, 1, 1238.57),
    new THREE.Vector3(-2441.55, 1, 1022.26),
    new THREE.Vector3(-2398.93, 1, 401.52),
    new THREE.Vector3(-2515.32, 1, -79.15),
    new THREE.Vector3(-2420.56, 1, -332.75),
    new THREE.Vector3(-1923.05, 1, -198.36),
    new THREE.Vector3(-1802.08, 1, -99.25),
    new THREE.Vector3(-1547.67, 1, -275.73),
    new THREE.Vector3(-1206.26, 1, -492.09),
    new THREE.Vector3(-859.97, 1, -901.63),
    new THREE.Vector3(-668.55, 1, -740.80),
    new THREE.Vector3(-234.23, 1, -108.41),
    new THREE.Vector3(122.95, 1, 395.85),
    new THREE.Vector3(20.23, 1, 653.94)
];

// --- animation state ---
let boat = null;
let currentIndex = 0;
let nextIndex = 1;

// Units per second (world units)
let BOAT_SPEED = 80;

const objLoader = new OBJLoader()
const mtlLoader = new MTLLoader();
const tgaLoader = new TGALoader();

const boatDiffuse = tgaLoader.load('asset/Boat/Texture/boat_d.tga');
const boatNormal  = tgaLoader.load('asset/Boat/Texture/boat_n.tga');

// Make the color texture use sRGB so it looks right
boatDiffuse.colorSpace = THREE.SRGBColorSpace;
boatDiffuse.needsUpdate = true;


let followDaBoat = false;

// Helper
function loadOBJPromise(filename) {
    return new Promise((resolve, reject) => {
        objLoader.load(filename, resolve, undefined, reject);
    });
}

export async function innitDaBoat({camera, scene, container, lod, displacementMap}) {

    if (!lod) {
        console.error("initDaBoat: lod is undefined");
        return;
    }
    if (!displacementMap || !displacementMap.image) {
        console.error("initDaBoat: displacementMap/image not ready");
        return;
    }

    await spawnDaBoat(scene)

    // Listen for key presses
    function toggleFollowBoat(event) {
        // Only toggle on the "b" or "B" key
        if (event.key === "b" || event.key === "B") {
            followDaBoat = !followDaBoat;
            console.log("followDaBoat:", followDaBoat);
        }
    }

    // Attach listener
    window.addEventListener("keydown", toggleFollowBoat);
}

async function spawnDaBoat(scene) {
    try {
        mtlLoader.setPath(`asset/Boat/OBJ/`);
        mtlLoader.setResourcePath(`asset/Boat/OBJ/`);
        const materials = await new Promise((res, rej) =>
            mtlLoader.load(`boat.mtl`, res, undefined, rej)
        );
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.setPath(`asset/Boat/OBJ/`)

        const highObj = await Promise.all([
            loadOBJPromise(`boat.obj`)
        ]);

        // Use createObjectLOD helper to assemble LOD
        boat = highObj[0];

        applyBoatMaterial(boat);

        boat.position.copy(points[0]);
        boat.scale.setScalar(0.3);

        lookAtNextPoint();

        scene.add(boat);
    }  catch (err) {
        console.error("spawnTree: failed to load tree LODs", err);
    }
}

function applyBoatMaterial(boat) {
    boat.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            child.material = new THREE.MeshStandardMaterial({
                map: boatDiffuse,
                normalMap: boatNormal,
                metalness: 0.1,
                roughness: 0.8
            });

            if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
                child.material.map.needsUpdate = true;
            }
        }
    });
}

function lookAtNextPoint() {
    if (!boat) return;

    const from = boat.position;
    const to = points[nextIndex];

    // Keep boat level: only rotate around Y
    const target = new THREE.Vector3(to.x, from.y, to.z);
    boat.lookAt(target);

    // Rotate 90 degrees clockwise around Y
    boat.rotateY(-Math.PI / 2);
}


const _dir = new THREE.Vector3(); // reuse to avoid allocs

function updateBoat(deltaSeconds) {
    if (!boat) return null;
    if (points.length < 2) return boat.position;

    const currentTarget = points[nextIndex];

    // Direction from current position to target
    _dir.subVectors(currentTarget, boat.position);
    const distanceToTarget = _dir.length();

    if (distanceToTarget === 0) {
        advanceToNextPoint();
        return boat.position;    // <--- return something valid
    }

    _dir.normalize();

    const maxMove = BOAT_SPEED * deltaSeconds;

    if (maxMove >= distanceToTarget) {
        // We would overshoot: snap to target and go to next point
        boat.position.copy(currentTarget);
        advanceToNextPoint();
    } else {
        // Move towards target
        boat.position.addScaledVector(_dir, maxMove);
        lookAtNextPoint();
    }

    return boat.position;        // <--- always return position if boat exists
}


function advanceToNextPoint() {
    currentIndex = nextIndex;
    nextIndex = (nextIndex + 1) % points.length;
    lookAtNextPoint();
}

export {
    followDaBoat,
    updateBoat,
    BOAT_SPEED,
    points
};

