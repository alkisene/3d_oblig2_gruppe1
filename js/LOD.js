import * as THREE from 'three';

export function createLODMesh(scene, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, worldWidth, worldDepth) {
    const lod = new THREE.LOD();
    const displaceMentScale = 400;
    const displaceMentBias = -100;

    const highResGeometry = new THREE.PlaneGeometry(7500, 7500, worldWidth - 1, worldDepth - 1);
    highResGeometry.rotateX(-Math.PI / 2);


    const highResMesh = new THREE.Mesh(highResGeometry, new THREE.MeshStandardMaterial({
        displacementMap: displacementMap,
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
        displacementMap: displacementMap,
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
        displacementMap: displacementMap,
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
    return {lod, highResMesh, medResMesh, lowResMesh};
}