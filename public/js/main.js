// oyun.html girişi: sahneyi, kamerayı, HUD'u ve oyunu birbirine bağlar.

import { HARITALAR, PROJE } from './config.js';
import { createScene } from './world/scene.js';
import { CameraRig } from './camera/rig.js';
import { Hud } from './ui/hud.js';
import { PhysicsPanel } from './ui/physicsPanel.js';
import { Input } from './ui/input.js';
import { Game } from './core/game.js';
import { startLoop } from './core/loop.js';
import { QualityManager, QUALITY } from './quality.js';
import { loadSettings, saveSettings, isTouchDevice } from './settings.js';
import { sfx } from './audio/sfx.js';

const $ = (id) => document.getElementById(id);
const settings = loadSettings();
const params = new URLSearchParams(location.search);
const mode = params.get('mod') === 'deney' ? 'deney' : 'savas';
const npcCount = params.get('npc') === '2' ? 2 : 1;
const difficulty = ['kolay', 'orta', 'zor'].includes(params.get('zorluk')) ? params.get('zorluk') : settings.zorluk;
document.title = `${mode === 'deney' ? 'Deney modu' : 'Savaş'} · ${PROJE.ad}`;

// Deney modu tabelaları canvas'a yazıldığı için fontu bekle (en fazla 1.2 s)
await Promise.race([document.fonts.load('700 50px "Nunito"'), new Promise((r) => setTimeout(r, 1200))]).catch(() => {});

const canvas = $('sahne');
const map = HARITALAR[mode];
const totalWidth = map.genislik + 2 * map.kenar;
const view = createScene(canvas, {
  width: totalWidth,
  groundY: mode === 'deney' ? 0 : 12,
  fogDensity: mode === 'deney' ? 0.0007 : 0.0016,
  seed: 4242,
});
const baseFog = view.scene.fog.density;
const rig = new CameraRig(
  view.camera,
  canvas,
  mode === 'deney'
    ? { minDistance: 15, maxDistance: 5000, defaultDistance: 120 }
    : { minDistance: 18, maxDistance: 600, defaultDistance: 82 },
);

let game;
const quality = new QualityManager(settings.kalite, isTouchDevice() ? 'orta' : 'yuksek', (level) => {
  view.applyQuality(QUALITY[level]);
  game?.setDecorDensity(QUALITY[level].decor);
  showQuality();
});
function showQuality() {
  $('kalite-durum').textContent = `Şu anki kademe: ${quality.preset.ad}${quality.auto ? ' (oyun takılırsa kendiliğinden iner)' : ''}`;
}
view.applyQuality(quality.preset);
// Ekran oranına göre kamera: PC'de de telefonda da yatayda aynı genişlik görünür
rig.setVisibleWidth(map.gorunur);

const hud = new Hud({
  camera: view.camera,
  h: {
    weapon: (i) => game.setWeapon(i),
    angle: (v) => game.setAngle(v),
    power: (v) => game.setPower(v),
    fire: () => game.fire(),
  },
});
const panel = new PhysicsPanel($('fizik-icerik'));
game = new Game({ scene: view.scene, rig, hud, panel, mode, npcCount, difficulty, quality: quality.preset });

// Ağır çekim ve hızlı ileri birbirini dışlar
function setTimeScale(s) {
  game.timeScale = game.timeScale === s ? 1 : s;
  $('btn-agir').setAttribute('aria-pressed', String(game.timeScale === 0.25));
  $('btn-hizli').setAttribute('aria-pressed', String(game.timeScale === 4));
}

function toggleMap() {
  const on = !rig.overview;
  if (on) game.overview();
  else {
    rig.follow();
    rig.restoreDistance(rig.defaultDistance);
  }
  $('btn-harita').setAttribute('aria-pressed', String(on));
}

function resetCamera() {
  rig.reset();
  $('btn-harita').setAttribute('aria-pressed', 'false');
}

// ---------- Duraklatma menüsü ----------
const pause = $('duraklat-dlg');
let pausedScale = 1;
function openPause() {
  if (pause.open) return;
  pausedScale = game.timeScale;
  game.timeScale = 0;
  const current = quality.auto ? 'otomatik' : quality.level;
  for (const r of pause.querySelectorAll('input[name="kalite"]')) r.checked = r.value === current;
  for (const r of pause.querySelectorAll('input[name="ses"]')) r.checked = r.value === (loadSettings().ses ? 'acik' : 'kapali');
  showQuality();
  pause.showModal();
}
pause.addEventListener('close', () => {
  game.timeScale = pausedScale;
});
pause.addEventListener('change', (e) => {
  if (e.target.name === 'kalite') {
    saveSettings({ kalite: e.target.value });
    quality.set(e.target.value);
    showQuality();
  } else if (e.target.name === 'ses') {
    const on = e.target.value === 'acik';
    saveSettings({ ses: on });
    sfx.setEnabled(on);
    if (on) sfx.click();
  }
});
$('btn-menu').addEventListener('click', openPause);
$('btn-devam').addEventListener('click', () => pause.close());
$('btn-yeniden').addEventListener('click', () => location.reload());
$('btn-kontroller').addEventListener('click', () => $('kontrol-dlg').showModal());
for (const b of document.querySelectorAll('[data-kapat]')) b.addEventListener('click', () => b.closest('dialog').close());

new Input(canvas, view.camera, {
  canControl: () => game.canControl() && !pause.open,
  move: (d) => game.move(d),
  angleBy: (d) => game.angleBy(d),
  powerBy: (d) => game.powerBy(d),
  weapon: (i) => game.setWeapon(i),
  fire: () => game.fire(),
  slowmo: () => setTimeScale(0.25),
  fast: () => mode === 'deney' && setTimeScale(4),
  resetCam: resetCamera,
  map: toggleMap,
  pause: openPause,
  zoom: (f) => rig.zoom(f),
  aimDrag: (a) => game.aimDrag(a),
  aimEnd: () => {},
});

$('btn-zoom-in').addEventListener('click', () => rig.zoom(0.8));
$('btn-zoom-out').addEventListener('click', () => rig.zoom(1.25));
$('btn-harita').addEventListener('click', toggleMap);
$('btn-kamera').addEventListener('click', resetCamera);
$('btn-agir').addEventListener('click', () => setTimeScale(0.25));
$('btn-hizli').addEventListener('click', () => setTimeScale(4));
$('btn-tekrar').addEventListener('click', () => location.reload());
$('btn-dondur-gec').addEventListener('click', () => document.body.classList.add('dondur-gec'));

// Fizik paneli: geniş ekranda açık, telefonda kapalı başlar
const small = matchMedia('(max-width: 900px), (max-height: 520px)').matches;
function setPhysics(open) {
  document.body.dataset.fizik = open ? 'acik' : 'kapali';
  $('btn-fizik').setAttribute('aria-pressed', String(open));
}
setPhysics(!small);
$('btn-fizik').addEventListener('click', () => setPhysics(document.body.dataset.fizik !== 'acik'));
$('btn-fizik-kapat').addEventListener('click', () => setPhysics(false));

// Ses
sfx.setEnabled(settings.ses);
const unlock = () => sfx.unlock();
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

window.addEventListener('resize', () => {
  view.resize();
  rig.setVisibleWidth(map.gorunur);
});

const p = game.player;
rig.setFocus(p.x, p.y + 3);
rig.reset(true);
game.start();

startLoop({
  timeScale: () => game.timeScale,
  update: (dt) => game.update(dt),
  render: (frameDt) => {
    quality.tick();
    rig.update(frameDt, game.effects.shake);
    // Uzaklaşınca sis seyrelir, uzak atışlar görünür kalır
    view.scene.fog.density = baseFog * Math.min(1, rig.defaultDistance / Math.max(rig.distance, 1));
    game.render(frameDt);
    view.render(frameDt * Math.max(game.timeScale, 0.25));
  },
});

$('yukleniyor').classList.add('bitti');

// Tarayıcı konsolundan inceleme için
window.oyun = { game, rig, view };
