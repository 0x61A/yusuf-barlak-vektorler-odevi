// 3B vektör okları: V⃗ (turuncu), Vx (mavi), Vy (kırmızı) ve θ yayı.

import * as THREE from 'three';
import { RENKLER } from '../config.js';
import { DotLine } from './effects.js';

const SCALE = 0.28; // 1 m/s = 0.28 m ok boyu
const Z = 9; // arazinin önünde çizilir

class NeonArrow {
  constructor(color, radius = 0.14) {
    const mat = new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: false, transparent: true });
    this.group = new THREE.Group();
    this.shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 8), mat);
    this.head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3.4, 1.2, 12), mat);
    this.group.add(this.shaft, this.head);
    this.group.renderOrder = 10;
    this.shaft.renderOrder = 10;
    this.head.renderOrder = 10;
  }

  // origin'den (vx, vy) yönünde, büyüklüğü ok boyuna ölçeklenmiş
  set(ox, oy, vx, vy) {
    const len = Math.hypot(vx, vy) * SCALE;
    this.group.visible = len > 0.4;
    if (!this.group.visible) return;
    const shaftLen = Math.max(len - 1.2, 0.01);
    this.group.position.set(ox, oy, Z);
    this.group.rotation.z = Math.atan2(vy, vx) - Math.PI / 2;
    this.shaft.scale.y = shaftLen;
    this.shaft.position.y = shaftLen / 2;
    this.head.position.y = shaftLen + 0.6;
  }

  tip() {
    const v = new THREE.Vector3(0, this.shaft.scale.y + 1.2, 0);
    return this.group.localToWorld(v);
  }
}

export class VectorDisplay {
  constructor(scene) {
    this.group = new THREE.Group();
    this.v = new NeonArrow(RENKLER.vektorV, 0.12);
    this.vx = new NeonArrow(RENKLER.vektorX);
    this.vy = new NeonArrow(RENKLER.vektorY);
    this.group.add(this.v.group, this.vx.group, this.vy.group);

    // Bileşenleri tamamlayan noktalı çizgiler ve θ yayı
    this.guide = new DotLine(scene, { max: 400, size: 5, spacing: 0.6, color: 0xdddddd });
    this.arcMat = new THREE.MeshBasicMaterial({ color: RENKLER.vektorV, toneMapped: false, depthTest: false, transparent: true });
    this.arc = new THREE.Mesh(new THREE.BufferGeometry(), this.arcMat);
    this.arc.renderOrder = 10;
    this.arcTheta = null;
    this.group.add(this.arc);
    scene.add(this.group);
    this.anchors = {};
    this.hide();
  }

  // Nişan alırken namlu ucunda: V, Vx = V·cosθ, Vy = V·sinθ
  showAim(o, V, thetaDeg) {
    const t = (thetaDeg * Math.PI) / 180;
    this.show(o, V * Math.cos(t), V * Math.sin(t), true);
    const r = 3.2;
    if (this.arcTheta !== thetaDeg) {
      this.arcTheta = thetaDeg;
      this.arc.geometry.dispose();
      this.arc.geometry = new THREE.TorusGeometry(r, 0.07, 6, 40, Math.max(t, 0.001));
    }
    this.arc.position.set(o.x, o.y, Z);
    this.arc.visible = true;
    const mid = t / 2;
    this.anchors.theta = new THREE.Vector3(o.x + (r + 1.6) * Math.cos(mid), o.y + (r + 1.6) * Math.sin(mid) + 1, Z);
  }

  // Uçan mermide anlık hız vektörü
  showVelocity(p) {
    this.show(p, p.vx, p.vy, false);
    this.arc.visible = false;
    this.anchors.theta = null;
  }

  show(o, vx, vy, withGuide) {
    this.group.visible = true;
    this.v.set(o.x, o.y, vx, vy);
    this.vx.set(o.x, o.y, vx, 0);
    this.vy.set(o.x, o.y, 0, vy);
    const ex = o.x + vx * SCALE;
    const ey = o.y + vy * SCALE;
    this.guide.visible = withGuide;
    if (withGuide) {
      this.guide.setPaths([
        [{ x: ex, y: o.y }, { x: ex, y: ey }],
        [{ x: o.x, y: ey }, { x: ex, y: ey }],
      ], Z);
    }
    this.anchors.v = this.v.group.visible ? this.v.tip() : null;
    this.anchors.vx = this.vx.group.visible ? this.vx.tip() : null;
    this.anchors.vy = this.vy.group.visible ? this.vy.tip() : null;
  }

  hide() {
    this.group.visible = false;
    this.guide.visible = false;
    this.anchors = {};
  }
}
