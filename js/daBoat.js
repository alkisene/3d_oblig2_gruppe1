import * as THREE from "three";
import {OBJLoader} from "three/addons/loaders/OBJLoader";
import {MTLLoader} from "three/addons/loaders/MTLLoader";
import {TGALoader} from 'three/addons/loaders/TGALoader.js';

let old_camera_pos = null;
let justToggled = true;
//let mouse = new THREE.Vector2();
//let ray = new THREE.Raycaster()

const points = [
    new THREE.Vector3(284.62, 1, 597.97),
    new THREE.Vector3(150.22, 1, 379.57),
    new THREE.Vector3(39.25, 1, 183.05),
    new THREE.Vector3(-83.53, 1, 36.77),
    new THREE.Vector3(-212.46, 1, -122.12),
    new THREE.Vector3(-236.35, 1, -329.33),
    new THREE.Vector3(-153.18, 1, -487.91),
    new THREE.Vector3(28.63, 1, -626.46),
    new THREE.Vector3(262.46, 1, -732.44),
    new THREE.Vector3(535.77, 1, -818.70),
    new THREE.Vector3(803.32, 1, -866.35),
    new THREE.Vector3(1057.64, 1, -905.34),
    new THREE.Vector3(1335.16, 1, -954.55),
    new THREE.Vector3(1704.58, 1, -1004.53),
    new THREE.Vector3(1973.28, 1, -1032.47),
    new THREE.Vector3(2402.63, 1, -1042.05),
    new THREE.Vector3(2549.67, 1, -943.03),
    new THREE.Vector3(2592.04, 1, -636.14),
    new THREE.Vector3(2601.24, 1, -460.09),
    new THREE.Vector3(2513.51, 1, -178.73),
    new THREE.Vector3(2370.40, 1, 95.59),
    new THREE.Vector3(2179.27, 1, 347.74),
    new THREE.Vector3(2067.59, 1, 425.39),
    new THREE.Vector3(1754.91, 1, 649.42),
    new THREE.Vector3(1516.23, 1, 787.09),
    new THREE.Vector3(1321.72, 1, 855.42),
    new THREE.Vector3(1139.48, 1, 908.08),
    new THREE.Vector3(973.61, 1, 963.22),
    new THREE.Vector3(787.54, 1, 972.91),
    new THREE.Vector3(616.41, 1, 974.59),
];


// --- animation state ---
let boat = null;
let currentIndex = 0;
let nextIndex = 1;

// Units per second (world units)
let BOAT_SPEED = 80;

// world units in XZ plane where we start blending the turn
const TURN_DISTANCE = 80;


const objLoader = new OBJLoader()
const mtlLoader = new MTLLoader();
const tgaLoader = new TGALoader();

const boatDiffuse = tgaLoader.load('asset/Boat/Texture/boat_d.tga');
const boatNormal = tgaLoader.load('asset/Boat/Texture/boat_n.tga');

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

    /*
    function onDoubleClick(event) {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        ray.setFromCamera(mouse, camera);
        const hits = ray.intersectObject(lod, true); // true = recurse into children
        if (!hits.length) return;

        const hit = hits[0];            // <- keep the whole intersection
        const point = hit.point.clone(); // <- clone the Vector3

        console.log(point);
    }

    container.addEventListener('dblclick', onDoubleClick);
    return function disposeRaycast() {
        container.removeEventListener('dblclick', onDoubleClick);
    }; */
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
    } catch (err) {
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
    const currentTarget = points[nextIndex];
    const nextNextIndex = (nextIndex + 1) % points.length;
    const nextNextTarget = points[nextNextIndex];

    // Distance in XZ plane to the current target
    const dx = currentTarget.x - from.x;
    const dz = currentTarget.z - from.z;
    const distXZ = Math.hypot(dx, dz);

    let lookTarget;

    if (distXZ < TURN_DISTANCE) {
        // --- Blend direction between currentTarget and nextNextTarget ---

        // Direction from boat to current target (flattened to XZ)
        const dirToCurrent = new THREE.Vector3(
            currentTarget.x - from.x,
            0,
            currentTarget.z - from.z
        ).normalize();

        // Direction of the *next* segment (from current target to next-next target)
        const dirToNextSegment = new THREE.Vector3(
            nextNextTarget.x - currentTarget.x,
            0,
            nextNextTarget.z - currentTarget.z
        ).normalize();

        // t = 0 when we're TURN_DISTANCE away, t = 1 when we're on the waypoint
        const t = THREE.MathUtils.clamp(1 - distXZ / TURN_DISTANCE, 0, 1);

        // Blend directions
        const blendedDir = dirToCurrent
            .multiplyScalar(1 - t)
            .add(dirToNextSegment.multiplyScalar(t))
            .normalize();

        // Our look target is "forward" in that blended direction
        lookTarget = new THREE.Vector3(
            from.x + blendedDir.x,
            from.y,             // keep boat level
            from.z + blendedDir.z
        );
    } else {
        // --- Far from the corner: just look at the current target in XZ ---
        lookTarget = new THREE.Vector3(currentTarget.x, from.y, currentTarget.z);
    }

    boat.lookAt(lookTarget);

    // Rotate 90 degrees clockwise around Y so the model’s forward matches our look direction
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

export function updateCameraFollow(boatPos, camera) {
    const isFollowing = Boolean(followDaBoat && boatPos);

    if (isFollowing) {
        if (justToggled) {
            old_camera_pos = camera.position.clone(); // clone only once when toggling
            justToggled = false;
        }
        const {x, y, z} = boatPos;
        camera.position.set(x, y + 18, z);
        return;
    }

    if (!justToggled && old_camera_pos) {
        justToggled = true;
        camera.position.copy(old_camera_pos);
    }
}