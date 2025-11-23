import {initTreePlacer, populateTreesRandomly} from "./addTrees.js";
import {innitDaBoat} from "./daBoat.js";

// Factory that initializes terrain LOD, trees, and boat
export function initTerrainLOD(scene, camera, container, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, snowTexture, createLODMesh, geometryHelper, worldWidth, worldDepth) {
    if (!scene) throw new Error("initTerrainLOD: scene required");

    const {lod, highResMesh, medResMesh, lowResMesh} =
        createLODMesh(scene, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, worldWidth, worldDepth, snowTexture);

    const mesh = highResMesh;

    const helper = geometryHelper();
    scene.add(helper);

    // Pass camera & container into tree & boat initializers
    const treePlacerDisposer = initTreePlacer({camera, scene, container, lod, displacementMap});
    populateTreesRandomly(500, 3, 5, 256);

    const boatDisposerPromise = innitDaBoat({scene, container, lod, displacementMap});

    return {mesh, lod, helper, treePlacerDisposer, boatDisposerPromise};
}