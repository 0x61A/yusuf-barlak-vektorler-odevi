// Arazi görseli: çimenli yüzey ızgarası + önde toprak kesiti.
// Oynanan şerit (z = −8…+8) yükseklik haritasını birebir izler; arkaya doğru
// yumuşakça doğal tepelere, en sonda uzak çimen zemine bağlanır. Böylece harita
// ne yanlardan ne arkadan "kesilmiş" görünür.

import * as THREE from 'three';
import { rng } from '../physics/vec2.js';

const FRONT = 8;
const PLAY_BACK = -8;
const BOTTOM = -600;
const ROWS = [8, 4, 0, -4, -8, -9.5, -13, -19, -28, -40, -56, -76, -100, -130];
const BACK_SPAN = 130 - 8;
// Krater arka sıralara azalarak yansır: şeridin arkasında dik hendek duvarı kalmaz, çanak görünür
const CRATER_FADE = { '-9.5': 0.7, '-13': 0.35, '-19': 0.1 };

const GRASS = [new THREE.Color(0x5f9a35), new THREE.Color(0x6fae3e), new THREE.Color(0x4f8a2c)];
const DIRT = new THREE.Color(0x7a5532);
const SOIL_TOP = new THREE.Color(0x8a6038);
const SOIL_MID = new THREE.Color(0x5e3f25);
const SOIL_DEEP = new THREE.Color(0x2a1c12);

function noiseTexture(seed, base, spots) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  const r = rng(seed);
  for (let i = 0; i < 900; i++) {
    const [col, a] = spots[Math.floor(r() * spots.length)];
    ctx.globalAlpha = a;
    ctx.fillStyle = col;
    const s = 1 + r() * 3;
    ctx.fillRect(r() * 128, r() * 128, s, s);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

const smooth = (t) => t * t * (3 - 2 * t);
const hash = (i, j) => {
  const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export class TerrainMesh {
  // farBase: arka tepelerin taban yüksekliği (uzak zeminle aynı)
  constructor(hm, { farBase, seed, hills = 1 }) {
    this.hm = hm;
    this.h0 = Float32Array.from(hm.h);
    this.farBase = farBase;
    const r = rng(seed + 11);
    this.waves = [
      { A: 8 * hills, k: 0.009 + r() * 0.004, p: r() * 6.28 },
      { A: 4 * hills, k: 0.024 + r() * 0.01, p: r() * 6.28 },
      { A: 1.5 * hills, k: 0.07 + r() * 0.03, p: r() * 6.28 },
    ];
    this.group = new THREE.Group();
    this.buildSurface();
    this.buildFront();
  }

  // Arka sıralar: oyun şeridinin ilk hâlinden doğal tepelere, sonra uzak zemine geçiş
  backHeight(i, z) {
    const x = this.hm.xAt(i);
    const t = Math.min(1, (PLAY_BACK - z) / BACK_SPAN);
    let hills = 0;
    for (const w of this.waves) hills += w.A * Math.sin(x * w.k + w.p + z * 0.02);
    const far = this.farBase + hills * Math.sin(Math.PI * t);
    const k = smooth(Math.min(1, t * 2.2));
    return this.h0[i] * (1 - k) + far * k;
  }

  // Dünyadaki herhangi bir (x, z) noktasının arazi yüksekliği (süs ağaçları için)
  heightAt3(x, z) {
    const i = Math.round(Math.min(Math.max(x / this.hm.step, 0), this.hm.n - 1));
    return z >= PLAY_BACK ? this.hm.h[i] : this.backHeight(i, z);
  }

  buildSurface() {
    const hm = this.hm;
    const n = hm.n;
    const R = ROWS.length;
    const pos = new Float32Array(n * R * 3);
    const col = new Float32Array(n * R * 3);
    const uv = new Float32Array(n * R * 2);
    const idx = [];
    const c = new THREE.Color();
    for (let j = 0; j < R; j++) {
      const z = ROWS[j];
      for (let i = 0; i < n; i++) {
        const v = j * n + i;
        const x = hm.xAt(i);
        const y = z >= PLAY_BACK ? hm.h[i] : this.backHeight(i, z);
        pos.set([x, y, z], v * 3);
        uv.set([x / 6, z / 6], v * 2);
        const a = hash(Math.floor(x / 9), j);
        c.copy(GRASS[0]).lerp(a < 0.5 ? GRASS[1] : GRASS[2], Math.abs(a - 0.5) * 1.4);
        col.set([c.r, c.g, c.b], v * 3);
        if (i < n - 1 && j < R - 1) {
          const a0 = v;
          const b0 = v + n;
          idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    this.surface = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        map: noiseTexture(3, '#ffffff', [['#c8e6a0', 0.5], ['#7a9a5a', 0.35], ['#e8f5d0', 0.4]]),
      }),
    );
    this.surface.receiveShadow = true;
    this.group.add(this.surface);
  }

  // Ön kesit: çimen şeridi + toprak katmanları (derine indikçe koyulaşır)
  buildFront() {
    const hm = this.hm;
    const n = hm.n;
    const pos = new Float32Array(n * 5 * 3);
    const col = new Float32Array(n * 5 * 3);
    const uv = new Float32Array(n * 5 * 2);
    const idx = [];
    const colors = [GRASS[0], GRASS[0], SOIL_TOP, SOIL_MID, SOIL_DEEP];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 5; k++) {
        const v = i * 5 + k;
        col.set([colors[k].r, colors[k].g, colors[k].b], v * 3);
      }
      if (i < n - 1) {
        const a = i * 5;
        const b = a + 5;
        // çimen şeridi (0-1) ve toprak (2-3, 3-4)
        for (const [p, q] of [[0, 1], [2, 3], [3, 4]]) idx.push(a + p, a + q, b + p, a + q, b + q, b + p);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.front = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 1,
        map: noiseTexture(9, '#ffffff', [['#3b2a1a', 0.35], ['#c9a27a', 0.35], ['#8c8c8c', 0.5]]),
      }),
    );
    this.writeFront(0, n - 1);
    this.group.add(this.front);
  }

  writeFront(i0, i1) {
    const hm = this.hm;
    const p = this.front.geometry.attributes.position.array;
    const uv = this.front.geometry.attributes.uv.array;
    for (let i = i0; i <= i1; i++) {
      const x = hm.xAt(i);
      const h = hm.h[i];
      const ys = [h, h - 0.7, h - 0.7, h - 14, BOTTOM];
      for (let k = 0; k < 5; k++) {
        const v = i * 5 + k;
        p.set([x, ys[k], FRONT + 0.01], v * 3);
        uv.set([x / 5, ys[k] / 5], v * 2);
      }
    }
    this.front.geometry.attributes.position.needsUpdate = true;
    this.front.geometry.attributes.uv.needsUpdate = true;
    this.front.geometry.computeVertexNormals();
  }

  // Krater sonrası: şeridin yüksekliklerini güncelle, açılan yerleri toprak rengine boya
  update([i0, i1]) {
    const hm = this.hm;
    const n = hm.n;
    const g = this.surface.geometry;
    const p = g.attributes.position.array;
    const col = g.attributes.color.array;
    const c = new THREE.Color();
    for (let j = 0; j < ROWS.length; j++) {
      const z = ROWS[j];
      const fade = z >= PLAY_BACK ? 1 : CRATER_FADE[z];
      if (!fade) continue;
      for (let i = i0; i <= i1; i++) {
        const v = j * n + i;
        const carved = Math.max(0, this.h0[i] - hm.h[i]);
        p[v * 3 + 1] = z >= PLAY_BACK ? hm.h[i] : this.backHeight(i, z) - carved * fade;
        const dug = Math.min(1, Math.max(0, (carved * fade) / 1.2));
        if (dug > 0) {
          c.fromArray(col, v * 3).lerp(DIRT, dug);
          col.set([c.r, c.g, c.b], v * 3);
        }
      }
    }
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.computeVertexNormals();
    this.writeFront(i0, i1);
  }
}
