import * as THREE from 'three';
import {Sky} from "three/addons/objects/Sky";

export function createCelestialEntity(scene, entityTexture, radius, widthSegments, heightSegments, x, y, z) {
    const entityGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const entityMaterial = new THREE.MeshBasicMaterial({
        map: entityTexture,
    });
    const celestial = new THREE.Mesh(entityGeometry, entityMaterial);
    celestial.position.set(x, y, z);
    scene.add(celestial);
    return celestial;
}

export function createSky(scene, opts = {}) {
    let sky = new Sky();
    sky.scale.setScalar(450000);
    scene.add(sky);
    const mat = /** @type {import('three').ShaderMaterial} */ (sky.material);
    const uniforms = mat.uniforms;
    uniforms.turbidity.value = opts.turbidity ?? 10;
    uniforms.rayleigh.value = opts.rayleigh ?? 3;
    uniforms.mieCoefficient.value = opts.mieCoefficient ?? 0.005;
    uniforms.mieDirectionalG.value = opts.mieDirectionalG ?? 0.7;

    return sky;
}