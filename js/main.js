"use strict";
// kjør "npx vite" for å kjøre programmet.

// hentet eksempel kode fra : https://github.com/mrdoob/three.js/blob/master/examples/webgl_geometry_terrain_raycast.html

import * as THREE from "three";

import { OrbitControls} from "three/addons";

let camera, controls, scene, renderer;

let worldMesh, worldTexture;



