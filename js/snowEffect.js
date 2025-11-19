import * as THREE from 'three';

const vertexShader = /* glsl*/`
uniform float uTime;
uniform float uPixelRatio;
uniform float uSize;
uniform float uRadius;
uniform float uArea;

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);

    float area = uArea;
    float halfArea = area * 0.5;

    // --- move to view space (camera space) ---
    vec4 viewPosition = viewMatrix * modelPosition;

    // use view\\-space Y as "height", Z as "depth", X as horizontal
    // Vertical falling + loop in view space
    float fallDistance = uTime * 0.2;
    viewPosition.y = mod(viewPosition.y - fallDistance, area * 0.857);
    viewPosition.y = viewPosition.y - (area * 0.857 * 0.5);

    // Wrap XZ in view space around the camera
    viewPosition.x = mod(viewPosition.x + halfArea, area) - halfArea;
    viewPosition.z = mod(viewPosition.z + halfArea, area) - halfArea;

    // Wind in view space, stable because coordinates are already wrapped
    float windZ = sin((uTime + viewPosition.x) * 0.5) * uRadius * 0.8;
    float windX = cos((uTime + viewPosition.z) * 0.5) * uRadius;

    viewPosition.z += windZ;
    viewPosition.x += windX;

    // Wrap again after wind to keep particles inside the box
    viewPosition.x = mod(viewPosition.x + halfArea, area) - halfArea;
    viewPosition.z = mod(viewPosition.z + halfArea, area) - halfArea;

    // Now go to clip space
    viewPosition.z -= 0.01;

    gl_Position = projectionMatrix * viewPosition;

   float perspectiveSize = uSize * uPixelRatio * (1.0 / -viewPosition.z);
   gl_PointSize = max(perspectiveSize, 1.0);
}
`;


const fragmentShader = /*glsl*/`
    uniform sampler2D uTexture;
    uniform bool uSimple;

    void main() {
        if (uSimple) {
            vec2 uv = gl_PointCoord - 0.5;
            float dist = length(uv);
            float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
            gl_FragColor = vec4(1.0, 1.0, 1.05, alpha * 0.95);
        } else {
            vec4 tex = texture2D(uTexture, gl_PointCoord);
            gl_FragColor = vec4(1.0, 1.0, 1.05, tex.a);
        }
    }
`;

export class SnowEffect {
    constructor({
                    scene,
                    count = 12000,
                    size = 22,
                    radius = 0.8,
                    simple = false,
                    textureUrl = 'https://i.imgur.com/zQXz4x2.png',
                    areaScale = 1.0,          // ← Now actually works! 1.0 = original size,
                    snowFallSpeed = 1.0
                } = {}) {
        this.scene = scene;
        this.count = count;
        this.areaScale = areaScale;
        this.snowFallSpeed = snowFallSpeed;

        this.params = { size, radius, simple };

        const baseArea = 7.0;
        const area = baseArea * areaScale;
        const height = 6.0 * areaScale;

        const shaderArea = area * 1.05 // slightly larger area for shader to avoid popping

        const positions = new Float32Array(this.count * 3);
        for (let i = 0; i < this.count; i++) {
            positions[i * 3 + 0] = (Math.random() - 0.5) * area;
            positions[i * 3 + 1] = Math.random() * height;
            positions[i * 3 + 2] = (Math.random() - 0.5) * area;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const texture = simple ? null : new THREE.TextureLoader().load(textureUrl);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
                uSize: { value: size },
                uRadius: { value: radius },
                uArea: { value: shaderArea },
                uTexture: { value: texture || new THREE.Texture() },
                uSimple: { value: simple }
            },
            vertexShader,
            fragmentShader,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending
        });


        this.points = new THREE.Points(geometry, this.material);
        this.scene.add(this.points);

        this.clock = new THREE.Clock();
        window.addEventListener('resize', () => {
            this.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
        });
    }

    update() {
        this.material.uniforms.uTime.value = this.clock.getElapsedTime() * this.snowFallSpeed;
    }

    // Controls
    setSize(v) { this.material.uniforms.uSize.value = v; }
    setWind(v) { this.material.uniforms.uRadius.value = v; }
    setAreaScale(v) {
        this.areaScale = v;
        this.material.uniforms.uArea.value = 7.0 * v;
    }
    setSimple(v) { this.material.uniforms.uSimple.value = v; }

    dispose() {
        this.points.geometry.dispose();
        this.material.uniforms.uTexture.value?.dispose();
        this.material.dispose();
        this.scene.remove(this.points);
    }
}