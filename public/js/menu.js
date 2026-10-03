// Ana menü: maç ayarları, kontroller, ayarlar ve künye popup'ları.

import { KUNYE } from './config.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
let settings = loadSettings();

// ---------- Künye ----------
$('kunye').innerHTML = `<span>Hazırlayan: <b>${KUNYE.ad}</b></span><span>${KUNYE.okul}</span><span>${KUNYE.bolum}</span><span>${KUNYE.ders}</span>`;

for (const b of document.querySelectorAll('[data-kapat]')) b.addEventListener('click', () => b.closest('dialog').close());

// ---------- Maç ayarları ----------
const savas = $('savas-dlg');
$('btn-savas').addEventListener('click', () => {
  savas.querySelector(`input[name="npc"][value="${settings.npc}"]`).checked = true;
  savas.querySelector(`input[name="zorluk"][value="${settings.zorluk}"]`).checked = true;
  savas.showModal();
});
savas.addEventListener('close', () => {
  if (savas.returnValue !== 'basla') return;
  const form = new FormData($('savas-form'));
  const npc = Number(form.get('npc')) === 2 ? 2 : 1;
  const zorluk = String(form.get('zorluk'));
  settings = saveSettings({ npc, zorluk });
  location.href = `oyun.html?mod=savas&npc=${npc}&zorluk=${encodeURIComponent(zorluk)}`;
});

// ---------- Nasıl oynanır ----------
$('btn-nasil').addEventListener('click', () => $('nasil-dlg').showModal());

// ---------- Ayarlar ----------
const ayar = $('ayar-dlg');
$('btn-ayar').addEventListener('click', () => {
  ayar.querySelector(`input[name="kalite"][value="${settings.kalite}"]`).checked = true;
  ayar.querySelector(`input[name="ses"][value="${settings.ses ? 'acik' : 'kapali'}"]`).checked = true;
  ayar.showModal();
});
ayar.addEventListener('change', (e) => {
  if (e.target.name === 'kalite') settings = saveSettings({ kalite: e.target.value });
  if (e.target.name === 'ses') settings = saveSettings({ ses: e.target.value === 'acik' });
});
