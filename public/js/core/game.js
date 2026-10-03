// Oyun akışı: sıra tabanlı durum makinesi.
// aim (oyuncu hareket + nişan) → flight (mermi uçuşu) → resolve (patlama sonrası bekleme)
// → sıradaki canlı tank. NPC sırası: npc (düşün → hareket → nişan) → flight → …

import * as THREE from 'three';
import { DT, SILAHLAR, ZORLUKLAR, HARITALAR, GEZEGENLER, TANK, RENKLER } from '../config.js';
import { DEG } from '../physics/vec2.js';
import { Heightmap } from '../physics/heightmap.js';
import { launch, simulate, Flight } from '../physics/projectile.js';
import { solveShot } from '../physics/ballistics.js';
import { TerrainMesh } from '../world/terrain.js';
import { Obstacles, decorTrees } from '../world/obstacles.js';
import { Tank } from '../world/tank.js';
import { Effects, ProjectileView, PreviewPath } from '../world/effects.js';
import { VectorDisplay } from '../world/vectors.js';
import { NpcBrain } from '../ai/npc.js';
import { sfx } from '../audio/sfx.js';

const TRAIL_COLORS = [0x1c7ed6, 0xe03131, 0x2b8a3e, 0xf08c00, 0x7048e8, 0x0c8599, 0x343a40, 0xc2255c];
const MAX_LAB_SHOTS = 8;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const ease = (k) => k * k * (3 - 2 * k);
const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

// Önizleme çizgisi için noktaları seyrelt
function decimate(path, max = 4000) {
  if (path.length <= max) return path;
  const k = Math.ceil(path.length / max);
  const out = path.filter((_, i) => i % k === 0);
  out.push(path[path.length - 1]);
  return out;
}

// Beyaz zeminli, koyu yazılı tabela (deney modu işaretleri)
function textSprite(text, color = '#1f2937') {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 104;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.roundRect(8, 8, 240, 88, 26);
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.font = '700 50px "Nunito", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 128, 55);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(7.5, 3, 1);
  return s;
}

// Oyun alanının sınırını gösteren kırmızı-beyaz direk
function boundaryPost(x, y) {
  const g = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.22, 1, 8),
      new THREE.MeshStandardMaterial({ color: k % 2 ? 0xffffff : 0xe03131, roughness: 0.6 }),
    );
    seg.position.y = 0.5 + k;
    seg.castShadow = true;
    g.add(seg);
  }
  g.position.set(x, y, 6);
  return g;
}

export class Game {
  constructor({ scene, rig, hud, panel, mode, npcCount, difficulty, quality }) {
    this.scene = scene;
    this.rig = rig;
    this.hud = hud;
    this.panel = panel;
    this.lab = mode === 'deney';
    this.map = HARITALAR[mode];
    this.planet = GEZEGENLER[0];
    this.g = this.lab ? this.planet.g : this.map.g;
    this.diff = ZORLUKLAR[difficulty] ?? ZORLUKLAR.orta;

    // Oynanan alan [ext, ext + genislik]; iki yanda arazi görsel olarak devam eder
    const ext = this.map.kenar;
    this.width = this.map.genislik + 2 * ext;
    this.bounds = { min: ext + 8, max: ext + this.map.genislik - 8 };
    const spawns = (this.lab ? [40] : npcCount === 2 ? [30, 140, 230] : [36, 224]).map((x) => x + ext);
    const seed = (Math.random() * 1e9) | 0;
    this.hm = this.lab
      ? Heightmap.flat(this.width, this.map.adim, 0)
      : Heightmap.generate(this.width, this.map.adim, seed, spawns);
    this.groundY = this.lab ? 0 : 12;
    this.terrain = new TerrainMesh(this.hm, { farBase: this.groundY, seed, hills: this.lab ? 0.4 : 1 });
    scene.add(this.terrain.group);
    this.decor = decorTrees(scene, this.terrain, { width: this.width, bounds: this.bounds, seed, count: this.lab ? 160 : 120 });
    this.obstacles = this.lab ? null : new Obstacles(scene, this.hm, { bounds: this.bounds, spawns, seed });
    for (const x of [this.bounds.min - 4, this.bounds.max + 4]) scene.add(boundaryPost(x, this.hm.heightAt(x)));
    this.setDecorDensity(quality?.decor ?? 1);

    this.tanks = spawns.map((x, i) => {
      const t = new Tank({
        id: i === 0 ? 'oyuncu' : `npc${i}`,
        name: i === 0 ? 'SEN' : `NPC-${i}`,
        color: i === 0 ? RENKLER.oyuncu : RENKLER.npc[i - 1],
        isPlayer: i === 0,
        x,
        hm: this.hm,
        unlimited: this.lab,
      });
      t.theta = i === 0 ? 45 : 135;
      scene.add(t.mesh);
      return t;
    });
    this.player = this.tanks[0];
    this.brains = new Map(this.tanks.slice(1).map((t) => [t, new NpcBrain(t, this.diff)]));

    // Fizik modülünün gördüğü dünya
    this.world = {
      width: this.width,
      heightAt: (x) => this.hm.heightAt(x),
      normalAt: (x) => this.hm.normalAt(x),
      tanks: this.tanks,
      obstacles: this.obstacles?.list ?? [],
    };

    this.effects = new Effects(scene);
    this.preview = new PreviewPath(scene);
    this.vectors = new VectorDisplay(scene);

    this.weaponIndex = 0;
    this.state = 'idle';
    this.turn = 0;
    this.moveDir = 0;
    this.timeScale = 1;
    this.timers = [];
    this.flight = null;
    this.views = new Map();
    this.shotGroups = [];
    this.shotNo = 0;
    this.aimDirty = true;
    this.frame = 0;
    this.edgeToastAt = 0;
    this.stats = { shots: 0, hits: 0, dealt: 0, taken: 0, start: performance.now() };
    if (this.lab) this.buildLab(spawns[0]);
  }

  get active() {
    return this.tanks[this.turn];
  }

  get weapon() {
    return SILAHLAR[this.weaponIndex];
  }

  get power() {
    return this.map.guc;
  }

  setDecorDensity(k) {
    const n = Math.floor(this.decor.total * k);
    this.decor.trunk.count = n;
    this.decor.crown.count = n;
  }

  start() {
    this.hud.buildHealth(this.tanks);
    this.hud.setPowerRange(this.power.min, this.power.max);
    this.beginTurn(0);
  }

  // Tüm oyun alanını ekrana sığdır
  overview() {
    const mid = (this.bounds.min + this.bounds.max) / 2;
    this.rig.showArea(mid, this.hm.heightAt(mid) + 10, this.bounds.max - this.bounds.min + 40);
  }

  // ---------- Oyun zamanına bağlı bekleme ----------
  wait(sec) {
    return new Promise((res) => this.timers.push({ t: sec, res }));
  }

  // fn(dt) her adımda çağrılır; true dönünce (veya zaman aşımında) biter
  waitUntil(fn, timeout = 6) {
    return new Promise((res) => this.timers.push({ t: timeout, fn, res }));
  }

  tickTimers(dt) {
    for (const tm of this.timers.slice()) {
      tm.t -= dt;
      if ((tm.fn && tm.fn(dt)) || tm.t <= 0) {
        this.timers.splice(this.timers.indexOf(tm), 1);
        tm.res();
      }
    }
  }

  // ---------- Sıra ----------
  beginTurn(i) {
    this.turn = i;
    const t = this.active;
    if (!this.lab) t.fuel = TANK.yakit;
    this.rig.follow();
    this.rig.setFocus(t.x, t.y + 3);
    if (this.restoreDist) {
      this.rig.restoreDistance(this.restoreDist);
      this.restoreDist = null;
    }
    this.hud.updateHealth(t);
    if (t.isPlayer) {
      this.state = 'aim';
      const text = this.lab ? `Laboratuvar · ${this.planet.ad}` : 'Sıra sende';
      this.hud.setBanner(text, t.color);
      if (!this.lab) this.hud.turnPopup('SIRA SENDE!', 'Hareket et, nişan al, ateş et', t.color);
      this.hud.setControls(true);
      if (t.ammo[this.weapon.id] <= 0) this.weaponIndex = 0;
      this.hud.setWeapon(this.weaponIndex, t);
      this.aimDirty = true;
    } else {
      this.state = 'npc';
      this.hud.setControls(false);
      this.hud.setBanner(`${t.name} düşünüyor…`, t.color);
      this.hud.turnPopup(`${t.name} SIRASI`, 'Rakip nişan alıyor', t.color);
      this.preview.hide();
      this.vectors.hide();
      this.panel.clear(`${t.name} sırası: hedefe gereken açıyı aynı fizik denklemleriyle hesaplıyor.`);
      this.runNpc(t);
    }
  }

  endTurn() {
    this.flight = null;
    this.views.clear();
    if (this.shooter?.isPlayer && this.shotHit) this.stats.hits++;
    this.shotHit = false;
    const playerAlive = this.player.alive;
    const npcAlive = this.tanks.some((k) => !k.isPlayer && k.alive);
    if (!this.lab && (!playerAlive || !npcAlive)) {
      this.finish(!playerAlive && !npcAlive ? null : playerAlive);
      return;
    }
    let next = this.turn;
    do next = (next + 1) % this.tanks.length;
    while (!this.tanks[next].alive);
    this.beginTurn(next);
  }

  finish(won) {
    this.state = 'over';
    this.hud.setControls(false);
    this.hud.setBanner(won ? 'Zafer' : won === null ? 'Berabere' : 'Yenilgi', won ? RENKLER.oyuncu : RENKLER.npc[0]);
    this.preview.hide();
    this.vectors.hide();
    if (won) sfx.win();
    else sfx.lose();
    const s = this.stats;
    const secs = Math.round((performance.now() - s.start) / 1000);
    const acc = s.shots ? s.hits / s.shots : 0;
    const stars = won ? (acc >= 0.6 ? 3 : acc >= 0.35 ? 2 : 1) : 0;
    this.hud.gameOver(won, stars, [
      ['Zorluk', this.diff.ad],
      ['Atış', s.shots],
      ['İsabetli atış', `${s.hits} (%${Math.round(acc * 100)})`],
      ['Verilen hasar', s.dealt],
      ['Alınan hasar', s.taken],
      ['Süre', `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`],
    ]);
  }

  // ---------- Oyuncu kontrolleri ----------
  canControl() {
    return this.state === 'aim';
  }

  move(dir) {
    this.moveDir = dir;
  }

  setAngle(v) {
    if (!this.canControl() || !Number.isFinite(v)) return;
    this.player.theta = clamp(v, 0, 180);
    this.aimDirty = true;
  }

  setPower(v) {
    if (!this.canControl() || !Number.isFinite(v)) return;
    this.player.V = clamp(v, this.power.min, this.power.max);
    this.aimDirty = true;
  }

  angleBy(d) {
    this.setAngle(Math.round((this.player.theta + d) * 10) / 10);
  }

  powerBy(d) {
    this.setPower(Math.round((this.player.V + d) * 10) / 10);
  }

  aimDrag({ theta, power01 }) {
    this.setAngle(Math.round(theta * 10) / 10);
    this.setPower(Math.round((this.power.min + power01 * (this.power.max - this.power.min)) * 10) / 10);
  }

  setWeapon(i) {
    const w = SILAHLAR[i];
    if (!this.canControl() || !w || this.player.ammo[w.id] <= 0) return;
    this.weaponIndex = i;
    this.hud.setWeapon(i, this.player);
    this.aimDirty = true;
    sfx.click();
  }

  fire() {
    if (this.state !== 'aim') return;
    if (this.aimDirty) this.refreshAim();
    this.launchShot(this.player, this.weapon);
  }

  // Önizleme (tam yol), vektör okları ve fizik paneli
  refreshAim() {
    const t = this.player;
    const w = this.weapon;
    const muzzle = t.muzzleAt(t.theta);
    const shots = launch(w, muzzle, t.V, t.theta, t.id);
    const { projectiles, events } = simulate(shots, this.world, this.g, { dt: DT, tMax: this.map.tMax });
    const impact = events.find((e) => e.type === 'impact');
    this.preview.set(projectiles.map((p) => decimate(p.path)), impact ? [impact] : [], w.renk);
    this.vectors.showAim(muzzle, t.V, t.theta);
    this.panel.aim({ V: t.V, theta: t.theta, g: this.g, weapon: w, h0: muzzle.y - this.hm.heightAt(muzzle.x), flat: this.lab });
    this.hud.setAim(t.theta, t.V);
  }

  // ---------- Atış ----------
  launchShot(t, w) {
    if (t.ammo[w.id] <= 0) w = SILAHLAR[0];
    if (t.ammo[w.id] !== Infinity) t.ammo[w.id]--;
    t.drive = 0;
    this.moveDir = 0;
    const muzzle = t.muzzleAt(t.theta);
    const shots = launch(w, muzzle, t.V, t.theta, t.id);
    this.flight = new Flight(shots, this.world, this.g, { tMax: this.map.tMax });
    this.mainId = shots[Math.floor(shots.length / 2)].id;
    this.mainEnd = null;
    this.shooter = t;
    this.shotWeapon = w;
    this.shotHit = false;
    this.flightNote = '';
    this.shotColor = this.lab ? TRAIL_COLORS[this.shotNo % TRAIL_COLORS.length] : w.renk;
    this.shotNo++;
    if (!this.lab || this.shotGroups.length >= MAX_LAB_SHOTS) this.dropOldestTrails(!this.lab);
    this.shotGroups.push([]);
    for (const p of shots) this.addView(p);

    this.effects.muzzle(muzzle.x, muzzle.y, t.theta);
    sfx.fire(w.id === 'agir');
    this.preview.hide();
    if (!this.lab) this.hud.hideAnalysis();
    this.hud.setControls(false);
    this.hud.setBanner(`${t.isPlayer ? '' : `${t.name} · `}${w.ad} atış`, t.color);
    if (t.isPlayer) {
      this.stats.shots++;
      this.hud.setWeapon(this.weaponIndex, t);
    }
    this.restoreDist = this.rig.distance;
    this.rig.follow();
    this.state = 'flight';
  }

  addView(p) {
    const v = new ProjectileView(this.scene, this.shotColor);
    v.set(p.x, p.y);
    this.views.set(p.id, v);
    this.shotGroups[this.shotGroups.length - 1].push(v);
  }

  dropOldestTrails(all) {
    while (this.shotGroups.length && (all || this.shotGroups.length >= MAX_LAB_SHOTS)) {
      for (const v of this.shotGroups.shift()) v.dispose();
    }
  }

  stepFlight(dt) {
    const events = this.flight.step(dt);
    for (const ev of events) this.handleEvent(ev);
    for (const p of this.flight.active) this.views.get(p.id)?.set(p.x, p.y);
    const lead = this.flight.active.find((p) => p.id === this.mainId) ?? this.flight.active[0];
    if (lead) {
      this.lead = lead;
      this.rig.setFocus(lead.x, lead.y);
      const above = Math.max(0, lead.y - this.hm.heightAt(lead.x));
      this.rig.ensureDistance(this.rig.defaultDistance + above * 1.4);
    }
    if (this.flight.done) {
      this.state = 'resolve';
      this.resolveT = 1.1;
      this.lead = null;
      this.vectors.hide();
      this.showAnalysis();
    }
  }

  handleEvent(ev) {
    const p = ev.p;
    const view = this.views.get(p.id);
    if (ev.type === 'impact') {
      view?.land(ev.x, ev.y);
      if (p.id === this.mainId) this.mainEnd = ev;
      if (ev.obstacle) this.hud.popup(ev.x, ev.y + 3, ev.obstacle.type === 'agac' ? 'AĞACA ÇARPTI' : 'TAŞA ÇARPTI', 'bilgi');
      this.explode(ev.x, ev.y, p.weapon, ev.tank);
    } else if (ev.type === 'out') {
      view?.land(p.x, p.y);
      const x = clamp(p.x, this.bounds.min, this.bounds.max);
      this.hud.popup(x, this.hm.heightAt(x) + 8, 'ALAN DIŞI', 'bilgi');
    } else if (ev.type === 'bounce') {
      this.effects.spark(ev.x, ev.y);
      sfx.bounce();
      const K1 = 0.5 * p.m * (ev.vIn.x ** 2 + ev.vIn.y ** 2);
      const K2 = 0.5 * p.m * (ev.vOut.x ** 2 + ev.vOut.y ** 2);
      this.flightNote = `Sekme: e = ${p.weapon.e} → K ${K1.toFixed(0)} J'den ${K2.toFixed(0)} J'e düştü (ΔK = ${(K2 - K1).toFixed(0)} J).`;
      this.hud.popup(ev.x, ev.y + 3, 'SEKME', 'bilgi');
    } else if (ev.type === 'split') {
      view?.land(ev.x, ev.y);
      this.effects.spark(ev.x, ev.y, 26);
      sfx.split();
      for (const f of ev.fragments) this.addView(f);
      if (p.id === this.mainId) this.mainId = ev.fragments[0].id;
      const sx = ev.fragments.reduce((s, f) => s + f.m * f.vx, 0);
      const sy = ev.fragments.reduce((s, f) => s + f.m * f.vy, 0);
      this.flightNote = `Parçalanma (tepe, vy ≈ 0): p⃗ önce = (${(p.m * p.vx).toFixed(1)}, ${(p.m * p.vy).toFixed(1)}) · Σp⃗ sonra = (${sx.toFixed(1)}, ${sy.toFixed(1)}) kg·m/s → momentum korundu.`;
    }
  }

  // Ağaç/taş parçalanır: tank ezdiğinde veya patlamada
  breakObstacle(o) {
    if (!o.alive) return;
    this.obstacles.shatter(o);
    this.effects.debris(o.x, o.y, o.type, o.type === 'agac' ? 7 * o.size : 2 * o.size);
    sfx.crunch(o.type);
    this.aimDirty = true;
  }

  explode(x, y, w, directTank) {
    const range = this.hm.carve(x, y, w.yaricap);
    if (range) this.terrain.update(range);
    this.effects.explosion(x, y, w.yaricap);
    sfx.explosion(w.yaricap);
    if (this.obstacles) for (const o of this.obstacles.within(x, y, w.yaricap)) this.breakObstacle(o);
    for (const k of this.tanks) {
      if (!k.alive) continue;
      let dmg = 0;
      const full = k === directTank;
      if (full) dmg = w.hasar + 5;
      else {
        const d = Math.max(0, Math.hypot(x - k.cx, y - k.cy) - k.r * 0.5);
        if (d < w.yaricap) dmg = w.hasar * (1 - d / w.yaricap);
      }
      dmg = Math.min(Math.round(dmg), k.hp);
      if (dmg <= 0) continue;
      k.damage(dmg);
      this.hud.popup(k.x, k.y + 8, full ? `TAM İSABET −${dmg}` : `−${dmg}`, full ? 'tam' : '');
      sfx.hit();
      if (this.shooter.isPlayer && !k.isPlayer) {
        this.stats.dealt += dmg;
        this.shotHit = true;
      }
      if (k.isPlayer && !this.shooter.isPlayer) this.stats.taken += dmg;
      const brain = this.brains.get(k);
      if (brain && Math.abs(this.player.x - k.x) < 90) brain.wasHitCloseBy = true;
      if (!k.alive) {
        this.effects.explosion(k.x, k.cy, 8);
        this.hud.popup(k.x, k.y + 11, `${k.name} İMHA`, 'bilgi');
      }
    }
    this.hud.updateHealth(this.active);
    if (this.lab) {
      for (const tg of this.targets) {
        if (Math.abs(x - tg.x) < 3.5) {
          this.hud.popup(tg.x, 9, `HEDEF ${tg.d} m ✓`, 'tam');
          tg.ring.material.color.set(0x2b8a3e);
        }
      }
    }
  }

  showAnalysis() {
    const ev = this.mainEnd;
    if (!ev) return;
    const p = ev.p;
    const a = {
      weapon: `${this.shooter.isPlayer ? '' : `${this.shooter.name} · `}${this.shotWeapon.ad}`,
      dx: ev.x - p.x0,
      hmax: p.maxY - p.y0,
      t: p.t,
      speed: Math.hypot(p.vx, p.vy),
      angle: Math.atan2(-p.vy, Math.abs(p.vx)) / DEG,
      steps: Math.round(p.t / DT),
    };
    this.hud.showAnalysis(a);
    if (this.lab) this.logShot(a);
  }

  // ---------- NPC ----------
  async runNpc(t) {
    const brain = this.brains.get(t);
    const enemies = this.tanks.filter((k) => k.isPlayer);
    const allies = this.tanks.filter((k) => !k.isPlayer && k !== t);
    await this.wait(0.8 + Math.random() * 0.6);

    const solveAt = (x) => {
      const py = this.hm.heightAt(x) + TANK.pivotYuksekligi;
      return solveShot({
        world: this.world, g: this.g, dt: DT, tMax: this.map.tMax,
        muzzleAt: (th) => ({ x: x + TANK.namluBoyu * Math.cos(th * DEG), y: py + TANK.namluBoyu * Math.sin(th * DEG) }),
        from: { x, y: py }, target: brain.pickTarget(enemies), weapon: SILAHLAR[0], owner: t.id,
        avoid: allies.map((a) => a.id), Vmin: this.power.min, Vmax: this.power.max,
      });
    };
    const moveTo = brain.planMove({ hm: this.hm, bounds: this.bounds, enemies, solve: solveAt });
    if (moveTo !== null && Math.abs(moveTo - t.x) > 0.5) {
      this.hud.setBanner(`${t.name} hareket ediyor`, t.color);
      const dir = Math.sign(moveTo - t.x);
      t.drive = dir;
      await this.waitUntil(() => {
        this.rig.setFocus(t.x, t.y + 3);
        return t.fuel <= 0 || t.blocked || Math.sign(moveTo - t.x) !== dir;
      }, 6);
      t.drive = 0;
      await this.waitUntil(() => !t.falling, 2);
    }

    this.hud.setBanner(`${t.name} nişan alıyor`, t.color);
    const shot = brain.aim({ world: this.world, g: this.g, tMax: this.map.tMax, enemies, allies, Vmin: this.power.min, Vmax: this.power.max });
    if (!shot) {
      this.endTurn();
      return;
    }
    const th0 = t.theta;
    const V0 = t.V;
    let el = 0;
    this.npcAiming = { t, w: shot.weapon };
    await this.waitUntil((dt) => {
      el += dt;
      const k = ease(Math.min(1, el / 1.1));
      t.theta = th0 + (shot.theta - th0) * k;
      t.V = V0 + (shot.V - V0) * k;
      return k >= 1;
    }, 3);
    await this.wait(0.35);
    this.npcAiming = null;
    this.launchShot(t, shot.weapon);
  }

  // ---------- Laboratuvar ----------
  buildLab(x0) {
    this.targets = this.map.hedefler.map((d) => {
      const x = x0 + d;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(2.4, 3.4, 40),
        new THREE.MeshBasicMaterial({ color: 0xe03131, side: THREE.DoubleSide, transparent: true, opacity: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.06, 0);
      const dot = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -2 }));
      dot.rotation.x = -Math.PI / 2;
      dot.position.set(x, 0.07, 0);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 8), new THREE.MeshStandardMaterial({ color: 0xf1f3f5 }));
      post.position.set(x, 3, -6);
      const label = textSprite(`${d} m`, '#c92a2a');
      label.position.set(x, 7.6, -6);
      this.scene.add(ring, dot, post, label);
      return { x, d, ring };
    });
    // Her 100 m'de mesafe tabelası
    for (let d = 100; x0 + d < this.bounds.max; d += 100) {
      if (this.map.hedefler.includes(d)) continue;
      const s = textSprite(`${d} m`, '#495057');
      s.position.set(x0 + d, 2.5, 7);
      s.scale.set(5.5, 2.2, 1);
      this.scene.add(s);
    }

    const sel = document.getElementById('gezegen');
    sel.innerHTML = GEZEGENLER.map((p) => `<option value="${p.id}">${p.ad} · g = ${p.g} m/s²</option>`).join('');
    sel.addEventListener('change', () => this.setPlanet(sel.value));
    document.getElementById('btn-temizle').addEventListener('click', () => {
      if (this.state === 'flight') return;
      this.dropOldestTrails(true);
      document.getElementById('deney-kayit').innerHTML = '';
      this.shotNo = 0;
      for (const tg of this.targets) tg.ring.material.color.set(0xe03131);
      this.hud.hideAnalysis();
    });
    document.getElementById('deney-araclari').hidden = false;
    document.getElementById('btn-hizli').hidden = false;
  }

  setPlanet(id) {
    this.planet = GEZEGENLER.find((p) => p.id === id) ?? GEZEGENLER[0];
    this.g = this.planet.g;
    if (this.state === 'aim') this.hud.setBanner(`Laboratuvar · ${this.planet.ad}`, this.player.color);
    this.aimDirty = true;
  }

  logShot(a) {
    const t = this.player;
    const row = document.createElement('tr');
    row.innerHTML = `<td><span class="renk-nokta" style="background:${hex(this.shotColor)}"></span>${this.shotNo}</td><td>${t.theta.toFixed(1)}</td><td>${t.V.toFixed(1)}</td><td>${this.g}</td><td>${a.dx.toFixed(1)}</td><td>${a.hmax.toFixed(1)}</td><td>${a.t.toFixed(2)}</td>`;
    document.getElementById('deney-kayit').prepend(row);
  }

  // ---------- Döngü ----------
  update(dt) {
    this.tickTimers(dt);
    const t = this.active;
    if (this.state === 'aim') t.drive = this.moveDir;
    else if (this.state !== 'npc') for (const k of this.tanks) k.drive = 0;

    const p = this.player;
    const px = p.x;
    const py = p.y;
    const pt = p.tilt;
    const env = {
      others: this.tanks,
      bounds: this.bounds,
      obstacles: this.obstacles?.list,
      onCrush: (o) => this.breakObstacle(o),
    };
    for (const k of this.tanks) k.update(dt, this.g, env);
    this.obstacles?.update(dt, this.g);
    if (p.x !== px || Math.abs(p.y - py) > 1e-4 || Math.abs(p.tilt - pt) > 1e-4) this.aimDirty = true;
    if (this.state === 'aim') {
      this.rig.setFocus(t.x, t.y + 3);
      if (t.atEdge && performance.now() - this.edgeToastAt > 2500) {
        this.edgeToastAt = performance.now();
        this.hud.popup(t.x, t.y + 8, 'HARİTA SINIRI', 'bilgi');
      }
    }
    sfx.engine(this.tanks.some((k) => k.drive && !k.blocked && k.hasFuel()));

    this.effects.update(dt, this.g);
    if (this.state === 'flight') this.stepFlight(dt);
    else if (this.state === 'resolve') {
      this.resolveT -= dt;
      if (this.resolveT <= 0 && !this.tanks.some((k) => k.alive && k.falling)) this.endTurn();
    }
  }

  render() {
    this.frame++;
    if (this.aimDirty && this.state === 'aim') {
      this.aimDirty = false;
      this.refreshAim();
    }
    for (const k of this.tanks) {
      k.updateMesh();
      k.mesh.visible = k.alive;
    }

    let info = null;
    if (this.state === 'aim') {
      const t = this.player;
      info = { V: t.V, vx: t.V * Math.cos(t.theta * DEG), vy: t.V * Math.sin(t.theta * DEG), theta: t.theta };
      this.hud.setFuel(t.fuel, this.lab, Boolean(t.crushing));
    } else if (this.state === 'flight' && this.lead) {
      const p = this.lead;
      this.vectors.showVelocity(p);
      info = { V: Math.hypot(p.vx, p.vy), vx: p.vx, vy: p.vy, theta: 0 };
      if (this.frame % 3 === 0) this.panel.flight(p, this.g, this.flightNote);
    } else if (this.npcAiming) {
      const { t, w } = this.npcAiming;
      this.vectors.showAim(t.muzzleAt(t.theta), t.V, t.theta);
      this.panel.aim({ V: t.V, theta: t.theta, g: this.g, weapon: w, h0: 0, flat: false });
      info = { V: t.V, vx: t.V * Math.cos(t.theta * DEG), vy: t.V * Math.sin(t.theta * DEG), theta: t.theta };
    }
    this.hud.updateLabels(this.tanks, this.vectors.group.visible ? this.vectors.anchors : {}, info);
  }
}
