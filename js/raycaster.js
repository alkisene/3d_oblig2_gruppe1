import * as THREE from 'three';

let raycaster = new THREE.Raycaster();
let pointer = new THREE.Vector2();
let lastRaycastTime = 0;
const raycastInterval = 33; // ~30fps for raycasting

export function initRaycast({camera, renderer, lod, helper, container}) { //Burde dette være en async function?
    function onPointerMove(event) {
        if (!lod) return;

        // Update pointer position immediately (smooth cursor tracking)
        pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
        pointer.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

        // Throttle expensive raycasting
        const now = performance.now();
        if (now - lastRaycastTime < raycastInterval) return;
        lastRaycastTime = now;

        raycaster.setFromCamera(pointer, camera);
        lod.update(camera);
        const currentLevelIndex = lod.getCurrentLevel();
        if (currentLevelIndex === -1) return;

        const currentMesh = lod.children[currentLevelIndex];
        if (!currentMesh) return;
        const intersects = raycaster.intersectObject(currentMesh, false);

        if (intersects.length > 0) {
            helper.position.set(0, 0, 0);
            helper.lookAt(intersects[0].face.normal);
            helper.position.copy(intersects[0].point);
        }
    }

    // Attach listener and return disposer
    container.addEventListener('pointermove', onPointerMove);
    return function disposeRaycast() {
        container.removeEventListener('pointermove', onPointerMove);
    };
}