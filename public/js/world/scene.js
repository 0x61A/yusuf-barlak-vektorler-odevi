// Renderer, gündüz ışığı, gökyüzü, bulutlar, gri beton şehir ve uzak tepeler.

import * as THREE from 'three';
import { rng } from '../physics/vec2.js';

const FOG_COLOR = 0xcfe2ee;
const SUN_DIR = new THREE.Vector3(-0.45, 0.8, 0.55).normalize();

function skyDome() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { uSun: { value: SUN_DIR } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vDir;
      void main() {
        float h = max(vDir.y, 0.0);
        vec3 top = vec3(0.16, 0.42, 0.78);
        vec3 horizon = vec3(0.66, 0.8, 0.9);
        vec3 col = mix(horizon, top, pow(h, 0.55));
        float sun = max(dot(normalize(vDir), uSun), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(sun, 600.0) * 1.2 + pow(sun, 12.0) * 0.12);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(7000, 32, 16), mat);
  mesh.renderOrder = -1;
  return mesh;
}

// Gri beton binalar: tek InstancedMesh. Pencereler ve gölgelendirme shader içinde.
function city(width, groundY, seed) {
  const r = rng(seed);
  const boxes = [];
  const rows = [
    { z: [-260, -340], count: 20, h: [18, 45], w: [16, 30] },
    { z: [-360, -460], count: 28, h: [30, 80], w: [18, 36] },
    { z: [-480, -650], count: 34, h: [50, 130], w: [22, 46] },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      boxes.push({
        x: -300 + r() * (width + 600),
        z: row.z[0] + r() * (row.z[1] - row.z[0]),
        w: row.w[0] + r() * (row.w[1] - row.w[0]),
        d: 12 + r() * 20,
        h: row.h[0] + r() * (row.h[1] - row.h[0]),
        seed: r(),
      });
    }
  }
  boxes.sort(() => r() - 0.5);

  const geo = new THREE.BoxGeometry(1, 1, 1);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from(boxes, (b) => b.seed), 1));
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSun: { value: SUN_DIR } }]),
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vN = normal;
        vSeed = aSeed;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun;
      varying vec3 vWorld;
      varying vec3 vN;
      varying float vSeed;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main() {
        float shade = 0.3 + 0.16 * hash(vec2(vSeed * 13.1, 7.0));
        vec3 concrete = vec3(shade, shade * 0.98, shade * 0.95);
        float u = abs(vN.z) > 0.5 ? vWorld.x : vWorld.z;
        vec2 cell = vec2(u / 3.4, vWorld.y / 3.8);
        vec2 f = fract(cell);
        float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.3, f.y) * step(f.y, 0.82);
        float wall = 1.0 - step(0.5, abs(vN.y));
        vec3 glass = mix(vec3(0.12, 0.17, 0.22), vec3(0.32, 0.4, 0.48), hash(floor(cell) + vSeed));
        vec3 col = mix(concrete, glass, win * wall);
        col *= 1.0 - 0.25 * step(0.92, f.y) * wall; // kat çizgisi
        float light = 0.5 + 0.65 * max(dot(normalize(vN), uSun), 0.0);
        gl_FragColor = vec4(col * light, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, boxes.length);
  const m = new THREE.Matrix4();
  boxes.forEach((b, i) => {
    m.compose(new THREE.Vector3(b.x, groundY + b.h / 2 - 1, b.z), new THREE.Quaternion(), new THREE.Vector3(b.w, b.h, b.d));
    mesh.setMatrixAt(i, m);
  });
  mesh.frustumCulled = false;
  mesh.userData.boxes = boxes;
  return mesh;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const x = 40 + r() * 176;
    const y = 50 + r() * 40;
    const rad = 22 + r() * 30;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function clouds(width, seed) {
  const r = rng(seed + 3);
  const tex = cloudTexture();
  const group = new THREE.Group();
  for (let i = 0; i < 16; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    const k = 70 + r() * 90;
    s.scale.set(k * 2, k, 1);
    s.position.set(-400 + r() * (width + 800), 110 + r() * 120, -380 - r() * 500);
    s.userData.speed = 1 + r() * 2.5;
    group.add(s);
  }
  group.userData.span = width + 800;
  return group;
}

// Ufuktaki mavimsi tepe siluetleri
function farHills(width, { z, seed, color, amp, base }) {
  const r = rng(seed);
  const waves = [0, 1, 2].map((k) => ({ A: amp / (k + 1), L: (420 + r() * 300) / (k + 1), p: r() * 6.28 }));
  const pts = [];
  for (let x = -1500; x <= width + 1500; x += 12) {
    let y = base;
    for (const w of waves) y += w.A * Math.sin((2 * Math.PI * x) / w.L + w.p);
    pts.push(x, y);
  }
  const n = pts.length / 2;
  const pos = new Float32Array(n * 6);
  const idx = [];
  for (let i = 0; i < n; i++) {
    pos.set([pts[i * 2], pts[i * 2 + 1], z, pts[i * 2], base - 200, z], i * 6);
    if (i < n - 1) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, fog: true }));
}

export function createScene(canvas, { width, groundY, fogDensity, seed }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.FogExp2(FOG_COLOR, fogDensity);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 9000);
  const sky = skyDome();
  scene.add(sky);

  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x5c7a38, 1.25));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
  sun.position.copy(SUN_DIR).multiplyScalar(300).add(new THREE.Vector3(width / 2, 0, 0));
  sun.target.position.set(width / 2, 0, 0);
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -Math.min(width, 700) / 2;
  sc.right = -sc.left;
  sc.top = 120;
  sc.bottom = -120;
  sc.near = 50;
  sc.far = 700;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.4;
  scene.add(sun, sun.target);

  // Uzak zemin: yalnızca arazinin ARKASINDA ufka kadar uzanan çimen (önde toprak kesiti görünür)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(40000, 20000),
    new THREE.MeshStandardMaterial({ color: 0x6f9447, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(width / 2, groundY - 0.4, -125 - 10000);
  scene.add(ground);

  scene.add(farHills(width, { z: -900, seed: seed + 1, color: 0x9fb8b0, amp: 60, base: groundY + 20 }));
  scene.add(farHills(width, { z: -1300, seed: seed + 2, color: 0xb4c7cc, amp: 90, base: groundY + 40 }));

  const cityMesh = city(width, groundY, seed);
  scene.add(cityMesh);
  const cloudGroup = clouds(width, seed);
  scene.add(cloudGroup);

  let preset = null;

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preset?.dpr ?? 1));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function applyQuality(p) {
    preset = p;
    renderer.shadowMap.enabled = p.shadows && width < 1500;
    sun.castShadow = renderer.shadowMap.enabled;
    scene.traverse((o) => {
      if (o.material) o.material.needsUpdate = true;
    });
    cityMesh.count = Math.floor(cityMesh.userData.boxes.length * p.buildings);
    cloudGroup.visible = p.clouds;
    resize();
  }

  function render(dt) {
    sky.position.copy(camera.position);
    const span = cloudGroup.userData.span;
    for (const c of cloudGroup.children) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > width + 400) c.position.x -= span;
    }
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, resize, applyQuality, render };
}
