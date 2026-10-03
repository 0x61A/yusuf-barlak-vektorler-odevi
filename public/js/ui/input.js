// Girdiler: klavye, fare/dokunmatik sürükleme (sapan), ekran butonları.

import * as THREE from 'three';

const KEYS = {
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  powerUp: ['KeyE'],
  powerDown: ['KeyQ'],
};

const has = (list, code) => list.includes(code);

export class Input {
  // h: { canControl(), move(dir), angleBy(d), powerBy(d), weapon(i), fire(), slowmo(), fast(),
  //      resetCam(), map(), pause(), zoom(f), aimDrag({theta, power01}), aimEnd() }
  constructor(canvas, camera, h) {
    this.canvas = canvas;
    this.camera = camera;
    this.h = h;
    this.held = { left: false, right: false, btnLeft: false, btnRight: false };
    this.drag = null;
    this.pointers = new Set();
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.releaseAll());

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));

    this.holdButton(document.getElementById('btn-sol'), 'btnLeft');
    this.holdButton(document.getElementById('btn-sag'), 'btnRight');
  }

  holdButton(el, key) {
    const set = (v) => {
      this.held[key] = v;
      el.dataset.basili = String(v);
      this.emitMove();
    };
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      set(true);
    });
    el.addEventListener('pointerup', () => set(false));
    el.addEventListener('pointercancel', () => set(false));
    el.addEventListener('lostpointercapture', () => set(false));
    // Klavyeyle (Enter/Space) basılı tutma
    el.addEventListener('keydown', (e) => {
      if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
        e.preventDefault();
        set(true);
      }
    });
    el.addEventListener('keyup', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') set(false);
    });
  }

  emitMove() {
    const l = this.held.left || this.held.btnLeft;
    const r = this.held.right || this.held.btnRight;
    this.h.move((r ? 1 : 0) - (l ? 1 : 0));
  }

  releaseAll() {
    for (const k of Object.keys(this.held)) this.held[k] = false;
    this.emitMove();
  }

  onKey(e, down) {
    const tag = e.target.tagName;
    const inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    const code = e.code;
    // Açık bir popup varken oyun tuşları çalışmaz (Esc popup'ı kendisi kapatır)
    if (down && document.querySelector('dialog[open]')) return;
    if (has(KEYS.left, code) || has(KEYS.right, code)) {
      if (inField && (e.target.type === 'range' || e.target.type === 'number') && code.startsWith('Arrow')) return;
      if (inField && !code.startsWith('Key')) return;
      this.held[has(KEYS.left, code) ? 'left' : 'right'] = down;
      this.emitMove();
      e.preventDefault();
      return;
    }
    if (!down || inField) return;
    if (e.target.tagName === 'BUTTON' && (code === 'Space' || code === 'Enter')) return;
    const fine = e.shiftKey ? 0.1 : 1;
    if (has(KEYS.up, code)) this.h.angleBy(fine);
    else if (has(KEYS.down, code)) this.h.angleBy(-fine);
    else if (has(KEYS.powerUp, code)) this.h.powerBy(fine);
    else if (has(KEYS.powerDown, code)) this.h.powerBy(-fine);
    else if (/^Digit[1-5]$/.test(code)) this.h.weapon(Number(code.slice(5)) - 1);
    else if (code === 'Space') {
      if (!e.repeat) this.h.fire();
    } else if (code === 'KeyT') this.h.slowmo();
    else if (code === 'KeyF') this.h.fast();
    else if (code === 'KeyR') this.h.resetCam();
    else if (code === 'KeyM') this.h.map();
    else if (code === 'Escape') this.h.pause();
    else if (code === 'Equal' || code === 'NumpadAdd') this.h.zoom(0.85);
    else if (code === 'Minus' || code === 'NumpadSubtract') this.h.zoom(1.18);
    else return;
    e.preventDefault();
  }

  worldPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    return this.raycaster.ray.intersectPlane(this.plane, p) ? p : null;
  }

  onDown(e) {
    this.pointers.add(e.pointerId);
    // İkinci parmak = kamera hareketi, nişanı iptal et
    if (this.pointers.size > 1) {
      if (this.drag) this.h.aimEnd(true);
      this.drag = null;
      return;
    }
    if (e.button !== 0 || !this.h.canControl()) return;
    const w = this.worldPoint(e);
    if (!w) return;
    this.drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, w, moved: false };
  }

  onMove(e) {
    const d = this.drag;
    if (!d || d.id !== e.pointerId) return;
    const px = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (px < 10 && !d.moved) return;
    d.moved = true;
    const w = this.worldPoint(e);
    if (!w) return;
    // Sapan: geriye çekilen yönün tersine atış
    const dx = d.w.x - w.x;
    const dy = d.w.y - w.y;
    let theta = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (theta < 0) theta = dx >= 0 ? 0 : 180;
    const r = this.canvas.getBoundingClientRect();
    const power01 = Math.min(1, px / (0.33 * Math.min(r.width, r.height)));
    this.h.aimDrag({ theta, power01 });
  }

  onUp(e, cancel = false) {
    this.pointers.delete(e.pointerId);
    if (this.drag && this.drag.id === e.pointerId) {
      if (this.drag.moved) this.h.aimEnd(cancel);
      this.drag = null;
    }
  }
}
