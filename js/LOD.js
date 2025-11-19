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
        roughnessMap: roughnessMap,
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
    lod.addLevel(medResMesh, 1500);    // 1500 to 3000 units
    lod.addLevel(lowResMesh, 3000);    // 3000+ units

    scene.add(lod);
    return {lod, highResMesh};
}

// javascript
export function createObjectLOD(source, levels = [1, 0.5, 0.2], distances = [0, 50, 200]) {
    const lod = new THREE.LOD();
    if (!source) return lod;

    const sources = Array.isArray(source) ? source : [source];

    // If user provided multiple source variants, use them directly.
    if (sources.length > 1) {
        for (let k = 0; k < sources.length; k++) {
            const src = sources[k];
            if (!src) continue;
            const cloned = src.clone(true);
            cloned.traverse(n => {
                if (!n.isMesh) return;
                n.castShadow = true;
                n.receiveShadow = true;
                // clone geometry/material to avoid shared mutable state
                if (n.geometry && typeof n.geometry.clone === 'function') n.geometry = n.geometry.clone();
                if (n.material) {
                    if (Array.isArray(n.material)) n.material = n.material.map(m => (m && m.clone) ? m.clone() : m);
                    else if (n.material.clone) n.material = n.material.clone();
                }
            });
            const dist = (distances && distances[k] != null) ? distances[k] : (k === 0 ? 0 : k * 50);
            lod.addLevel(cloned, dist);
        }
        return lod;
    }

    // Otherwise synthesize variants from single source using the provided levels array.
    const src = sources[0];
    for (let k = 0; k < levels.length; k++) {
        const fraction = Math.max(0, Math.min(1, levels[k] || 1));
        const cloned = src.clone(true);

        cloned.traverse(node => {
            if (!node.isMesh) return;

            node.castShadow = true;
            node.receiveShadow = true;

            // clone geometry and set a reduced draw range (cheap decimation)
            if (node.geometry && typeof node.geometry.clone === 'function') {
                const geom = node.geometry.clone();
                const total = geom.index ? geom.index.count : (geom.attributes && geom.attributes.position ? geom.attributes.position.count : 0);
                const reduced = Math.max(3, Math.floor(total * fraction));
                try {
                    geom.setDrawRange(0, reduced);
                } catch (e) {
                    // ignore if geometry doesn't support drawRange
                }
                node.geometry = geom;
            }

            // clone material(s)
            if (node.material) {
                if (Array.isArray(node.material)) {
                    node.material = node.material.map(m => (m && m.clone) ? m.clone() : m);
                } else if (node.material.clone) {
                    node.material = node.material.clone();
                }
            }

            // For lower LODs, swap to a cheaper material but keep the texture map if present
            if (fraction < 1) {
                const map = Array.isArray(node.material) ? (node.material[0] && node.material[0].map) : (node.material && node.material.map);
                const basic = new THREE.MeshBasicMaterial({
                    map: map || null,
                    skinning: node.material && node.material.skinning,
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
