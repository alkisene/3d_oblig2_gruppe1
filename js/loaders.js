import * as THREE from 'three';
import {EXRLoader} from 'three/addons/loaders/EXRLoader.js';

export async function loadAssets(renderer) {
    const textureLoader = new THREE.TextureLoader();
    const exrLoader = new EXRLoader()
    const [
        displacementMap,
        diffuseMap,
        normalMap,
        roughnessMap,
        specularMap,
        waterNormalMap,
        sunTexture] = await Promise.all([
        textureLoader.loadAsync('asset/HeightMap/aagotnesHeightMap.png'),
        textureLoader.loadAsync('asset/DiffuseMap/coast_sand_rocks_02_diff_4k.jpg'),
        exrLoader.loadAsync('asset/NormalMap/rocky_terrain_02_nor_gl_1k.exr'),
        exrLoader.loadAsync('asset/RoughnessMap/rocky_terrain_02_rough_1k.exr'),
        textureLoader.loadAsync('asset/SpecularMap/rocky_terrain_02_spec_1k.png'),
        textureLoader.loadAsync('asset/NormalMap/Water_1_M_Normal.jpg'),
        textureLoader.loadAsync('asset/DiffuseMap/texture_sun.jpg')
    ]);
    diffuseMap.wrapS = THREE.RepeatWrapping;
    diffuseMap.wrapT = THREE.RepeatWrapping;
    diffuseMap.repeat.set(4, 4);
    diffuseMap.anisotropy = renderer.capabilities.getMaxAnisotropy();
    waterNormalMap.wrapS = THREE.RepeatWrapping;
    waterNormalMap.wrapT = THREE.RepeatWrapping;

    return {displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, waterNormalMap, sunTexture};
}