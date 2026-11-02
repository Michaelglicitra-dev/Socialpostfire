const inp = $input.first().json || {};
// Erzeugt von bot/build-kunde.mjs - NICHT von Hand aendern.
// Kundendaten: bot/kunden/__KUNDE_ID__.json
// Branchen-Profil (Bildsprache): bot/template/branchen/__BRANCHE_ID__.json
const KUNDE = __KUNDE__;
const BRANCHE = __BRANCHE__;
const FORMATE = __FORMATE__;

const cfg = {
  restaurant: {
    name: KUNDE.stammdaten.name,
    kueche: KUNDE.stammdaten.kueche,
    standort: KUNDE.stammdaten.standort,
    telefon: KUNDE.stammdaten.telefon,
    website: KUNDE.stammdaten.website,
    oeffnungszeiten: KUNDE.stammdaten.oeffnungszeiten,
    ton: KUNDE.stammdaten.ton,
    brand_farben: KUNDE.marke.brand_farben,
    bild_guideline: BRANCHE.bild_guideline
  },
  layouts: BRANCHE.layouts,
  logo_url: KUNDE.marke.logo_url,
  logo_layout: KUNDE.marke.logo_layout,
  formate: FORMATE,
  plattformen: KUNDE.plattformen,
  plattform_rotation: KUNDE.plattform_rotation,
  saeulen_rotation: KUNDE.saeulen_rotation,
  hashtags: KUNDE.hashtags,
  telegram_chat_id: KUNDE.telegram.chat_id,
  buffer: {
    organizationId: KUNDE.buffer.organizationId,
    posting_zeit: KUNDE.buffer.posting_zeit,
    pinterest_url: KUNDE.buffer.pinterest_url
  }
};

// ---- Plattform des Tages aufloesen -------------------------------------------------
// Ein Post geht an genau EINE Plattform. Der Wochentag entscheidet, welche. Ist die
// vorgesehene Plattform nicht scharf geschaltet (kein channelId), wird die naechste
// aktive genommen, damit der Tagespost nicht ins Leere laeuft.
const heute = $now.setZone('Europe/Berlin');
function istAktiv(p) { return p && p.aktiv && p.channelId && String(p.channelId).indexOf('<') === -1; }
const alle = cfg.plattformen || {};
const reihenfolge = Object.keys(alle);
let plattform = alle[(cfg.plattform_rotation || {})[String(heute.weekday)] || reihenfolge[0]];
if (!istAktiv(plattform)) {
  const start = reihenfolge.indexOf(plattform ? plattform.key : reihenfolge[0]);
  plattform = null;
  for (let i = 1; i <= reihenfolge.length && !plattform; i++) {
    const kand = alle[reihenfolge[(Math.max(start, 0) + i) % reihenfolge.length]];
    if (istAktiv(kand)) plattform = kand;
  }
}
const format = (cfg.formate || {})[(plattform && plattform.bild_format) || 'quadrat'] || cfg.formate.quadrat;

cfg.plattform = plattform || null;
cfg.bild_format = format;
cfg.bild_size = format.gen;
// Die nachgelagerten Nodes erwarten weiterhin eine Kanal-Liste - sie enthaelt jetzt
// genau die eine Plattform des Tages. "format: vertical" loest die vorhandene
// 9:16-Ableitung nach der Freigabe aus.
cfg.buffer.kanaele = plattform ? [{
  key: plattform.key,
  name: plattform.name,
  channelId: plattform.channelId,
  aktiv: true,
  format: format.vertikal ? 'vertical' : 'master',
  tags: plattform.tags
}] : [];
return [{ json: Object.assign({}, inp, cfg) }];
