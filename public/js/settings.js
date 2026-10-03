// Kullanıcı tercihleri (tarayıcıda saklanır; erişilemezse varsayılanlar kullanılır)

const KEY = 'vektorlerOdevi.ayarlar.v1';

const DEFAULTS = {
  kalite: 'otomatik', // otomatik | yuksek | orta | dusuk
  ses: true,
  zorluk: 'orta',
  npc: 1,
};

// Depodan gelen değerler beyaz listeyle doğrulanır; bozuk/oynanmış veri varsayılana döner
const VALID = {
  kalite: ['otomatik', 'yuksek', 'orta', 'dusuk'],
  zorluk: ['kolay', 'orta', 'zor'],
  npc: [1, 2],
  ses: [true, false],
};

export function loadSettings() {
  let stored = {};
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) stored = JSON.parse(raw) ?? {};
  } catch {
    stored = {};
  }
  const out = { ...DEFAULTS };
  for (const key of Object.keys(VALID)) {
    if (VALID[key].includes(stored[key])) out[key] = stored[key];
  }
  return out;
}

export function saveSettings(patch) {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // depolama kapalı: sadece bu oturum için geçerli
  }
  return next;
}

export const isTouchDevice = () => matchMedia('(pointer: coarse)').matches;
