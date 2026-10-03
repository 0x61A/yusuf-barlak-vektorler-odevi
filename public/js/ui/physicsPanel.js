// Canlı fizik paneli: nişan değerleri, düz zemin tahminleri, uçuş sırasında Euler değerleri.

import { DT } from '../config.js';
import { DEG } from '../physics/vec2.js';

const f1 = (v) => (Number.isFinite(v) ? v.toFixed(1) : '—');
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '—');

const row = (cls, formula, value) =>
  `<div class="fz-satir ${cls}"><span class="f">${formula}</span><span class="d">${value}</span></div>`;

export class PhysicsPanel {
  constructor(el) {
    this.el = el;
    this.lastKey = '';
    this.note = '';
  }

  setNote(html) {
    this.note = html;
    this.lastKey = '';
  }

  // Nişan modu: V, θ → Vx, Vy ve düz zemin varsayımıyla t, h_max, R
  aim({ V, theta, g, weapon, h0, flat }) {
    const key = `a${V.toFixed(1)}|${theta.toFixed(1)}|${g}|${weapon.id}|${this.note}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const c = Math.cos(theta * DEG);
    const s = Math.sin(theta * DEG);
    const vx = V * c;
    const vy = V * s;
    const tUcus = (2 * vy) / g;
    const hMax = (vy * vy) / (2 * g);
    const R = (V * V * Math.sin(2 * theta * DEG)) / g;
    this.el.innerHTML = `
      <div class="fz-bolum">
        <p class="fz-baslik">Başlangıç hız vektörü</p>
        ${row('v', '<b>V</b>', `${f1(V)} m/s`)}
        ${row('', 'θ', `${f1(theta)}°`)}
        ${row('vx', `<b>Vx</b> = V·cosθ = ${f1(V)}·${f3(c)}`, `${f2(vx)} m/s`)}
        ${row('vy', `<b>Vy</b> = V·sinθ = ${f1(V)}·${f3(s)}`, `${f2(vy)} m/s`)}
        ${row('', '|V| = √(Vx² + Vy²)', `${f1(Math.hypot(vx, vy))} m/s`)}
      </div>
      <div class="fz-bolum">
        <p class="fz-baslik">Sabitler</p>
        ${row('', 'g', `${g.toFixed(2)} m/s²`)}
        ${row('', 'Δt (Euler adımı)', `1/${Math.round(1 / DT)} s`)}
        ${row('', `m (${weapon.ad})`, `${weapon.kutle} kg`)}
        ${row('', 'p = m·V', `${f1(weapon.kutle * V)} kg·m/s`)}
      </div>
      <div class="fz-bolum">
        <p class="fz-baslik">Düz zemin tahmini</p>
        ${row('', 't = 2·Vy / g', vy > 0 ? `${f2(tUcus)} s` : '—')}
        ${row('', 'h<sub>max</sub> = Vy² / 2g', vy > 0 ? `${f1(hMax)} m` : '—')}
        ${row('', 'R = V²·sin2θ / g', vy > 0 ? `${f1(R)} m` : '—')}
        ${h0 > 0.5 ? `<p class="fz-not">${flat
          ? `Namlu yerden ≈${f1(h0)} m yukarıda: ölçülen Δx, formüldeki R'den biraz büyük çıkar.`
          : `Namlu yerden ≈${f1(h0)} m yukarıda ve arazi engebeli: gerçek yol Euler ile hesaplanır, kesikli çizgi onu gösterir.`}</p>` : ''}
      </div>
      ${this.weaponNote(weapon)}
      ${this.note ? `<div class="fz-bolum"><p class="fz-not">${this.note}</p></div>` : ''}`;
  }

  weaponNote(w) {
    const notes = {
      agir: 'Ağır mermi 3 kat kütleli ama ivme a = g kütleden bağımsız: yol aynı (Galileo). Fark yalnızca patlamada.',
      uclu: `Üç mermi θ−${w.aciFarki}°, θ, θ+${w.aciFarki}° açılarıyla çıkar: açının menzile etkisi aynı anda görülür.`,
      sekme: `Yere çarpınca v′ = v − (1+e)(v·n̂)n̂ ile yansır, e = ${w.e}. ${w.sekmeSayisi} sekmeden sonra patlar.`,
      parcali: `Tepe noktasında (Vy = 0) ${w.parca} parçaya ayrılır. Σ mᵢ·vᵢ = m·v: momentum korunur.`,
    };
    return notes[w.id] ? `<div class="fz-bolum"><p class="fz-baslik">${w.ad}</p><p class="fz-not">${notes[w.id]}</p></div>` : '';
  }

  // Uçuş modu: Euler ile anlık değerler
  flight(p, g, extra = '') {
    const key = `f${p.t.toFixed(2)}|${this.note}|${extra}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const speed = Math.hypot(p.vx, p.vy);
    this.el.innerHTML = `
      <div class="fz-bolum">
        <p class="fz-baslik">Uçuş · ileri Euler</p>
        ${row('', 't', `${f2(p.t)} s`)}
        ${row('', 'x − x₀', `${f1(p.x - p.x0)} m`)}
        ${row('', 'y − y₀', `${f1(p.y - p.y0)} m`)}
        ${row('vx', '<b>vx</b>  (aₓ = 0)', `${f2(p.vx)} m/s`)}
        ${row('vy', '<b>vy</b>  (a<sub>y</sub> = −g)', `${f2(p.vy)} m/s`)}
        ${row('v', '<b>|v|</b>', `${f2(speed)} m/s`)}
        ${row('', 'K = ½·m·v²', `${f1(0.5 * p.m * speed * speed)} J`)}
      </div>
      <div class="fz-bolum">
        <p class="fz-baslik">Her adımda (Δt = 1/${Math.round(1 / DT)} s)</p>
        ${row('', 'x ← x + vx·Δt', '')}
        ${row('', 'y ← y + vy·Δt', '')}
        ${row('', 'vy ← vy − g·Δt', `g = ${g.toFixed(2)}`)}
      </div>
      ${extra ? `<div class="fz-bolum"><p class="fz-not">${extra}</p></div>` : ''}`;
  }

  clear(text = '') {
    this.lastKey = '';
    this.el.innerHTML = text ? `<p class="fz-not">${text}</p>` : '';
  }
}
