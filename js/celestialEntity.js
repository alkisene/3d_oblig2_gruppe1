import * as THREE from 'three';

export function createCelestialEntity(scene, entityTexture, radius, widthSegments, heightSegments, xPos, yPos, zPos) {
    const entityGeometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
    const entityMaterial = new THREE.MeshBasicMaterial({
        map: entityTexture,
    });
    let celestial = new THREE.Mesh(entityGeometry, entityMaterial);
    celestial.position.set(xPos, yPos, zPos);
    scene.add(celestial);
    return celestial;
}