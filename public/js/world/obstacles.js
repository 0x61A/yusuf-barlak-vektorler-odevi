// Ağaç ve taşlar.
// Oyun şeridindekiler engeldir: mermiyi durdurur, tankı yavaşlatır; vurulunca veya
// tank üstünden geçince parçalanır. Arkadakiler yalnızca süstür (InstancedMesh).

import * as THREE from 'three';
import { rng } from '../physics/vec2.js';
import { ENGEL } from '../config.js';

const MAT = {
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 1 }),
  leaves: [0x3f7d2a, 0x4e8f32, 0x356b24].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
  rock: new THREE.MeshStandardMaterial({ color: 0x8b9096, roughness: 0.95, flatShading: true }),
};

function treeMesh(r, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 3.2, 7), MAT.trunk);
  trunk.position.y = 1.6;
  g.add(trunk);
  const leaves = MAT.leaves[Math.floor(r() * MAT.leaves.length)];
  if (r() < 0.5) {
    // çam: üst üste koniler
    for (let k = 0; k < 3; k++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.3 - k * 0.55, 2.4, 7), leaves);
      cone.position.y = 3.2 + k * 1.25;
      g.add(cone);
    }
  } else {
    // yaprak döken: iki küre öbeği
    const a = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), leaves);
    a.position.y = 4.6;
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 0), leaves);
    b.position.set(0.9, 5.7, 0.3);
    g.add(a, b);
  }
  g.scale.setScalar(s);
  g.rotation.y = r() * Math.PI * 2;
  g.traverse((o) => {
    o.castShadow = true;
  });
  return g;
}

function rockMesh(r, size) {
  const g = new THREE.Group();
  const main = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), MAT.rock);
  main.scale.set(1.15, 0.75, 0.95);
  main.position.y = size * 0.45;
  main.rotation.set(r(), r() * 3, r());
  g.add(main);
  const small = new THREE.Mesh(new THREE.DodecahedronGeometry(size * 0.45, 0), MAT.rock);
  small.position.set(size * 0.9, size * 0.2, size * 0.6);
  g.add(small);
  g.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return g;
}

export class Obstacles {
  // bounds: oynanan alan · spawns: tank x'leri (yakınına engel konmaz)
  constructor(scene, hm, { bounds, spawns, seed }) {
    this.scene = scene;
    this.hm = hm;
    this.list = [];
    const r = rng(seed + 21);
    const taken = [...spawns];
    const place = (type, count) => {
      for (let tries = 0, placed = 0; placed < count && tries < 400; tries++) {
        const x = bounds.min + 6 + r() * (bounds.max - bounds.min - 12);
        if (spawns.some((s) => Math.abs(x - s) < ENGEL.bosluk)) continue;
        if (taken.some((s) => Math.abs(x - s) < ENGEL.aralik)) continue;
        if (Math.abs(hm.slopeAt(x, 1.5)) > 0.8) continue;
        taken.push(x);
        placed++;
        const s = type === 'agac' ? 0.9 + r() * 0.35 : 1.2 + r() * 0.8;
        const mesh = type === 'agac' ? treeMesh(r, s) : rockMesh(r, s);
        const o = {
          id: `${type}${placed}`,
          type,
          x,
          y: hm.heightAt(x),
          vy: 0,
          size: s,
          alive: true,
          crush: 0,
          sertlik: ENGEL[type].sertlik,
          baseR: type === 'agac' ? 0.6 : s * 0.9,
          circles: [],
          mesh,
        };
        this.placeCircles(o);
        mesh.position.set(x, o.y, 0);
        scene.add(mesh);
        this.list.push(o);
      }
    };
    place('agac', ENGEL.agac.sayi);
    place('kaya', ENGEL.kaya.sayi);
  }

  // Fizik için vurulma daireleri: ağaçta gövde + taç, taşta tek daire
  placeCircles(o) {
    const s = o.size;
    o.circles = o.type === 'agac'
      ? [{ cx: o.x, cy: o.y + 1.6 * s, r: 0.5 * s }, { cx: o.x, cy: o.y + 4.7 * s, r: 2.1 * s }]
      : [{ cx: o.x, cy: o.y + 0.45 * s, r: 1.05 * s }];
  }

  // Altındaki toprak giderse yerçekimiyle düşer (Euler)
  update(dt, g) {
    for (const o of this.list) {
      if (!o.alive) continue;
      const ground = this.hm.heightAt(o.x);
      if (o.y > ground + 0.05 || o.vy < 0) {
        o.vy -= g * dt;
        o.y += o.vy * dt;
        if (o.y <= ground) {
          o.y = ground;
          o.vy = 0;
        }
      } else if (o.y < ground) {
        o.y = ground;
      } else continue;
      o.mesh.position.y = o.y;
      this.placeCircles(o);
    }
  }

  // Patlama yarıçapına giren engeller
  within(x, y, radius) {
    return this.list.filter((o) => o.alive && o.circles.some((c) => Math.hypot(c.cx - x, c.cy - y) < radius + c.r));
  }

  shatter(o) {
    o.alive = false;
    this.scene.remove(o.mesh);
  }
}

// Arka plandaki ve harita kenarlarındaki süs ağaçları (etkileşimsiz)
export function decorTrees(scene, terrain, { width, bounds, seed, count }) {
  const r = rng(seed + 33);
  const spots = [];
  for (let k = 0; k < count; k++) {
    const z = -21 - r() * 55;
    const x = r() * width;
    spots.push({ x, z, s: 0.8 + r() * 0.7, y: terrain.heightAt3(x, z) });
  }
  // Oyun alanı dışında, şeridin üstünde de birkaç ağaç: kenarlar boş kalmasın
  for (let k = 0; k < count / 6; k++) {
    const left = r() < 0.5;
    const x = left ? r() * (bounds.min - 20) : bounds.max + 20 + r() * (width - bounds.max - 20);
    const z = -6 + r() * 10;
    spots.push({ x, z, s: 0.9 + r() * 0.5, y: terrain.heightAt3(x, 0) });
  }
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 3.4, 6), MAT.trunk, spots.length);
  const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.2, 0), new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const c = new THREE.Color();
  spots.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.x, p.y + 1.7 * p.s, p.z), q, new THREE.Vector3(p.s, p.s, p.s));
    trunk.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(p.x, p.y + 4.6 * p.s, p.z), q, new THREE.Vector3(p.s, p.s * 1.15, p.s));
    crown.setMatrixAt(i, m);
    crown.setColorAt(i, c.setHSL(0.27 + r() * 0.06, 0.45 + r() * 0.15, 0.24 + r() * 0.1));
  });
  trunk.castShadow = crown.castShadow = true;
  scene.add(trunk, crown);
  return { trunk, crown, total: spots.length };
}
