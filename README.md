# Yusuf Barlak Vektörler Ödevi

Fizik I dersi projesi: eğik atış fiziğiyle sıra tabanlı, 3D tank oyunu (gündüz, çimenli tepeler, ağaç ve taşlar).
Açıyı ve hızı ayarla, hız vektörünü `Vx = V·cosθ`, `Vy = V·sinθ` bileşenlerine ayır,
mermiyi Euler yöntemiyle yerçekimine bırak ve NPC rakibi vur.

**Hazırlayan:** Yusuf Barlak — Sivas Cumhuriyet Üniversitesi, Mekatronik Bölümü — Fizik I

## Sayfalar

| Sayfa | İçerik |
|---|---|
| `index.html` | Ana menü: savaş kurulumu (1–2 NPC, Kolay/Orta/Zor), deney modu, kontroller, ayarlar |
| `oyun.html?mod=savas&npc=1&zorluk=orta` | Savaş: sıra tabanlı, yakıtla hareket, 5 silah, yıkılabilir arazi, kırılan ağaç ve taşlar |
| `oyun.html?mod=deney` | Laboratuvar: rakipsiz, gezegen (g) seçimi, hedefler, atış tablosu, izler |
| `fizik.html` | Fizik anlatımı: türetimler, Euler hata analizi, sekme, momentum, NPC denklemi |

## Çalıştırma

Gereken tek şey Node.js (bağımlılık yok, `npm install` gerekmez).

```bash
npm run dev
```

Tarayıcıda `http://localhost:8080` adresini aç. Dosyalar ES modülü olduğu için
`index.html`'e çift tıklamak çalışmaz; yerel sunucu gerekir.

Fizik testleri (Euler menzili, tümler açılar, sekme, momentum, NPC çözücü, krater):

```bash
npm test
```

## Kontroller

| İşlem | Klavye / fare | Dokunmatik |
|---|---|---|
| Hareket | `A` `D` / `←` `→` | ◀ ▶ düğmeleri |
| Açı θ | `W` `S` / `↑` `↓` (Shift: 0.1°) | Kaydırıcı, sayı kutusu |
| Hız V | `Q` `E` (Shift: 0.1) | Kaydırıcı, sayı kutusu |
| Sapan nişanı | Sol tıkla geriye sürükle | Tek parmakla geriye sürükle |
| Silah | `1`–`5` | Silah düğmeleri |
| Ateş | `Space` | ATEŞ |
| Zoom | Tekerlek, `+` `−` | İki parmakla sıkıştır |
| Kamera | Sağ tık: döndür · Orta tık: kaydır · `R`: sıfırla | İki parmakla döndür |
| Haritanın tamamı | `M` | Üstteki harita düğmesi |
| Ağır çekim / hızlı ileri | `T` (×0.25) / `F` (×4, deney modu) | Üst araç çubuğu |
| Duraklat (ayarlar, ses) | `Esc` | Sağ üstteki ❚❚ düğmesi |

Ağaç ve taşlar mermiyi durdurur ve vurulunca parçalanır. Tank üstlerine sürünce
bir süre durup iter (ekstra yakıt harcar), sonra kırıp geçer. Yokuşta tank yavaşlar;
kraterler yayvan çanak şeklindedir, zorlansa da çıkılabilir.

## Fizik nerede?

| Konu | Dosya |
|---|---|
| Vektör ayrıştırma `fromPolar`, yansıma `reflect` | `public/js/physics/vec2.js` |
| İleri Euler adımı, çarpışma, sekme, parçalanma | `public/js/physics/projectile.js` |
| Arazi `h(x)`, eğim, normal, kosinüs profilli krater | `public/js/physics/heightmap.js` |
| NPC nişan denklemi + sayısal iyileştirme | `public/js/physics/ballistics.js` |
| Tüm sabitler (g, Δt, silahlar, zorluk, künye) | `public/js/config.js` |

Önizleme çizgisi, NPC hesabı ve gerçek atış aynı Euler fonksiyonunu kullanır;
ekranda görülen yol merminin izleyeceği yolun aynısıdır. Δt = 1/120 s sabittir.

## Firebase'de yayınlama

Canlı adres: **https://yusuf-barlak-vektorler-odevi.web.app**

Site, `atlas-studio-dijital` Firebase projesinin içinde ayrı bir Hosting sitesi olarak duruyor
(hesaptaki yeni proje kotası dolu olduğu için). `firebase.json` içindeki `"site"` ayarı,
yayının yalnızca bu siteye gitmesini sağlar; projenin diğer sitelerine dokunulmaz.

Değişiklikten sonra yeniden yayınlamak için:

```bash
npm test
```

```bash
firebase deploy --only hosting:yusuf-barlak-vektorler-odevi
```

## Klasör yapısı

```
public/
  index.html  oyun.html  fizik.html
  css/        base.css (tokenlar) · hud.css · menu.css · fizik.css
  js/
    config.js  settings.js  quality.js  main.js  menu.js
    physics/   vec2 · heightmap · projectile · ballistics   (three.js'ten bağımsız, test edilir)
    world/     scene · terrain · tank · obstacles · effects · vectors   (three.js görselleri)
    core/      game (sıra durum makinesi) · loop (sabit adımlı döngü)
    ai/        npc        ui/  hud · physicsPanel · input
    camera/    rig        audio/  sfx (Web Audio ile üretilen sesler)
    fizik/     plot (fizik sayfası grafikleri)
  vendor/      three.js r186 (+ OrbitControls), KaTeX 0.19 (yerel kopya, MIT lisansı)
tests/         physics.test.mjs
scripts/       serve.mjs (yerel sunucu)
```

## Lisanslar

three.js ve KaTeX MIT lisanslıdır; lisans metinleri `public/vendor/*/LICENSE` içinde.
Sesler kodla üretilir, dış ses/görsel dosyası kullanılmaz.
