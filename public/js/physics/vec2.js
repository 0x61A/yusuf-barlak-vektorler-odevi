// 2B vektör yardımcıları. Vektörler düz {x, y} nesneleri.

export const DEG = Math.PI / 180;

// Kutupsal → kartezyen: V⃗ = V(cosθ î + sinθ ĵ)
export function fromPolar(V, thetaDeg) {
  const t = thetaDeg * DEG;
  return { x: V * Math.cos(t), y: V * Math.sin(t) };
}

export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const length = (a) => Math.hypot(a.x, a.y);

// Yüzeye çarpan hızın yansıması: v' = v − (1+e)(v·n̂)n̂
// Teğet bileşen korunur, normal bileşen −e katına iner.
export function reflect(v, n, e) {
  const vn = dot(v, n);
  return { x: v.x - (1 + e) * vn * n.x, y: v.y - (1 + e) * vn * n.y };
}

// Seed'li rastgele sayı üreteci (mulberry32): aynı seed → aynı arazi
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller ile standart normal dağılım
export function gauss(random) {
  const u = 1 - random();
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
