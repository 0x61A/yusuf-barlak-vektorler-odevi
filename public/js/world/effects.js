// Görsel efektler: patlama (ateş, toz, duman), enkaz, ışık çakması, mermi izi, önizleme noktaları.

import * as THREE from 'three';

function canvasTex(draw) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  draw(c.getContext('2d'));
  return new THREE.CanvasTexture(c);
}

// Yumuşak daire (ateş, duman, toz)
let softTex = null;
export function softTexture() {
  softTex ??= canvasTex((ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
  return softTex;
}

// Koyu konturlu nokta: hem gökyüzünde hem çimende okunur
let dotTex = null;
function dotTexture() {
  dotTex ??= canvasTex((ctx) => {
    ctx.beginPath();
    ctx.arc(32, 32, 26, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(32, 32, 17, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  });
  return dotTex;
}

// Nokta dizisi (ince çizgiler yüksek DPI ekranda kaybolduğu için yollar noktalarla çizilir).
// size: ekran pikseli (zoomdan bağımsız), spacing: noktalar arası metre. Renk noktanın içini boyar.
export class DotLine {
  constructor(scene, { max = 12000, size = 7, spacing = 1, color = 0xffffff, opacity = 1 } = {}) {
    this.scene = scene;
    this.max = max;
    this.spacing = spacing;
    this.pos = new Float32Array(max * 3);
    this.n = 0;
    this.last = null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size, sizeAttenuation: false, color, map: dotTexture(), transparent: true, opacity,
        alphaTest: 0.1, depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
  }

  write(x, y, z = 0) {
    if (this.n >= this.max) return;
    this.pos.set([x, y, z], this.n * 3);
    this.n++;
    this.last = { x, y };
  }

  commit() {
    this.points.geometry.setDrawRange(0, this.n);
    this.points.geometry.attributes.position.needsUpdate = true;
  }

  // Son noktadan en az spacing uzaktaysa ekle (iz için)
  push(x, y, force = false) {
    if (!force && this.last && Math.hypot(x - this.last.x, y - this.last.y) < this.spacing) return;
    this.write(x, y);
    this.commit();
  }

  // Çoklu yolu eşit aralıklı noktalara örnekle (önizleme için)
  setPaths(paths, z = 0) {
    this.n = 0;
    for (const path of paths) {
      if (!path.length) continue;
      let carry = 0;
      this.write(path[0].x, path[0].y, z);
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1];
        const b = path[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        let d = this.spacing - carry;
        while (d <= len) {
          const k = d / len;
          this.write(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, z);
          d += this.spacing;
        }
        carry = len - (d - this.spacing);
      }
    }
    this.commit();
  }

  set visible(v) {
    this.points.visible = v;
  }

  setColor(hex) {
    this.points.material.color.set(hex);
  }

  dispose() {
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
  }
}

// Parçacık sistemi. Her parçacık Euler ile ilerler; renk ve saydamlık ömürle söner.
class Particles {
  constructor(scene, { max, size, additive, gravity, drag }) {
    this.max = max;
    this.gravity = gravity;
    this.drag = drag;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.vel = new Float32Array(max * 3);
    this.base = new Float32Array(max * 4);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size, map: softTexture(), vertexColors: true, transparent: true, depthWrite: false,
        blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
    scene.add(this.points);
  }

  emit(x, y, z, vx, vy, vz, color, alpha, life) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.base.set([color.r, color.g, color.b, alpha], i * 4);
    this.life[i] = life;
    this.maxLife[i] = life;
  }

  update(dt, g) {
    const drag = 1 - this.drag * dt;
    for (let i = 0; i < this.max; i++) {
      const o4 = i * 4;
      if (this.life[i] <= 0) {
        this.col[o4 + 3] = 0;
        continue;
      }
      this.life[i] -= dt;
      const o = i * 3;
      const k = Math.max(0, this.life[i] / this.maxLife[i]);
      this.vel[o + 1] -= g * this.gravity * dt;
      this.vel[o] *= drag;
      this.vel[o + 1] *= drag;
      this.vel[o + 2] *= drag;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] += this.vel[o + 1] * dt;
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.col[o4] = this.base[o4];
      this.col[o4 + 1] = this.base[o4 + 1];
      this.col[o4 + 2] = this.base[o4 + 2];
      this.col[o4 + 3] = this.base[o4 + 3] * k;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}

const C = (hex) => new THREE.Color(hex);
const FIRE = [C(0xffd43b), C(0xff922b), C(0xf03e3e)];
const SMOKE = [C(0x6c6f73), C(0x8d9196), C(0x4a4d50)];
const DIRT = [C(0x6b4a2b), C(0x8a6038), C(0x4f8a2c)];
const DEBRIS = {
  agac: [C(0x3f7d2a), C(0x4e8f32), C(0x6b4423), C(0x8a5a2e)],
  kaya: [C(0x8b9096), C(0x6f747a), C(0xa5aab0)],
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.fire = new Particles(scene, { max: 900, size: 2.6, additive: true, gravity: 0.25, drag: 2.2 });
    this.dust = new Particles(scene, { max: 1600, size: 1.1, additive: false, gravity: 1, drag: 0.6 });
    this.smoke = new Particles(scene, { max: 500, size: 5, additive: false, gravity: -0.06, drag: 1.4 });
    this.flash = new THREE.PointLight(0xffb347, 0, 70, 1.5);
    scene.add(this.flash);
    this.rings = [];
    this.shake = 0;
  }

  explosion(x, y, radius) {
    const n = Math.round(40 + radius * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI;
      const s = (0.3 + Math.random()) * radius * 2.6;
      this.fire.emit(x, y, (Math.random() - 0.5) * 3, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * s, pick(FIRE), 0.9, 0.35 + Math.random() * 0.45);
    }
    for (let i = 0; i < n * 0.8; i++) {
      const a = 0.25 + Math.random() * (Math.PI - 0.5);
      const s = 5 + Math.random() * radius * 2.4;
      this.dust.emit(x, y, (Math.random() - 0.5) * 6, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 4, pick(DIRT), 1, 0.9 + Math.random() * 0.8);
    }
    for (let i = 0; i < 10 + radius * 2; i++) {
      this.smoke.emit(x + (Math.random() - 0.5) * radius, y + Math.random() * radius * 0.6, (Math.random() - 0.5) * 4,
        (Math.random() - 0.5) * 3, 2 + Math.random() * 3, 0, pick(SMOKE), 0.55, 1.6 + Math.random() * 1.4);
    }
    this.flash.position.set(x, y + 2, 6);
    this.flash.intensity = 90 * radius;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    );
    ring.position.set(x, y, 8.5);
    ring.userData = { t: 0, r: radius };
    this.scene.add(ring);
    this.rings.push(ring);
    this.shake = Math.min(1.6, this.shake + radius * 0.12);
  }

  // Ağaç/taş parçalanması
  debris(x, y, type, height) {
    const cols = DEBRIS[type];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI;
      const s = 3 + Math.random() * 9;
      this.dust.emit(x + (Math.random() - 0.5) * 2, y + Math.random() * height, (Math.random() - 0.5) * 3,
        Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 4, pick(cols), 1, 0.8 + Math.random() * 0.9);
    }
    for (let i = 0; i < 6; i++) {
      this.smoke.emit(x, y + Math.random() * height * 0.6, 0, (Math.random() - 0.5) * 2, 1.5, 0, type === 'kaya' ? C(0xb0b4b8) : C(0x9a8a6a), 0.4, 1.2);
    }
  }

  spark(x, y, count = 16) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 8;
      this.fire.emit(x, y, 0, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 4, pick(FIRE), 0.9, 0.25 + Math.random() * 0.25);
    }
  }

  muzzle(x, y, thetaDeg) {
    const t = (thetaDeg * Math.PI) / 180;
    for (let i = 0; i < 22; i++) {
      const a = t + (Math.random() - 0.5) * 0.6;
      const s = 6 + Math.random() * 12;
      this.fire.emit(x, y, 0, Math.cos(a) * s, Math.sin(a) * s, (Math.random() - 0.5) * 3, pick(FIRE), 0.9, 0.2 + Math.random() * 0.15);
    }
    for (let i = 0; i < 8; i++) {
      const a = t + (Math.random() - 0.5) * 0.9;
      this.smoke.emit(x, y, 0, Math.cos(a) * 4, Math.sin(a) * 4, 0, pick(SMOKE), 0.45, 1 + Math.random());
    }
    this.shake = Math.min(1.6, this.shake + 0.25);
  }

  update(dt, g) {
    this.fire.update(dt, g);
    this.dust.update(dt, g);
    this.smoke.update(dt, g);
    this.flash.intensity *= Math.exp(-dt * 9);
    for (const ring of this.rings.slice()) {
      ring.userData.t += dt;
      const k = ring.userData.t / 0.5;
      ring.scale.setScalar(ring.userData.r * (0.3 + k * 1.6));
      ring.material.opacity = Math.max(0, 0.6 * (1 - k));
      if (k >= 1) {
        this.scene.remove(ring);
        ring.geometry.dispose();
        ring.material.dispose();
        this.rings.splice(this.rings.indexOf(ring), 1);
      }
    }
    this.shake *= Math.exp(-dt * 6);
  }
}

// Mermi (koyu metal top) + arkasında kalan renkli iz
const shellGeo = new THREE.SphereGeometry(0.5, 14, 10);
const shellMat = new THREE.MeshStandardMaterial({ color: 0x2f3236, metalness: 0.6, roughness: 0.35 });

export class ProjectileView {
  constructor(scene, colorHex) {
    this.scene = scene;
    this.mesh = new THREE.Mesh(shellGeo, shellMat);
    this.mesh.castShadow = true;
    this.trail = new DotLine(scene, { size: 6, spacing: 0.9, color: colorHex });
    scene.add(this.mesh);
  }

  set(x, y) {
    this.mesh.position.set(x, y, 0);
    this.trail.push(x, y);
  }

  // Mermi bitti: top kaybolur, iz kalır
  land(x, y) {
    this.trail.push(x, y, true);
    this.scene.remove(this.mesh);
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.trail.dispose();
  }
}

// Önizleme: tam yol, nokta nokta (ilk çarpışmaya kadar; sekme ve parçalar dahil)
export class PreviewPath {
  constructor(scene) {
    this.dots = new DotLine(scene, { max: 20000, size: 9, spacing: 2 });
    this.marker = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.5, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, depthTest: false }),
    );
    this.marker.renderOrder = 7;
    scene.add(this.marker);
  }

  set(paths, impacts, color) {
    this.dots.setPaths(paths);
    this.dots.setColor(0xffffff);
    this.dots.visible = true;
    this.marker.material.color.set(color);
    const first = impacts[0];
    this.marker.visible = Boolean(first);
    if (first) this.marker.position.set(first.x, first.y + 0.2, 8.6);
  }

  hide() {
    this.dots.visible = false;
    this.marker.visible = false;
  }
}
