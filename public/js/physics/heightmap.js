// Arazi: x'e bağlı tek boyutlu yükseklik dizisi h(x).

import { rng } from './vec2.js';
import { KRATER } from '../config.js';

export const TABAN = -30; // kraterin inebileceği en alt seviye

export class Heightmap {
  constructor(width, step) {
    this.width = width;
    this.step = step;
    this.n = Math.round(width / step) + 1;
    this.h = new Float32Array(this.n);
  }

  xAt(i) {
    return i * this.step;
  }

  // Doğrusal ara değerleme
  heightAt(x) {
    const f = Math.min(Math.max(x / this.step, 0), this.n - 1);
    const i = Math.min(Math.floor(f), this.n - 2);
    const t = f - i;
    return this.h[i] * (1 - t) + this.h[i + 1] * t;
  }

  // Eğim h'(x), merkezi fark ile
  slopeAt(x, span = 0.5) {
    return (this.heightAt(x + span) - this.heightAt(x - span)) / (2 * span);
  }

  // Yüzey normali n̂ = (−h', 1) / |(−h', 1)|
  normalAt(x) {
    const s = this.slopeAt(x);
    const l = Math.hypot(s, 1);
    return { x: -s / l, y: 1 / l };
  }

  // (cx, cy) merkezli patlama. Krater dik duvarlı daire değil, kosinüs profilli
  // yayvan bir çanaktır: yatayda KRATER.genislik·r, dikeyde KRATER.derinlik·r.
  // En dik yeri ~42°: tank zorlansa da tırmanabilir. Her sütundan bu "mercek"
  // kadar toprak çıkarılır, üstteki toprak aşağı oturur (heightmap çıkıntı tutamaz).
  // Değişen indis aralığını döndürür.
  carve(cx, cy, r) {
    const R = r * KRATER.genislik;
    const depth = r * KRATER.derinlik;
    const i0 = Math.max(0, Math.floor((cx - R) / this.step));
    const i1 = Math.min(this.n - 1, Math.ceil((cx + R) / this.step));
    let changed = false;
    for (let i = i0; i <= i1; i++) {
      const dx = this.xAt(i) - cx;
      if (Math.abs(dx) >= R) continue;
      const s = (depth * (1 + Math.cos((Math.PI * dx) / R))) / 2;
      const removed = Math.min(this.h[i], cy + s) - (cy - s);
      if (removed > 0) {
        this.h[i] = Math.max(TABAN, this.h[i] - removed);
        changed = true;
      }
    }
    if (!changed) return null;
    return this.smooth(i0 - 2, i1 + 2);
  }

  // Kenarlardaki kırıkları yumuşat (3 noktalı ortalama, 2 geçiş)
  smooth(i0, i1) {
    i0 = Math.max(1, i0);
    i1 = Math.min(this.n - 2, i1);
    for (let pass = 0; pass < 2; pass++) {
      let prev = this.h[i0 - 1];
      for (let i = i0; i <= i1; i++) {
        const cur = this.h[i];
        this.h[i] = (prev + 2 * cur + this.h[i + 1]) / 4;
        prev = cur;
      }
    }
    return [i0 - 1, i1 + 1];
  }

  static flat(width, step, height = 0) {
    const hm = new Heightmap(width, step);
    hm.h.fill(height);
    return hm;
  }

  // Sinüs dalgalarının toplamı: h(x) = taban + Σ Aₖ·sin(2πx/λₖ + φₖ)
  // Harita oynanan alanın iki yanına doğal biçimde devam eder (duvar yok).
  // spawns: tankların doğacağı x'ler, oralar düzleştirilir.
  static generate(width, step, seed, spawns = []) {
    const hm = new Heightmap(width, step);
    const r = rng(seed);
    const waves = [
      { A: 6 + r() * 4, L: 150 + r() * 80, p: r() * Math.PI * 2 },
      { A: 2.5 + r() * 3, L: 60 + r() * 35, p: r() * Math.PI * 2 },
      { A: 0.5 + r() * 0.6, L: 26 + r() * 10, p: r() * Math.PI * 2 },
    ];
    const base = 14;
    for (let i = 0; i < hm.n; i++) {
      const x = hm.xAt(i);
      let y = base;
      for (const w of waves) y += w.A * Math.sin((2 * Math.PI * x) / w.L + w.p);
      hm.h[i] = y;
    }
    // Doğma noktalarını düzleştir (yumuşak geçişle)
    for (const sx of spawns) {
      const flatY = hm.heightAt(sx);
      const half = 5;
      const blend = 7;
      for (let i = 0; i < hm.n; i++) {
        const d = Math.abs(hm.xAt(i) - sx);
        if (d > half + blend) continue;
        const k = d <= half ? 1 : 1 - (d - half) / blend;
        hm.h[i] = hm.h[i] * (1 - k) + flatY * k;
      }
    }
    return hm;
  }
}
