import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader";
import { MTLLoader } from "three/addons/loaders/MTLLoader";
import { TGALoader } from "three/addons/loaders/TGALoader.js";

let old_camera_pos = null;
let justToggled = true;

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

// =====================================================
// Boat / path globals
// =====================================================

// Units per second (world units)
let BOAT_SPEED = 80;

const objLoader = new OBJLoader();
const mtlLoader = new MTLLoader();
const tgaLoader = new TGALoader();

const boatDiffuse = tgaLoader.load("asset/Boat/Texture/boat_d.tga");
const boatNormal = tgaLoader.load("asset/Boat/Texture/boat_n.tga");

// Make the color texture use sRGB so it looks right
boatDiffuse.colorSpace = THREE.SRGBColorSpace;
boatDiffuse.needsUpdate = true;

let followDaBoat = false;
let boat = null;

// Single smooth closed curve through all points
let boatCurve = null;
let boatCurveLength = 0;
let boatDistanceAlong = 0;

// Temp vectors reused every frame
const _tmpTangent = new THREE.Vector3();
const _tmpLookTarget = new THREE.Vector3();

// =====================================================
// Helpers
// =====================================================

function buildBoatCurve() {
    if (points.length < 2) {
        console.warn("Not enough points to build boat curve");
        boatCurve = null;
        boatCurveLength = 0;
        return;
    }

    // Smooth, closed Catmull–Rom curve
    boatCurve = new THREE.CatmullRomCurve3(points, true, "catmullrom", 0.2);
    boatCurveLength = boatCurve.getLength();
    boatDistanceAlong = 0;
}

function loadOBJPromise(filename) {
    return new Promise((resolve, reject) => {
        objLoader.load(filename, resolve, undefined, reject);
    });
}

function applyBoatMaterial(boatObject) {
    boatObject.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            child.material = new THREE.MeshStandardMaterial({
                map: boatDiffuse,
                normalMap: boatNormal,
                metalness: 0.1,
                roughness: 0.8,
            });

            if (child.material.map) {
                child.material.map.colorSpace = THREE.SRGBColorSpace;
                child.material.map.needsUpdate = true;
            }
        }
    });
}

async function spawnDaBoat(scene) {
    try {
        if (!boatCurve) {
            buildBoatCurve();
        }

        mtlLoader.setPath("asset/Boat/OBJ/");
        mtlLoader.setResourcePath("asset/Boat/OBJ/");

        const materials = await new Promise((res, rej) =>
            mtlLoader.load("boat.mtl", res, undefined, rej)
        );
        materials.preload();
        objLoader.setMaterials(materials);
        objLoader.setPath("asset/Boat/OBJ/");

        const loadedObj = await loadOBJPromise("boat.obj");
        boat = loadedObj;

        applyBoatMaterial(boat);

        boat.scale.setScalar(0.3);

        // Start the boat on the curve
        if (boatCurve && boatCurveLength > 0) {
            // start at beginning of curve
            const t = 0;
            boatCurve.getPoint(t, boat.position);

            boatCurve.getTangent(t, _tmpTangent);
            _tmpTangent.y = 0;
            if (_tmpTangent.lengthSq() > 1e-6) {
                _tmpTangent.normalize();
                _tmpLookTarget.copy(boat.position).add(_tmpTangent);
                boat.lookAt(_tmpLookTarget);
                // model correction so its "forward" matches the math
                boat.rotateY(-Math.PI / 2);
            }
        } else if (points.length > 0) {
            boat.position.copy(points[0]);
        }

        scene.add(boat);
    } catch (err) {
        console.error("spawnDaBoat: failed to load boat", err);
    }
}

// =====================================================
// Public API
// =====================================================

export async function innitDaBoat({ camera, scene, container, lod, displacementMap }) {
    if (!lod) {
        console.error("initDaBoat: lod is undefined");
        return;
    }
    if (!displacementMap || !displacementMap.image) {
        console.error("initDaBoat: displacementMap/image not ready");
        return;
    }

    // Build the curve and spawn the boat
    buildBoatCurve();
    await spawnDaBoat(scene);

    // Listen for key presses (B to toggle follow)
    function toggleFollowBoat(event) {
        if (event.key === "b" || event.key === "B") {
            followDaBoat = !followDaBoat;
            console.log("followDaBoat:", followDaBoat);
        }
    }

    window.addEventListener("keydown", toggleFollowBoat);

    // If you ever want cleanup:
    // return () => window.removeEventListener("keydown", toggleFollowBoat);
}

export function updateBoat(deltaSeconds) {
    if (!boat) return null;

    if (!boatCurve || boatCurveLength <= 0) {
        buildBoatCurve();
        if (!boatCurve || boatCurveLength <= 0) {
            return boat.position;
        }
    }

    // Advance along the curve at roughly constant speed
    const distanceThisFrame = BOAT_SPEED * deltaSeconds;
    boatDistanceAlong = (boatDistanceAlong + distanceThisFrame) % boatCurveLength;

    const u = boatDistanceAlong / boatCurveLength; // 0..1
    const t = boatCurve.getUtoTmapping(u); // map arc length fraction → param

    // Position
    boatCurve.getPoint(t, boat.position);

    // Orientation
    boatCurve.getTangent(t, _tmpTangent);
    _tmpTangent.y = 0;
    if (_tmpTangent.lengthSq() > 1e-6) {
        _tmpTangent.normalize();
        _tmpLookTarget.copy(boat.position).add(_tmpTangent);
        boat.lookAt(_tmpLookTarget);
        // model correction so its "forward" matches the math
        boat.rotateY(-Math.PI / 2);
    }

    // If you want to sample water height here, you still can:
    // const y = sampleWaterHeight(boat.position.x, boat.position.z, displacementMap);
    // boat.position.y = y;

    return boat.position;
}

export function updateCameraFollow(boatPos, camera) {
    const isFollowing = Boolean(followDaBoat && boatPos);

    if (isFollowing) {
        if (justToggled) {
            old_camera_pos = camera.position.clone(); // clone only once when toggling
            justToggled = false;
        }
        const { x, y, z } = boatPos;
        camera.position.set(x, y + 18, z);
        return;
    }

    if (!justToggled && old_camera_pos) {
        justToggled = true;
        camera.position.copy(old_camera_pos);
    }
}
