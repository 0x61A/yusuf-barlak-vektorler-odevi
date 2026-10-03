// HUD: can kartları, sıra bandı ve popup'ı, silahlar, nişan kontrolleri, sahne etiketleri, analiz, oyun sonu.

import * as THREE from 'three';
import { SILAHLAR } from '../config.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const $ = (id) => document.getElementById(id);

const ICONS = {
  standart: '<circle cx="11" cy="8" r="4"/>',
  agir: '<circle cx="11" cy="8" r="6"/><circle cx="11" cy="8" r="2"/>',
  uclu: '<circle cx="4" cy="11" r="2.4"/><circle cx="11" cy="5" r="2.4"/><circle cx="18" cy="11" r="2.4"/>',
  sekme: '<path d="M1 3l5 10 5-8 5 8 5-10"/>',
  parcali: '<circle cx="11" cy="8" r="1.8"/><path d="M11 1v3M11 12v3M3 8h3M16 8h3M5 2.5l2.5 2.5M15 11l2.5 2.5M5 13.5 7.5 11M15 5l2.5-2.5"/>',
};

const STAR = (on) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="${on ? '#ffc61a' : '#e3e6ea'}" stroke="${on ? '#d99a00' : '#c3c9d1'}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;

// Ok uçlarına göre etiket yerleşimi: çakışmasın diye her biri farklı yöne
const ALIGN = {
  v: '8px, -100%',
  vx: '-50%, 8px',
  vy: 'calc(-100% - 8px), -50%',
  theta: '-50%, -50%',
};

const level = (hp) => (hp > 50 ? 'iyi' : hp > 25 ? 'orta' : 'dusuk');

export class Hud {
  constructor({ camera, h }) {
    this.camera = camera;
    this.h = h;
    this.labelsEl = $('etiketler');
    this.tags = new Map();
    this.vecEls = {};
    this.analysisTimer = null;
    this.buildWeapons();
    this.bindAim();
  }

  // ---------- Can kartları ----------
  buildHealth(tanks) {
    const box = $('can-kartlari');
    box.innerHTML = '';
    this.cards = new Map();
    for (const t of tanks) {
      const el = document.createElement('div');
      el.className = 'can-kart';
      el.style.setProperty('--c', hex(t.color));
      el.innerHTML = `<span class="rozet" aria-hidden="true"></span><span class="ad">${t.name}</span><span class="sayi">${t.hp}</span>
        <div class="bar" role="meter" aria-label="${t.name} canı" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${t.hp}"><b></b><i></i></div>`;
      box.append(el);
      this.cards.set(t, el);

      const tag = document.createElement('div');
      tag.className = 'tank-etiket';
      tag.style.setProperty('--c', hex(t.color));
      tag.innerHTML = `<span>${t.name}</span><span class="mini"><i></i></span>`;
      this.labelsEl.append(tag);
      this.tags.set(t, tag);
    }
  }

  updateHealth(activeTank) {
    for (const [t, el] of this.cards) {
      const k = t.hp / 100;
      const bar = el.querySelector('.bar');
      el.querySelector('.sayi').textContent = t.hp;
      bar.querySelector('i').style.transform = `scaleX(${k})`;
      bar.querySelector('b').style.transform = `scaleX(${k})`;
      bar.dataset.seviye = level(t.hp);
      bar.setAttribute('aria-valuenow', t.hp);
      el.dataset.sira = String(t === activeTank);
      el.dataset.olu = String(!t.alive);
      this.tags.get(t).querySelector('.mini i').style.transform = `scaleX(${k})`;
    }
  }

  setBanner(text, color) {
    const b = $('sira-bandi');
    b.textContent = text;
    b.style.setProperty('--c', hex(color));
  }

  // Sıra değişince ortada kısa süre beliren yazı
  turnPopup(title, sub, color) {
    const el = $('sira-popup');
    el.innerHTML = `<strong>${title}</strong><span>${sub}</span>`;
    el.style.setProperty('--c', hex(color));
    el.classList.remove('goster');
    void el.offsetWidth;
    el.classList.add('goster');
  }

  setControls(enabled) {
    document.body.dataset.kontrol = enabled ? 'acik' : 'kapali';
  }

  // ---------- Silahlar ----------
  buildWeapons() {
    const box = $('silahlar');
    this.weaponEls = SILAHLAR.map((w, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'silah';
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.style.setProperty('--c', hex(w.renk));
      b.innerHTML = `<span class="tus">${i + 1}</span>
        <span class="simge"><svg viewBox="0 0 22 16" aria-hidden="true">${ICONS[w.id]}</svg></span>
        <span class="ad">${w.ad}</span><span class="adet">∞</span>`;
      b.addEventListener('click', () => this.h.weapon(i));
      box.append(b);
      return b;
    });
    box.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      e.stopPropagation();
      const i = this.weaponEls.indexOf(document.activeElement);
      const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + SILAHLAR.length) % SILAHLAR.length;
      this.weaponEls[next].focus();
      this.h.weapon(next);
    });
  }

  setWeapon(index, tank) {
    this.weaponEls.forEach((el, i) => {
      const w = SILAHLAR[i];
      const n = tank.ammo[w.id];
      el.setAttribute('aria-checked', String(i === index));
      el.tabIndex = i === index ? 0 : -1;
      el.setAttribute('aria-disabled', String(n <= 0));
      el.querySelector('.adet').textContent = n === Infinity ? '∞' : n;
      el.setAttribute('aria-label', `${w.ad} mermi, ${n === Infinity ? 'sınırsız' : `${n} adet`}`);
    });
  }

  // ---------- Nişan kontrolleri ----------
  bindAim() {
    const pairs = [
      [$('aci'), $('aci-sayi'), (v) => this.h.angle(v)],
      [$('guc'), $('guc-sayi'), (v) => this.h.power(v)],
    ];
    for (const [range, num, fn] of pairs) {
      range.addEventListener('input', () => fn(Number(range.value)));
      num.addEventListener('change', () => {
        const v = Number(num.value);
        if (Number.isFinite(v)) fn(v);
      });
    }
    $('btn-ates').addEventListener('click', () => this.h.fire());
  }

  setPowerRange(min, max) {
    for (const el of [$('guc'), $('guc-sayi')]) {
      el.min = min;
      el.max = max;
    }
  }

  setAim(theta, V) {
    const a = theta.toFixed(1);
    const v = V.toFixed(1);
    if ($('aci').value !== a) $('aci').value = a;
    if (document.activeElement !== $('aci-sayi')) $('aci-sayi').value = a;
    if ($('guc').value !== v) $('guc').value = v;
    if (document.activeElement !== $('guc-sayi')) $('guc-sayi').value = v;
  }

  // crushing: tank bir engeli itiyor (yakıt hızlı azalır)
  setFuel(fuel, unlimited, crushing = false) {
    const box = $('yakit-kutu');
    box.hidden = unlimited;
    box.dataset.itiyor = String(crushing);
    $('yakit-dolu').style.transform = `scaleX(${fuel / 100})`;
    $('yakit-deger').textContent = Math.round(fuel);
    box.querySelector('.bar').setAttribute('aria-valuenow', Math.round(fuel));
  }

  // ---------- Sahne üstü etiketler ----------
  project(v) {
    const p = v.clone().project(this.camera);
    if (p.z > 1 || p.z < -1) return null;
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight };
  }

  // align: etiketin noktaya göre kayması (CSS translate)
  place(el, v, align = '-50%, -100%') {
    const s = v && this.project(v);
    if (!s) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    el.style.transform = `translate(${s.x}px, ${s.y}px) translate(${align})`;
  }

  updateLabels(tanks, anchors, info) {
    for (const t of tanks) {
      const tag = this.tags.get(t);
      if (!t.alive) {
        tag.style.display = 'none';
        continue;
      }
      this.place(tag, new THREE.Vector3(t.x, t.y - 0.6, 8), '-50%, 8px');
    }
    const texts = {
      v: info ? `V ${info.V.toFixed(1)}` : 'v',
      vx: info ? `Vx ${info.vx.toFixed(1)}` : 'vx',
      vy: info ? `Vy ${info.vy.toFixed(1)}` : 'vy',
      theta: info ? `θ ${info.theta.toFixed(1)}°` : '',
    };
    for (const key of ['v', 'vx', 'vy', 'theta']) {
      let el = this.vecEls[key];
      if (!el) {
        el = this.vecEls[key] = document.createElement('span');
        el.className = `vek-etiket ${key === 'theta' ? 't' : key}`;
        this.labelsEl.append(el);
      }
      if (el.textContent !== texts[key]) el.textContent = texts[key];
      this.place(el, anchors[key], ALIGN[key]);
    }
  }

  popup(x, y, text, cls = '') {
    const s = this.project(new THREE.Vector3(x, y, 0));
    if (!s) return;
    const el = document.createElement('div');
    el.className = `hasar ${cls}`;
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    this.labelsEl.append(el);
    setTimeout(() => el.remove(), 1500);
  }

  // ---------- Atış analizi ----------
  showAnalysis(a) {
    const el = $('analiz');
    el.innerHTML = `<h3>Atış analizi · ${a.weapon}</h3>
      <dl>
        <div><dt>Δx</dt><dd>${a.dx.toFixed(1)} m</dd></div>
        <div><dt>h<sub>max</sub></dt><dd>${a.hmax.toFixed(1)} m</dd></div>
        <div><dt>Uçuş süresi</dt><dd>${a.t.toFixed(2)} s</dd></div>
        <div><dt>Çarpma hızı</dt><dd>${a.speed.toFixed(1)} m/s</dd></div>
        <div><dt>Çarpma açısı</dt><dd>${a.angle.toFixed(1)}°</dd></div>
        <div><dt>Euler adımı</dt><dd>${a.steps}</dd></div>
      </dl>`;
    el.hidden = false;
    el.onclick = () => (el.hidden = true);
    clearTimeout(this.analysisTimer);
    this.analysisTimer = setTimeout(() => (el.hidden = true), 4500);
  }

  hideAnalysis() {
    $('analiz').hidden = true;
  }

  // ---------- Oyun sonu ----------
  gameOver(won, stars, rows) {
    const h = $('sonuc-baslik');
    h.textContent = won === null ? 'Berabere' : won ? 'Kazandın!' : 'Kaybettin';
    h.className = won ? 'kazandi' : 'kaybetti';
    const box = $('sonuc-yildiz');
    box.innerHTML = [0, 1, 2].map((i) => STAR(i < stars)).join('');
    box.setAttribute('aria-label', `${stars} yıldız`);
    $('sonuc-istatistik').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('oyun-sonu').hidden = false;
    $('btn-tekrar').focus();
  }
}
