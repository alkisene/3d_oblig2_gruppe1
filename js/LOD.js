// File: js/LOD.js
import * as THREE from 'three';

// Note: We keep 'snowTexture' in the arguments list
export function createLODMesh(scene, displacementMap, diffuseMap, normalMap, roughnessMap, specularMap, worldWidth, worldDepth, snowTexture) {
    const lod = new THREE.LOD();

    // Ensure we have defaults if arguments are missing
    const w = worldWidth || 256;
    const d = worldDepth || 256;

    // Helper function to create the material with custom blending logic
    function createCustomMaterial() {
        const material = new THREE.MeshStandardMaterial({
            displacementMap: displacementMap,
            displacementScale: 400,
            displacementBias: -100,
            normalMap: normalMap,
            roughnessMap: roughnessMap,
            metalnessMap: specularMap,
            metalness: 0.1,
            map: diffuseMap
        });

        material.onBeforeCompile = (shader) => {
            // 1. Pass our textures to the shader
            shader.uniforms.uSnowTexture = { value: snowTexture };
            shader.uniforms.uHeightMap = { value: displacementMap };

            // 2. Inject Uniforms safely at the top
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `
                #include <common>
                uniform sampler2D uSnowTexture;
                uniform sampler2D uHeightMap;
                `
            );

            // 3. Inject Mixing Logic
            // We replace the standard map fragment to append our logic
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>

                // --- CUSTOM SNOW LOGIC ---
                
                // We use vMapUv (which exists) divided by 4.0 because 
                // your rock texture repeats 4 times, but the height map should not.
                vec2 originalUv = vMapUv / 4.0;

                // Sample height from the displacement map
                float myHeight = texture2D(uHeightMap, originalUv).r;

                // Calculate Snow Mix Factor
                // Adjust these numbers: 0.5 = start height, 0.7 = full snow
                float snowMix = smoothstep(0.5, 0.7, myHeight);

                // Sample Snow Texture
                // We scale vMapUv * 2.0 to make the snow detail finer
                vec4 mySnowColor = texture2D(uSnowTexture, vMapUv * 2.0);
                
                // Mix the existing rock color (diffuseColor) with snow
                diffuseColor = mix(diffuseColor, mySnowColor, snowMix);
                
                // -------------------------
                `
            );
        };

        return material;
    }

    // --- Create Geometry ---
    const highResGeometry = new THREE.PlaneGeometry(7500, 7500, w - 1, d - 1);
    highResGeometry.rotateX(-Math.PI / 2);

    const medResGeometry = new THREE.PlaneGeometry(7500, 7500, w / 2 - 1, d / 2 - 1);
    medResGeometry.rotateX(-Math.PI / 2);

    const lowResGeometry = new THREE.PlaneGeometry(7500, 7500, w / 4 - 1, d / 4 - 1);
    lowResGeometry.rotateX(-Math.PI / 2);

    // --- Create Meshes using the helper ---
    const highResMesh = new THREE.Mesh(highResGeometry, createCustomMaterial());
    const medResMesh = new THREE.Mesh(medResGeometry, createCustomMaterial());
    const lowResMesh = new THREE.Mesh(lowResGeometry, createCustomMaterial());

    lod.addLevel(highResMesh, 0);
    lod.addLevel(medResMesh, 2000);
    lod.addLevel(lowResMesh, 5000);

    scene.add(lod);
    return {lod, highResMesh, medResMesh, lowResMesh};
}

// (Keep your createObjectLOD function below this unchanged)
export function createObjectLOD(source, levels = [1, 0.5, 0.2], distances = [0, 50, 200]) {
    // ... keep existing code ...
    const lod = new THREE.LOD();
    if (!source) return lod;

    const sources = Array.isArray(source) ? source : [source];

    // If user provided multiple source variants
    if (sources.length > 1) {
        // ... (rest of existing code) ...
        return lod;
    }

    // Otherwise synthesize variants
    const src = sources[0];
    for (let k = 0; k < levels.length; k++) {
        const fraction = Math.max(0, Math.min(1, levels[k] || 1));
        const cloned = src.clone(true);

        cloned.traverse(node => {
            if (!node.isMesh) return;
            node.castShadow = true;
            node.receiveShadow = true;

            // Clone geometry
            if (node.geometry && typeof node.geometry.clone === 'function') {
                const geom = node.geometry.clone();
                // ... (decimation logic) ...
                node.geometry = geom;
            }

            // Clone material
            if (node.material) {
                // ... (cloning logic) ...
                if (Array.isArray(node.material)) {
                    node.material = node.material.map(m => (m && m.clone) ? m.clone() : m);
                } else if (node.material.clone) {
                    node.material = node.material.clone();
                }
            }

            // Fix for "skinning undefined" error:
            if (fraction < 1) {
                const map = Array.isArray(node.material) ? (node.material[0] && node.material[0].map) : (node.material && node.material.map);
                const basic = new THREE.MeshBasicMaterial({
                    map: map || null,
                    // Safe access for skinning:
                    skinning: (node.material && node.material.skinning) || false,
                    vertexColors: node.material && node.material.vertexColors
                });
                if (node.material && node.material.transparent) basic.transparent = true;
                node.material = basic;
            }
        });
        const dist = (distances && distances[k] != null) ? distances[k] : (k === 0 ? 0 : k * 50);
        lod.addLevel(cloned, dist);
    }
    return lod;
}
