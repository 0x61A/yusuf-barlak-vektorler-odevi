// Oyunun tüm sabitleri tek yerde. Birim: 1 birim = 1 metre, açı = derece.

export const PROJE = {
  ad: 'Yusuf Barlak Vektörler Ödevi',
  ust: 'Yusuf Barlak',
  alt: 'Vektörler Ödevi',
};

export const KUNYE = {
  ad: 'Yusuf Barlak',
  okul: 'Sivas Cumhuriyet Üniversitesi',
  bolum: 'Mekatronik Bölümü',
  ders: 'Fizik I',
};

// Euler yönteminin sabit zaman adımı (s)
export const DT = 1 / 120;

export const GEZEGENLER = [
  { id: 'dunya', ad: 'Dünya', g: 9.81 },
  { id: 'ay', ad: 'Ay', g: 1.62 },
  { id: 'mars', ad: 'Mars', g: 3.71 },
  { id: 'jupiter', ad: 'Jüpiter', g: 24.79 },
];

// kutle: kg · yaricap: patlama yarıçapı (m) · hasar: merkezdeki hasar · renk: iz ve arayüz rengi
export const SILAHLAR = [
  { id: 'standart', ad: 'Standart', kutle: 10, yaricap: 5, hasar: 30, adet: Infinity, renk: 0x2f6fde },
  { id: 'agir', ad: 'Ağır', kutle: 30, yaricap: 9, hasar: 45, adet: 2, renk: 0xd9480f },
  { id: 'uclu', ad: 'Üçlü', kutle: 10, yaricap: 4, hasar: 15, adet: 2, aciFarki: 5, renk: 0x7048e8 },
  { id: 'sekme', ad: 'Sekme', kutle: 10, yaricap: 5, hasar: 30, adet: 3, e: 0.6, sekmeSayisi: 2, renk: 0x2b8a3e },
  { id: 'parcali', ad: 'Parçalı', kutle: 10, yaricap: 4, hasar: 14, adet: 2, parca: 4, parcaHiz: 7, renk: 0xc2255c },
];

// sigmaAci: derece · sigmaGuc: oran · ogrenme: her atışta hata çarpanındaki azalma
export const ZORLUKLAR = {
  kolay: { ad: 'Kolay', sigmaAci: 6, sigmaGuc: 0.1, ogrenme: 0, ozelSilah: 0.2 },
  orta: { ad: 'Orta', sigmaAci: 3, sigmaGuc: 0.05, ogrenme: 0.5, ozelSilah: 0.35 },
  zor: { ad: 'Zor', sigmaAci: 1, sigmaGuc: 0.02, ogrenme: 0.8, ozelSilah: 0.6 },
};

// genislik: oynanan alan · kenar: iki yanda görsel olarak devam eden arazi
export const HARITALAR = {
  savas: { genislik: 260, kenar: 170, adim: 0.5, guc: { min: 5, max: 55 }, tMax: 20, g: 9.81, gorunur: 120 },
  deney: { genislik: 4200, kenar: 200, adim: 2, guc: { min: 5, max: 80 }, tMax: 200, gorunur: 150, hedefler: [50, 100, 200, 400] },
};

// Krater profili: yatay yarıçap = genislik·r, derinlik = derinlik·r (r: patlama yarıçapı)
export const KRATER = { genislik: 1.35, derinlik: 0.7 };

export const TANK = {
  can: 100,
  yakit: 100,
  yakitMetre: 100 / 32, // 1 metre hareket kaç birim yakıt
  hiz: 7, // m/s, düz yolda
  yokusYavaslama: 0.3, // yokuşta hız = hiz·(1 − 0.3·eğim)
  minHizOrani: 0.45,
  maxEgim: 2.4, // bundan dik (≈67°) yere çıkılamaz
  vurulmaYaricap: 2.8,
  govdeYuksekligi: 1.3, // vurulma dairesinin zeminden yüksekliği
  pivotYuksekligi: 2.3, // namlu döner noktası
  namluBoyu: 3.4,
  yarimBoy: 3.1, // gövdenin yarı uzunluğu (engel teması için)
};

// Ağaç ve taşlar: hareketi yavaşlatır, mermiyi durdurur; ezilince veya vurulunca parçalanır.
// sertlik: tankın içinden geçmek için itmesi gereken süre (s)
export const ENGEL = {
  agac: { sayi: 9, sertlik: 0.7 },
  kaya: { sayi: 6, sertlik: 1.1 },
  bosluk: 14, // tank doğma noktalarına en az bu kadar uzak
  aralik: 9, // engeller arası en az mesafe
};

export const RENKLER = {
  oyuncu: 0x55752f, // yeşil
  npc: [0x8b5a2b, 0x2b2b2b], // kahverengi, siyah
  vektorV: 0xf08c00,
  vektorX: 0x1c7ed6,
  vektorY: 0xe03131,
};
