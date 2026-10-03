// fizik.html (Yusuf Barlak Vektörler Ödevi): KaTeX formülleri, etkileşimli vektör ve yörünge çizimleri, tablolar, künye.

import { KUNYE, GEZEGENLER, SILAHLAR } from '../config.js';

const $ = (id) => document.getElementById(id);
const DEG = Math.PI / 180;
const C = { v: '#f08c00', x: '#1c7ed6', y: '#e03131', grid: '#e9edf2', axis: '#8792a2', text: '#4a5563' };

// ---------- Formüller ----------
window.renderMathInElement?.(document.body, {
  delimiters: [
    { left: '$$', right: '$$', display: true },
    { left: '\\(', right: '\\)', display: false },
  ],
  throwOnError: false,
});

// ---------- Canvas yardımcıları ----------
function setup(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = Number(canvas.getAttribute('height'));
  canvas.style.height = `${h}px`;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

function arrow(ctx, x0, y0, x1, y1, color, width = 3) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  const head = Math.min(12, len * 0.4);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * head * 0.8, y1 - Math.sin(a) * head * 0.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - Math.cos(a - 0.4) * head, y1 - Math.sin(a - 0.4) * head);
  ctx.lineTo(x1 - Math.cos(a + 0.4) * head, y1 - Math.sin(a + 0.4) * head);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function label(ctx, text, x, y, color, align = 'left') {
  ctx.font = '600 14px "JetBrains Mono", monospace';
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

// ---------- 1) Vektör bileşenleri ----------
const vd = { canvas: $('vektor-demo'), aci: $('vd-aci'), hiz: $('vd-hiz') };

function drawVector() {
  const { ctx, w, h } = setup(vd.canvas);
  const theta = Number(vd.aci.value);
  const V = Number(vd.hiz.value);
  $('vd-aci-o').textContent = `${theta}°`;
  $('vd-hiz-o').textContent = `${V} m/s`;
  const vx = V * Math.cos(theta * DEG);
  const vy = V * Math.sin(theta * DEG);

  const ox = w / 2;
  const oy = h - 40;
  const k = Math.min((w / 2 - 40) / 55, (h - 70) / 55);

  // ızgara ve eksenler
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let x = ox % 40; x < w; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = oy % 40; y < h; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.strokeStyle = C.axis;
  ctx.beginPath();
  ctx.moveTo(12, oy);
  ctx.lineTo(w - 12, oy);
  ctx.moveTo(ox, h - 10);
  ctx.lineTo(ox, 10);
  ctx.stroke();
  label(ctx, '+x', w - 30, oy - 12, C.text);
  label(ctx, '+y', ox + 10, 18, C.text);

  const ex = ox + vx * k;
  const ey = oy - vy * k;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#a3adb9';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ex, oy);
  ctx.lineTo(ex, ey);
  ctx.moveTo(ox, ey);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.setLineDash([]);

  // θ yayı
  ctx.strokeStyle = C.v;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(ox, oy, 34, 0, -theta * DEG, true);
  ctx.stroke();
  label(ctx, 'θ', ox + 44 * Math.cos((theta / 2) * DEG), oy - 44 * Math.sin((theta / 2) * DEG), C.v, 'center');

  arrow(ctx, ox, oy, ex, oy, C.x);
  arrow(ctx, ox, oy, ox, ey, C.y);
  arrow(ctx, ox, oy, ex, ey, C.v, 4);
  label(ctx, `Vx = ${vx.toFixed(1)}`, ex, oy + 18, C.x, 'center');
  label(ctx, `Vy = ${vy.toFixed(1)}`, ox + (vx >= 0 ? -10 : 10), ey, C.y, vx >= 0 ? 'right' : 'left');
  label(ctx, `V = ${V}`, ex + (vx >= 0 ? 10 : -10), ey - 12, C.v, vx >= 0 ? 'left' : 'right');

  $('vd-sonuc').textContent =
    `Vx = V·cosθ = ${V}·${Math.cos(theta * DEG).toFixed(3)} = ${vx.toFixed(2)} m/s   ·   ` +
    `Vy = V·sinθ = ${V}·${Math.sin(theta * DEG).toFixed(3)} = ${vy.toFixed(2)} m/s`;
}

// ---------- 2) Yörünge ----------
const yd = { canvas: $('yorunge-demo'), aci: $('yd-aci'), hiz: $('yd-hiz'), g: $('yd-g'), tumler: $('yd-tumler'), vek: $('yd-vektor') };
yd.g.innerHTML = GEZEGENLER.map((p) => `<option value="${p.g}">${p.ad} (${p.g})</option>`).join('');

function shot(theta, V, g) {
  const vx = V * Math.cos(theta * DEG);
  const vy = V * Math.sin(theta * DEG);
  const T = (2 * vy) / g;
  return { theta, vx, vy, T, R: vx * T, H: (vy * vy) / (2 * g), g };
}

function drawTrajectory() {
  const { ctx, w, h } = setup(yd.canvas);
  const theta = Number(yd.aci.value);
  const V = Number(yd.hiz.value);
  const g = Number(yd.g.value);
  $('yd-aci-o').textContent = `${theta}°`;
  $('yd-hiz-o').textContent = `${V} m/s`;

  const shots = [shot(theta, V, g)];
  if (yd.tumler.checked && theta !== 45) shots.push(shot(90 - theta, V, g));
  const maxR = Math.max(...shots.map((s) => s.R), 1);
  const maxH = Math.max(...shots.map((s) => s.H), 1);
  const pad = { l: 48, r: 20, t: 22, b: 34 };
  const k = Math.min((w - pad.l - pad.r) / maxR, (h - pad.t - pad.b) / maxH);
  const X = (x) => pad.l + x * k;
  const Y = (y) => h - pad.b - y * k;

  // eksen ve ölçek
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((s) => s * k > 50) ?? 1000;
  ctx.font = '11px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  for (let x = 0; x <= maxR * 1.05; x += step) {
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(X(x), pad.t);
    ctx.lineTo(X(x), Y(0));
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'center';
    ctx.fillText(`${x}`, X(x), Y(0) + 6);
  }
  ctx.textBaseline = 'middle';
  for (let y = step; y <= maxH * 1.05; y += step) {
    ctx.strokeStyle = C.grid;
    ctx.beginPath();
    ctx.moveTo(pad.l, Y(y));
    ctx.lineTo(w - pad.r, Y(y));
    ctx.stroke();
    ctx.fillStyle = C.text;
    ctx.textAlign = 'right';
    ctx.fillText(`${y}`, pad.l - 6, Y(y));
  }
  ctx.strokeStyle = C.axis;
  ctx.beginPath();
  ctx.moveTo(pad.l, Y(0));
  ctx.lineTo(w - pad.r, Y(0));
  ctx.stroke();
  ctx.fillStyle = C.text;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText('x (m)', w - pad.r, Y(0) - 4);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('y (m)', pad.l + 4, 4);

  shots.forEach((s, i) => {
    const color = i === 0 ? '#2f80ed' : '#e8590c';
    // parabol: y(x) = x·tanθ − g·x² / (2V²cos²θ)
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    if (i > 0) ctx.setLineDash([8, 6]);
    ctx.beginPath();
    for (let j = 0; j <= 120; j++) {
      const t = (s.T * j) / 120;
      const px = X(s.vx * t);
      const py = Y(s.vy * t - 0.5 * s.g * t * t);
      if (j === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // tepe noktası
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(X(s.R / 2), Y(s.H), 4, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `${s.theta}°`, X(s.R / 2), Y(s.H) - 14, color, 'center');

    // hız vektörleri: vx sabit, vy azalıyor
    if (yd.vek.checked && i === 0) {
      const sc = (0.18 * Math.min(w, h)) / V;
      for (let j = 0; j <= 4; j++) {
        const t = (s.T * j) / 4;
        const px = X(s.vx * t);
        const py = Y(s.vy * t - 0.5 * s.g * t * t);
        const vy = s.vy - s.g * t;
        arrow(ctx, px, py, px + s.vx * sc, py, C.x, 2);
        arrow(ctx, px, py, px, py - vy * sc, C.y, 2);
      }
    }
  });
  ctx.fillStyle = '#2b8a3e';
  ctx.beginPath();
  ctx.arc(X(shots[0].R), Y(0), 5, 0, Math.PI * 2);
  ctx.fill();

  const s = shots[0];
  let text =
    `T = 2V·sinθ/g = ${s.T.toFixed(2)} s   ·   h_max = V²sin²θ/2g = ${s.H.toFixed(1)} m   ·   R = V²·sin2θ/g = ${s.R.toFixed(1)} m`;
  if (shots[1]) text += `   ·   ${shots[1].theta}° için R = ${shots[1].R.toFixed(1)} m (aynı)`;
  $('yd-sonuc').textContent = text;
}

// ---------- Tablolar ----------
$('gezegen-tablo').innerHTML = GEZEGENLER.map((p) => {
  const s = shot(45, 40, p.g);
  return `<tr><td>${p.ad}</td><td>${p.g}</td><td>${s.R.toFixed(1)}</td><td>${s.H.toFixed(1)}</td><td>${s.T.toFixed(2)}</td></tr>`;
}).join('');

const KAVRAM = {
  standart: 'Eğik atış',
  agir: 'a = g, kütleden bağımsız',
  uclu: 'Açının menzile etkisi',
  sekme: `Restitüsyon, e = ${SILAHLAR[3].e}`,
  parcali: 'Momentum korunumu',
};
$('silah-tablo').innerHTML = SILAHLAR.map(
  (w) => `<tr><td>${w.ad}</td><td>${w.kutle}</td><td>${w.yaricap}</td><td>${w.hasar}</td><td>${KAVRAM[w.id]}</td></tr>`,
).join('');

$('kunye-liste').innerHTML = [
  ['Hazırlayan', KUNYE.ad],
  ['Üniversite', KUNYE.okul],
  ['Bölüm', KUNYE.bolum],
  ['Ders', KUNYE.ders],
].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

// ---------- İçindekiler: görünen bölümü işaretle ----------
const links = [...document.querySelectorAll('.icindekiler a')];
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      for (const a of links) a.setAttribute('aria-current', String(a.hash === `#${e.target.id}`));
    }
  },
  { rootMargin: '-30% 0px -60% 0px' },
);
document.querySelectorAll('.makale section[id]').forEach((s) => io.observe(s));

// ---------- Bağlantılar ----------
for (const el of [vd.aci, vd.hiz]) el.addEventListener('input', drawVector);
for (const el of [yd.aci, yd.hiz, yd.g, yd.tumler, yd.vek]) el.addEventListener('input', drawTrajectory);
addEventListener('resize', () => {
  drawVector();
  drawTrajectory();
});
document.fonts.ready.then(() => {
  drawVector();
  drawTrajectory();
});
drawVector();
drawTrajectory();
