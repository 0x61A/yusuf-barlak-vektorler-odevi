import { test } from 'node:test';
import assert from 'node:assert/strict';

import { DT, SILAHLAR, KRATER, TANK } from '../public/js/config.js';
import { reflect, dot } from '../public/js/physics/vec2.js';
import { Heightmap } from '../public/js/physics/heightmap.js';
import { launch, simulate, splitProjectile, makeProjectile } from '../public/js/physics/projectile.js';
import { solveShot } from '../public/js/physics/ballistics.js';

const [STANDART, , , SEKME, PARCALI] = SILAHLAR;
const g = 9.81;

function flatWorld(width = 1000, tanks = []) {
  const hm = Heightmap.flat(width, 0.5, 0);
  return { width, heightAt: (x) => hm.heightAt(x), normalAt: (x) => hm.normalAt(x), tanks };
}

function rangeOf(theta, V) {
  const world = flatWorld();
  const shots = launch(STANDART, { x: 100, y: 0 }, V, theta, 'test');
  const { projectiles } = simulate(shots, world, g, { dt: DT, tMax: 60, record: false });
  return projectiles[0].end.x - 100;
}

test('Euler menzili analitik R = V²·sin2θ/g ile %0.5 içinde', () => {
  const R = rangeOf(45, 40);
  const analytic = (40 * 40 * Math.sin(Math.PI / 2)) / g; // 163.1 m
  assert.ok(Math.abs(R - analytic) / analytic < 0.005, `R=${R.toFixed(2)} beklenen≈${analytic.toFixed(2)}`);
});

test('Tümler açılar (30° ve 60°) aynı menzile düşer', () => {
  const a = rangeOf(30, 40);
  const b = rangeOf(60, 40);
  assert.ok(Math.abs(a - b) / a < 0.01, `30°: ${a.toFixed(2)}  60°: ${b.toFixed(2)}`);
});

test('Sekme: teğet bileşen korunur, normal bileşen −e katı olur', () => {
  const n = { x: Math.sin(0.3), y: Math.cos(0.3) };
  const t = { x: n.y, y: -n.x };
  const v = { x: 12, y: -20 };
  const e = SEKME.e;
  const out = reflect(v, n, e);
  assert.ok(Math.abs(dot(out, t) - dot(v, t)) < 1e-9);
  assert.ok(Math.abs(dot(out, n) + e * dot(v, n)) < 1e-9);
});

test('Parçalı mermi: momentum korunur', () => {
  const p = makeProjectile({ x: 0, y: 50, vx: 23.5, vy: 0.01, weapon: PARCALI, owner: 'test' });
  const frags = splitProjectile(p);
  const px = frags.reduce((s, f) => s + f.m * f.vx, 0);
  const py = frags.reduce((s, f) => s + f.m * f.vy, 0);
  assert.ok(Math.abs(px - p.m * p.vx) < 1e-9);
  assert.ok(Math.abs(py - p.m * p.vy) < 1e-9);
  assert.ok(Math.abs(frags.reduce((s, f) => s + f.m, 0) - p.m) < 1e-12);
});

test('NPC çözücü gürültüsüz hedefe ≤ 1 m', () => {
  const target = { id: 'hedef', alive: true, cx: 260, cy: 1.3, r: 2.8 };
  const world = flatWorld(400, [target]);
  const from = { x: 80, y: 2.3 };
  const best = solveShot({
    world, g, dt: DT, tMax: 20,
    muzzleAt: (th) => ({ x: from.x + 3.4 * Math.cos((th * Math.PI) / 180), y: from.y + 3.4 * Math.sin((th * Math.PI) / 180) }),
    weapon: STANDART, owner: 'npc', target, from, Vmin: 5, Vmax: 55,
  });
  assert.ok(best.miss <= 1, `ıska ${best.miss}`);
});

test('Krater yayvan ve tırmanılabilir (en dik yer < tank sınırı)', () => {
  const hm = Heightmap.flat(200, 0.5, 10);
  const r = 9; // en büyük patlama (ağır mermi)
  hm.carve(100, 10, r);
  const depth = 10 - hm.heightAt(100);
  assert.ok(depth > 0.5 * r && depth <= KRATER.derinlik * r, `derinlik ${depth.toFixed(2)}`);
  assert.equal(hm.heightAt(100 + r * KRATER.genislik + 2), 10);
  let maxSlope = 0;
  for (let x = 80; x <= 120; x += 0.5) maxSlope = Math.max(maxSlope, Math.abs(hm.slopeAt(x)));
  assert.ok(maxSlope < TANK.maxEgim / 2, `en dik eğim ${maxSlope.toFixed(2)}`);
});

test('Krater yer altındaysa sütun çöker, yüzeyde değilse dokunmaz', () => {
  const hm = Heightmap.flat(100, 0.5, 10);
  hm.carve(50, 40, 4); // havada: değişiklik yok
  assert.equal(hm.heightAt(50), 10);
  hm.carve(50, 0, 3); // derinde: sütun 2·0.7·3 = 4.2 m çöker (yumuşatma öncesi)
  assert.ok(hm.heightAt(50) < 10 && hm.heightAt(50) > 5);
});

test('Mermi ağaca çarpar (engel olayı)', () => {
  const tree = { alive: true, circles: [{ cx: 140, cy: 6, r: 2 }] };
  const world = { ...flatWorld(), obstacles: [tree] };
  const shots = launch(STANDART, { x: 100, y: 1 }, 30, 20, 'test');
  const { projectiles } = simulate(shots, world, g, { dt: DT, tMax: 20, record: false });
  const end = projectiles[0].end;
  assert.equal(end.obstacle, tree);
  assert.ok(Math.abs(end.x - 140) < 3);
});
