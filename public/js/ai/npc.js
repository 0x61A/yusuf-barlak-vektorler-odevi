// NPC beyni: hedef seç, gerekirse yer değiştir, fizikle nişan al, zorluğa göre hata ekle.

import { DT, SILAHLAR, TANK } from '../config.js';
import { gauss } from '../physics/vec2.js';
import { solveShot } from '../physics/ballistics.js';

const STANDART = SILAHLAR[0];

export class NpcBrain {
  constructor(tank, difficulty) {
    this.tank = tank;
    this.diff = difficulty;
    this.errorFactor = 1;
    this.lastTarget = null;
    this.lastX = tank.x;
    this.wasHitCloseBy = false;
  }

  // Bu turda nereye gideceğine karar ver (x veya null)
  planMove({ hm, bounds, enemies, solve }) {
    const t = this.tank;
    const reach = t.fuel / TANK.yakitMetre;
    const clampX = (x) => Math.min(Math.max(x, bounds.min), bounds.max);

    // Çukurdaysa: iki yan da belirgin yüksekse alçak tarafa tırman
    const h = hm.heightAt(t.x);
    const hl = hm.heightAt(t.x - 7);
    const hr = hm.heightAt(t.x + 7);
    if (hl - h > 2.5 && hr - h > 2.5) return clampX(t.x + (hl < hr ? -1 : 1) * Math.min(12, reach));

    // Yakından vurulduysa uzaklaş
    const target = this.pickTarget(enemies);
    if (this.wasHitCloseBy && target) {
      this.wasHitCloseBy = false;
      const away = Math.sign(t.x - target.x) || 1;
      return clampX(t.x + away * Math.min(10 + Math.random() * 8, reach));
    }

    // Temiz atış yoksa yakıt menzilindeki birkaç noktayı dene
    if (target && solve(t.x).miss > 6) {
      let best = null;
      for (const d of [-16, -8, 8, 16]) {
        if (Math.abs(d) > reach) continue;
        const x = clampX(t.x + d);
        const miss = solve(x).miss;
        if (!best || miss < best.miss) best = { x, miss };
      }
      if (best) return best.x;
    }

    // Bazen canlı görünmek için ufak kıpırdanma
    if (Math.random() < 0.3) return clampX(t.x + (Math.random() < 0.5 ? -1 : 1) * Math.min(4 + Math.random() * 4, reach));
    return null;
  }

  pickTarget(enemies) {
    const alive = enemies.filter((e) => e.alive);
    if (!alive.length) return null;
    return alive.reduce((a, b) => (Math.abs(b.x - this.tank.x) < Math.abs(a.x - this.tank.x) ? b : a));
  }

  pickWeapon(target) {
    const t = this.tank;
    const avail = SILAHLAR.filter((w) => w !== STANDART && t.ammo[w.id] > 0);
    if (!avail.length || Math.random() > this.diff.ozelSilah) return STANDART;
    // Zor seviye: duruma uygun silah
    if (this.diff.ad === 'Zor') {
      const dist = Math.abs(target.x - t.x);
      const pref = this.errorFactor < 0.5 ? 'agir' : dist > 120 ? 'parcali' : 'uclu';
      const w = avail.find((x) => x.id === pref);
      if (w) return w;
    }
    return avail[Math.floor(Math.random() * avail.length)];
  }

  // Nişan: fizik çözümü + gauss hatası. Hata çarpanı her atışta "öğrenerek" azalır.
  aim({ world, g, tMax, enemies, allies, Vmin, Vmax }) {
    const t = this.tank;
    const target = this.pickTarget(enemies);
    if (!target) return null;
    if (target !== this.lastTarget || Math.abs(t.x - this.lastX) > 4) this.errorFactor = 1;
    this.lastTarget = target;
    this.lastX = t.x;

    const best = solveShot({
      world, g, dt: DT, tMax,
      muzzleAt: (th) => t.muzzleAt(th),
      from: t.pivot(), target, weapon: STANDART, owner: t.id,
      avoid: allies.map((a) => a.id), Vmin, Vmax,
    });
    const k = this.errorFactor;
    const theta = Math.min(179, Math.max(1, best.theta + gauss(Math.random) * this.diff.sigmaAci * k));
    const V = Math.min(Vmax, Math.max(Vmin, best.V * (1 + gauss(Math.random) * this.diff.sigmaGuc * k)));
    this.errorFactor = Math.max(0.12, this.errorFactor * (1 - this.diff.ogrenme));
    return { theta, V, weapon: this.pickWeapon(target), target };
  }
}
