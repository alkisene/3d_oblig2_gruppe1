import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';

/*
  GPT Explanation:
  initScene({ container, backgroundColor, fogNear, fogFar })
  - container: DOM element (optional) used only if you want to attach stats here
  - backgroundColor: numeric color or CSS hex (default 0xbfd1e5)
  - fogNear / fogFar: numbers for fog range (defaults chosen for your terrain)
*/
export function initScene({
                              container = null,
                              backgroundColor = 0xbfd1e5,
                              fogNear = 2000,
                              fogFar = 3250
                          } = {}) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Fog: match the background so distant objects fade cleanly
    scene.fog = new THREE.Fog(scene.background, fogNear, fogFar);

    // Basic ambient fill so unlit areas aren't completely black
    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    // Create performance stats
    const stats = new Stats();
    if (container && container.appendChild) {
        container.appendChild(stats.dom);
    }

    return {scene, stats, ambient};
}