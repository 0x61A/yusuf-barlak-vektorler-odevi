// Kamera: OrbitControls (zoom, serbest döndürme, kaydırma) + odak takibi + sarsıntı.
// Fare: tekerlek = zoom, sağ tık = döndür, orta tık = kaydır. Sol tık nişana ayrılmıştır.
// Dokunmatik: iki parmak = zoom + döndür. Tek parmak nişana ayrılmıştır.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEG = Math.PI / 180;
const ELEV = 10 * DEG;

export class CameraRig {
  constructor(camera, dom, { minDistance, maxDistance, defaultDistance }) {
    this.camera = camera;
    this.defaultDistance = defaultDistance;
    this.controls = new OrbitControls(camera, dom);
    const c = this.controls;
    c.enableDamping = true;
    c.dampingFactor = 0.09;
    c.minDistance = minDistance;
    c.maxDistance = maxDistance;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = Math.PI / 2 - 0.02;
    c.zoomSpeed = 1.1;
    c.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.ROTATE };
    c.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    c.screenSpacePanning = true;

    this.focus = new THREE.Vector3();
    this.panned = false;
    this.desiredDistance = null;
    this.shakeOffset = new THREE.Vector3();

    dom.addEventListener('pointerdown', (e) => {
      if (e.button === 1) this.panned = true;
    });
    c.addEventListener('start', () => {
      this.desiredDistance = null;
    });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  get distance() {
    return this.camera.position.distanceTo(this.controls.target);
  }

  setFocus(x, y) {
    if (!this.overview) this.focus.set(x, y, 0);
  }

  // Yatayda `width` metre sığdıran uzaklık (ekran oranına göre: PC ve telefonda aynı alan görünür)
  fitWidth(width) {
    return width / 2 / (Math.tan((this.camera.fov / 2) * DEG) * this.camera.aspect);
  }

  setVisibleWidth(width) {
    const c = this.controls;
    this.defaultDistance = Math.min(Math.max(this.fitWidth(width), c.minDistance * 2), 220);
  }

  // Genel bakış: alanı ortala ve sığdır, takip durur
  showArea(x, y, width) {
    this.overview = false;
    this.focus.set(x, y, 0);
    this.overview = true;
    this.panned = false;
    this.desiredDistance = Math.min(this.fitWidth(width), this.controls.maxDistance);
  }

  // Takibe dön
  follow() {
    this.overview = false;
    this.panned = false;
  }

  // Odağa yumuşak geçiş: hedef ve kamera birlikte kayar, açı korunur
  update(dt, shake = 0) {
    this.camera.position.sub(this.shakeOffset);
    if (!this.panned) {
      const k = 1 - Math.exp(-dt * 5);
      // Odak ekranın biraz altında kalsın: alt menü tankı örtmesin
      const goal = this.focus.clone();
      if (!this.overview) goal.y += this.distance * 0.07;
      const delta = goal.sub(this.controls.target).multiplyScalar(k);
      this.controls.target.add(delta);
      this.camera.position.add(delta);
    }
    if (this.desiredDistance !== null) {
      const d = this.distance;
      const next = d + (this.desiredDistance - d) * (1 - Math.exp(-dt * 3));
      this.setDistance(next);
      if (Math.abs(next - this.desiredDistance) < 0.5) this.desiredDistance = null;
    }
    this.controls.update(dt);
    this.shakeOffset.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, 0);
    this.camera.position.add(this.shakeOffset);
  }

  setDistance(d) {
    const c = this.controls;
    d = Math.min(Math.max(d, c.minDistance), c.maxDistance);
    const off = this.camera.position.clone().sub(c.target).setLength(d);
    this.camera.position.copy(c.target).add(off);
  }

  zoom(factor) {
    this.desiredDistance = null;
    this.setDistance(this.distance * factor);
  }

  // Uçuş sırasında mermiyi kadrajda tutmak için uzaklaş (gerekirse)
  ensureDistance(d) {
    const c = this.controls;
    d = Math.min(d, c.maxDistance);
    if (d > this.distance + 1 && (this.desiredDistance === null || d > this.desiredDistance)) this.desiredDistance = d;
  }

  restoreDistance(d) {
    this.desiredDistance = d;
  }

  reset(immediate = false) {
    this.overview = false;
    this.panned = false;
    this.desiredDistance = null;
    const t = this.controls.target;
    if (immediate) t.copy(this.focus);
    const d = this.defaultDistance;
    this.camera.position.set(t.x, t.y + d * Math.sin(ELEV), d * Math.cos(ELEV));
    this.controls.update();
  }
}
