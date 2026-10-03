// Mermi hareketi: ileri Euler yöntemiyle sayısal çözüm.
//   r(n+1) = r(n) + v(n)·Δt
//   v(n+1) = v(n) + a·Δt,   a = (0, −g)
// Önizleme çizgisi, gerçek atış ve NPC hesabı aynı kodu kullanır.

import { fromPolar, reflect } from './vec2.js';
import { TABAN } from './heightmap.js';

let nextId = 1;

export function makeProjectile({ x, y, vx, vy, weapon, owner, m = weapon.kutle, fragment = false }) {
  return {
    id: nextId++,
    x, y, vx, vy, m, weapon, owner, fragment,
    t: 0,
    x0: x,
    y0: y,
    maxY: y,
    bounces: weapon.sekmeSayisi ?? 0,
    canSplit: Boolean(weapon.parca) && !fragment,
    alive: true,
    path: null,
    end: null,
  };
}

// Namludan çıkış. Üçlü atışta θ−Δ, θ, θ+Δ açılarıyla üç mermi.
export function launch(weapon, muzzle, V, thetaDeg, owner) {
  const d = weapon.aciFarki;
  const angles = d ? [thetaDeg - d, thetaDeg, thetaDeg + d] : [thetaDeg];
  return angles.map((a) => {
    const v = fromPolar(V, a);
    return makeProjectile({ x: muzzle.x, y: muzzle.y, vx: v.x, vy: v.y, weapon, owner });
  });
}

// Tek Euler adımı
export function eulerStep(p, g, dt) {
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.vy -= g * dt;
  p.t += dt;
}

// A→B doğru parçasının çember ile ilk kesişim parametresi s ∈ [0, 1], yoksa null
function segmentCircle(ax, ay, bx, by, cx, cy, r) {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a === 0) return null;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = (-b - Math.sqrt(disc)) / (2 * a);
  return s >= 0 && s <= 1 ? s : null;
}

// Tepe noktasında parçalanma. Δvᵢ'lerin toplamı sıfır olduğu için
// Σ mᵢ·vᵢ = (m/k)·Σ(v + Δvᵢ) = m·v  →  momentum korunur.
export function splitProjectile(p) {
  const k = p.weapon.parca;
  const s = p.weapon.parcaHiz;
  const out = [];
  for (let i = 0; i < k; i++) {
    const phi = Math.PI / 4 + (i * 2 * Math.PI) / k;
    const f = makeProjectile({
      x: p.x,
      y: p.y,
      vx: p.vx + s * Math.cos(phi),
      vy: p.vy + s * Math.sin(phi),
      weapon: p.weapon,
      owner: p.owner,
      m: p.m / k,
      fragment: true,
    });
    f.t = p.t;
    f.x0 = p.x0;
    f.y0 = p.y0;
    f.maxY = p.maxY;
    out.push(f);
  }
  return out;
}

// Bir adım ilerlet, çarpışmaları denetle. Olay yoksa null döner.
// world: { width, heightAt(x), normalAt(x), tanks: [{ id, alive, cx, cy, r }],
//          obstacles: [{ alive, circles: [{ cx, cy, r }] }] }  (ağaç/taş, isteğe bağlı)
export function stepProjectile(p, world, g, dt, tMax) {
  const ax = p.x;
  const ay = p.y;
  const prevVy = p.vy;
  eulerStep(p, g, dt);
  if (p.y > p.maxY) p.maxY = p.y;

  // En erken çarpışma: arazi mi tank mı?
  let hitS = Infinity;
  let hitTank = null;
  for (const tank of world.tanks) {
    if (!tank.alive) continue;
    if (tank.id === p.owner && !p.fragment && p.t < 0.25) continue;
    const s = segmentCircle(ax, ay, p.x, p.y, tank.cx, tank.cy, tank.r);
    if (s !== null && s < hitS) {
      hitS = s;
      hitTank = tank;
    }
  }
  let hitObstacle = null;
  for (const o of world.obstacles ?? []) {
    if (!o.alive) continue;
    for (const c of o.circles) {
      const s = segmentCircle(ax, ay, p.x, p.y, c.cx, c.cy, c.r);
      if (s !== null && s < hitS) {
        hitS = s;
        hitTank = null;
        hitObstacle = o;
      }
    }
  }
  let groundS = null;
  if (p.y <= world.heightAt(p.x)) {
    // Temas noktasını ikiye bölme (bisection) ile bul
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      const x = ax + (p.x - ax) * mid;
      const y = ay + (p.y - ay) * mid;
      if (y <= world.heightAt(x)) hi = mid;
      else lo = mid;
    }
    groundS = hi;
  }

  if ((hitTank || hitObstacle) && (groundS === null || hitS <= groundS)) {
    p.x = ax + (p.x - ax) * hitS;
    p.y = ay + (p.y - ay) * hitS;
    return { type: 'impact', p, x: p.x, y: p.y, tank: hitTank, obstacle: hitObstacle };
  }

  if (groundS !== null) {
    const cx = ax + (p.x - ax) * groundS;
    const cy = ay + (p.y - ay) * groundS;
    const n = world.normalAt(cx);
    const vIn = { x: p.vx, y: p.vy };
    if (p.bounces > 0 && vIn.x * n.x + vIn.y * n.y < 0) {
      const vOut = reflect(vIn, n, p.weapon.e);
      p.vx = vOut.x;
      p.vy = vOut.y;
      p.x = cx + n.x * 0.05;
      p.y = cy + n.y * 0.05;
      p.bounces--;
      return { type: 'bounce', p, x: cx, y: cy, vIn, vOut, n };
    }
    p.x = cx;
    p.y = cy;
    return { type: 'impact', p, x: cx, y: cy, tank: null, obstacle: null };
  }

  if (p.x < -40 || p.x > world.width + 40 || p.y < TABAN - 20 || p.t > tMax) {
    return { type: 'out', p, x: p.x, y: p.y };
  }

  if (p.canSplit && prevVy > 0 && p.vy <= 0) {
    return { type: 'split', p, x: p.x, y: p.y, fragments: splitProjectile(p) };
  }
  return null;
}

// Havadaki tüm mermileri birlikte yürütür (parçalar, sekmeler dahil).
export class Flight {
  constructor(projectiles, world, g, { tMax = 20, record = false } = {}) {
    this.world = world;
    this.g = g;
    this.tMax = tMax;
    this.record = record;
    this.active = [];
    this.all = [];
    for (const p of projectiles) this.add(p);
  }

  add(p) {
    if (this.record && !p.path) p.path = [{ x: p.x, y: p.y }];
    this.active.push(p);
    this.all.push(p);
  }

  get done() {
    return this.active.length === 0;
  }

  step(dt) {
    const events = [];
    for (const p of this.active.slice()) {
      const ev = stepProjectile(p, this.world, this.g, dt, this.tMax);
      if (this.record) p.path.push({ x: p.x, y: p.y });
      if (!ev) continue;
      events.push(ev);
      if (ev.type === 'bounce') continue;
      p.alive = false;
      p.end = ev;
      this.active.splice(this.active.indexOf(p), 1);
      if (ev.type === 'split') {
        for (const f of ev.fragments) {
          if (this.record) f.path = [{ x: f.x, y: f.y }];
          this.add(f);
        }
      }
    }
    return events;
  }
}

// Atışı sonuna kadar çalıştırır (önizleme ve NPC için). Verilen mermiler değişir.
export function simulate(projectiles, world, g, { dt, tMax = 20, record = true }) {
  const f = new Flight(projectiles, world, g, { tMax, record });
  const events = [];
  let guard = Math.ceil(tMax / dt) + 10;
  while (!f.done && guard-- > 0) events.push(...f.step(dt));
  return { projectiles: f.all, events };
}
