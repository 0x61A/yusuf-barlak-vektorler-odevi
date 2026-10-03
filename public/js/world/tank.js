// Tank: primitif şekillerden askeri model + konum, can, yakıt, hareket ve düşme.

import * as THREE from 'three';
import { TANK, SILAHLAR } from '../config.js';
import { DEG } from '../physics/vec2.js';

function buildModel(color) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // yöne göre aynalanan kısım
  root.add(body);

  const base = new THREE.Color(color);
  const paint = new THREE.MeshStandardMaterial({ color: base, metalness: 0.15, roughness: 0.7 });
  const paintDark = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.72), metalness: 0.15, roughness: 0.75 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x2b2d2f, metalness: 0.5, roughness: 0.55 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x55585b, metalness: 0.4, roughness: 0.6 });

  // Gövde profili (yandan), z yönünde uzatılır
  const shape = new THREE.Shape();
  shape.moveTo(-2.9, 0.6);
  shape.lineTo(2.9, 0.6);
  shape.lineTo(3.25, 1.05);
  shape.lineTo(2.6, 1.65);
  shape.lineTo(-2.7, 1.65);
  shape.lineTo(-3.1, 1.05);
  shape.closePath();
  const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 1 });
  hullGeo.translate(0, 0, -1.3);
  const hull = new THREE.Mesh(hullGeo, paint);
  body.add(hull);

  // Paletler ve tekerlekler
  for (const z of [-1.5, 1.5]) {
    const track = new THREE.Mesh(new THREE.BoxGeometry(6.1, 0.9, 0.75), rubber);
    track.position.set(0, 0.45, z);
    body.add(track);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.12, 0.85), paintDark);
    guard.position.set(0, 0.95, z);
    body.add(guard);
    for (let i = -2; i <= 2; i++) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.8, 12), hub);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(i * 1.2, 0.42, z);
      body.add(wheel);
    }
  }

  // Ön farlar ve arka egzoz
  for (const z of [-0.85, 0.85]) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0xf3f0d8, emissive: 0x6b6650 }));
    lamp.rotation.z = Math.PI / 2;
    lamp.position.set(3.05, 1.2, z);
    body.add(lamp);
  }
  const exhaust = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.9), steel);
  exhaust.position.set(-2.85, 1.35, 0.6);
  body.add(exhaust);

  // Taret
  const turret = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.45, 0.85, 10), paintDark);
  turret.position.y = 2.1;
  root.add(turret);
  const hatch = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 10), paint);
  hatch.position.set(-0.35, 2.6, 0.3);
  root.add(hatch);
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.2, 5), steel);
  antenna.position.set(-0.8, 3.5, -0.6);
  root.add(antenna);

  // Namlu: pivot etrafında döner, +x yönünde uzanır
  const pivot = new THREE.Group();
  pivot.position.y = TANK.pivotYuksekligi;
  root.add(pivot);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.25, TANK.namluBoyu, 12), steel);
  barrel.rotation.z = -Math.PI / 2;
  barrel.position.x = TANK.namluBoyu / 2;
  pivot.add(barrel);
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.45, 12), steel);
  brake.rotation.z = -Math.PI / 2;
  brake.position.x = TANK.namluBoyu - 0.2;
  pivot.add(brake);

  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return { root, body, pivot };
}

export class Tank {
  constructor({ id, name, color, isPlayer, x, hm, unlimited = false }) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.isPlayer = isPlayer;
    this.hm = hm;
    this.unlimited = unlimited;
    this.x = x;
    this.y = hm.heightAt(x);
    this.vy = 0;
    this.tilt = 0;
    this.theta = 45;
    this.V = 35;
    this.hp = TANK.can;
    this.fuel = TANK.yakit;
    this.alive = true;
    this.drive = 0;
    this.blocked = false;
    this.atEdge = false;
    this.crushing = null;
    this.ammo = Object.fromEntries(SILAHLAR.map((w) => [w.id, unlimited ? Infinity : w.adet]));
    const m = buildModel(color);
    this.mesh = m.root;
    this.body = m.body;
    this.pivotObj = m.pivot;
    this.updateMesh();
  }

  // Vurulma dairesi (fizik modülü bunları okur)
  get cx() {
    return this.x;
  }
  get cy() {
    return this.y + TANK.govdeYuksekligi;
  }
  get r() {
    return TANK.vurulmaYaricap;
  }

  get falling() {
    return this.y > this.hm.heightAt(this.x) + 0.02 || this.vy < 0;
  }

  // Namlu döner noktası, tankın eğimine göre döndürülmüş
  pivot() {
    const s = Math.sin(this.tilt);
    const c = Math.cos(this.tilt);
    const h = TANK.pivotYuksekligi;
    return { x: this.x - s * h, y: this.y + c * h };
  }

  muzzleAt(thetaDeg) {
    const p = this.pivot();
    const t = thetaDeg * DEG;
    return { x: p.x + TANK.namluBoyu * Math.cos(t), y: p.y + TANK.namluBoyu * Math.sin(t) };
  }

  hasFuel() {
    return this.unlimited || this.fuel > 0;
  }

  useFuel(meters) {
    if (!this.unlimited) this.fuel = Math.max(0, this.fuel - meters * TANK.yakitMetre);
  }

  // Sabit adım güncellemesi: sürüş, engel ezme, yerçekimiyle düşme (Euler).
  // Yokuşta hız düşer (zorlaşır) ama çok dik olmadıkça tank geçer.
  update(dt, g, { others, bounds, obstacles = [], onCrush }) {
    if (!this.alive) return;
    const hm = this.hm;
    this.blocked = false;
    this.atEdge = false;
    this.crushing = null;
    const dir = this.drive;
    if (dir && !this.falling && this.hasFuel()) {
      const ob = obstacles.find((o) => o.alive && Math.sign(o.x - this.x) === dir && Math.abs(o.x - this.x) < TANK.yarimBoy + o.baseR);
      if (ob) {
        // Engeli it: bir süre ilerleyemez, yakıt harcar, sonra engel parçalanır
        this.crushing = ob;
        ob.crush += dt;
        this.useFuel(TANK.hiz * 0.6 * dt);
        if (ob.crush >= ob.sertlik) onCrush?.(ob, this);
      } else {
        const slope = (hm.heightAt(this.x + dir * 2.4) - hm.heightAt(this.x)) / 2.4;
        const k = slope > 0 ? Math.max(TANK.minHizOrani, 1 - TANK.yokusYavaslama * slope) : 1;
        const nx = Math.min(Math.max(this.x + dir * TANK.hiz * k * dt, bounds.min), bounds.max);
        const bump = others.some((o) => o !== this && o.alive && Math.abs(nx - o.x) < 6.5 && Math.abs(nx - o.x) < Math.abs(this.x - o.x));
        if (slope > TANK.maxEgim || bump) this.blocked = true;
        else if (nx === this.x) this.atEdge = this.blocked = true;
        else {
          this.useFuel(Math.abs(nx - this.x));
          this.x = nx;
        }
      }
    }
    const ground = hm.heightAt(this.x);
    if (this.y > ground + 0.6 || this.vy < 0) {
      this.vy -= g * dt;
      this.y += this.vy * dt;
      if (this.y <= ground) {
        this.y = ground;
        this.vy = 0;
      }
    } else {
      this.y = ground;
    }
    const target = Math.atan((hm.heightAt(this.x + 2.4) - hm.heightAt(this.x - 2.4)) / 4.8);
    this.tilt += (target - this.tilt) * Math.min(1, dt * 10);
  }

  updateMesh() {
    this.mesh.position.set(this.x, this.y, 0);
    this.mesh.rotation.z = this.tilt;
    this.pivotObj.rotation.z = this.theta * DEG - this.tilt;
    this.body.scale.x = Math.cos(this.theta * DEG) >= 0 ? 1 : -1;
  }

  damage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp === 0) this.alive = false;
  }
}
