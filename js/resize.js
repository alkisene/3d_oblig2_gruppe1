export function setupResizeHandler(renderer, camera) {
    if (!renderer || !camera) return;

    function onResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    window.addEventListener('resize', onResize, {passive: true});
    onResize();
    return () => window.removeEventListener('resize', onResize);
}