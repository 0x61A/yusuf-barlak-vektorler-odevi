// NPC nişan çözücüsü.
// 1) Analitik başlangıç: düz atış denkleminden iki açı (alçak ve yüksek yay)
//    tanθ = [V² ± √(V⁴ − g(g·x² + 2y·V²))] / (g·x)
// 2) Her adayı oyunun Euler simülasyonuyla dene (arazi engelini görür),
//    en iyisini koordinat inişiyle (coordinate descent) iyileştir.

import { DEG } from './vec2.js';
import { launch, simulate } from './projectile.js';

export function analyticAngles(dx, dy, V, g) {
  const x = Math.abs(dx);
  if (x < 1e-6) return [];
  const V2 = V * V;
  const disc = V2 * V2 - g * (g * x * x + 2 * dy * V2);
  if (disc < 0) return []; // menzil dışı
  const r = Math.sqrt(disc);
  const angles = [Math.atan((V2 - r) / (g * x)), Math.atan((V2 + r) / (g * x))].map((a) => a / DEG);
  return dx >= 0 ? angles : angles.map((a) => 180 - a);
}

const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

// Iska ölçüsü (m): hedef tanka isabet = 0, dost tanka isabet = büyük ceza
export function evaluateShot({ world, g, dt, tMax, muzzleAt, weapon, owner, target, avoid = [] }, theta, V) {
  const [p] = launch(weapon, muzzleAt(theta), V, theta, owner);
  const { projectiles } = simulate([p], world, g, { dt, tMax, record: false });
  const end = projectiles[0].end;
  if (!end || end.type === 'out') return 1e6;
  if (end.tank) {
    if (end.tank.id === target.id) return 0;
    if (end.tank.id === owner || avoid.includes(end.tank.id)) return 1e5;
  }
  const d = Math.hypot(end.x - target.cx, end.y - target.cy) - target.r;
  return Math.max(0, d);
}

export function solveShot(opts) {
  const { from, target, g, Vmin, Vmax } = opts;
  const dx = target.cx - from.x;
  const dy = target.cy - from.y;
  const evalAt = (theta, V) => evaluateShot(opts, theta, V);

  const cands = [];
  for (let V = Vmin; V <= Vmax; V += 2) {
    for (const th of analyticAngles(dx, dy, V, g)) cands.push({ theta: th, V });
  }
  if (!cands.length) cands.push({ theta: dx >= 0 ? 45 : 135, V: Vmax });

  let best = null;
  for (const c of cands) {
    const miss = evalAt(c.theta, c.V);
    if (!best || miss < best.miss) best = { ...c, miss };
  }

  let stepT = 1;
  let stepV = 1;
  for (let it = 0; it < 40 && best.miss > 0; it++) {
    let improved = false;
    for (const [a, b] of [[stepT, 0], [-stepT, 0], [0, stepV], [0, -stepV]]) {
      const theta = clamp(best.theta + a, 1, 179);
      const V = clamp(best.V + b, Vmin, Vmax);
      const miss = evalAt(theta, V);
      if (miss < best.miss) {
        best = { theta, V, miss };
        improved = true;
      }
    }
    if (!improved) {
      stepT /= 2;
      stepV /= 2;
      if (stepT < 0.03) break;
    }
  }
  return best;
}
