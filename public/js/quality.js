// Grafik kalitesi: Yüksek / Orta / Düşük + FPS düşünce otomatik kademe indirme

export const QUALITY = {
  yuksek: { ad: 'Yüksek', dpr: 2, shadows: true, buildings: 1, clouds: true, decor: 1 },
  orta: { ad: 'Orta', dpr: 1.25, shadows: false, buildings: 0.7, clouds: true, decor: 0.7 },
  dusuk: { ad: 'Düşük', dpr: 0.85, shadows: false, buildings: 0.4, clouds: false, decor: 0.35 },
};

const ORDER = ['yuksek', 'orta', 'dusuk'];

export class QualityManager {
  // setting: 'otomatik' veya sabit kademe. onChange(level) kademe değişince çağrılır.
  constructor(setting, defaultLevel, onChange) {
    this.auto = setting === 'otomatik';
    this.level = this.auto ? defaultLevel : setting;
    this.onChange = onChange;
    this.frames = 0;
    this.time = 0;
    this.cooldown = 3;
  }

  get preset() {
    return QUALITY[this.level];
  }

  set(setting) {
    this.auto = setting === 'otomatik';
    if (!this.auto && setting !== this.level) {
      this.level = setting;
      this.onChange(this.level);
    }
  }

  // Her karede çağrılır. 2 s ortalama FPS < 40 ise bir kademe düşer (5 s bekleme).
  // Süre gerçek saatten ölçülür: oyun döngüsü kare süresini 0.1 s ile sınırladığı için
  // çok düşük FPS'te onun dt'si yavaş akar ve düşüş gecikir.
  tick() {
    const now = performance.now();
    const frameDt = this.last ? Math.min((now - this.last) / 1000, 1) : 0;
    this.last = now;
    if (!this.auto || document.hidden) return;
    if (this.cooldown > 0) {
      this.cooldown -= frameDt;
      return;
    }
    this.frames++;
    this.time += frameDt;
    if (this.time < 2) return;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    const i = ORDER.indexOf(this.level);
    if (fps < 40 && i < ORDER.length - 1) {
      this.level = ORDER[i + 1];
      this.cooldown = 5;
      this.onChange(this.level);
    }
  }
}
