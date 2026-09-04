const cfg = $('Restaurant-Konfiguration').first().json;
const lay = cfg.logo_layout || {};
const boxB = Number(lay.box_breite || 420);
const boxH = Number(lay.box_hoehe || 200);
const rand = Number(lay.rand || 64);
const masse = String(cfg.bild_size || '1024x1536').split('x');
const bildB = Number(masse[0] || 1024);
const bildH = Number(masse[1] || 1536);
const logoBin = $('Logo laden').first().binary || {};
const inBin = $input.first().binary || {};
if (!inBin.data) throw new Error('Kein Basisbild fuer das Logo-Overlay');
if (!logoBin.logo) throw new Error('Logo-Binary fehlt fuer das Overlay');
const binary = { data: inBin.data, logo: logoBin.logo };
// Der Preis-Badge sass bisher auf festen Y-Werten, die nur zu 1024x1536 passten.
// Seit die Leinwand je Plattform variiert, kommen die Werte von hier - als Abstand
// von der Unterkante, damit der Badge immer unten rechts sitzt.
return [{ json: {
  logo_box_breite: boxB,
  logo_box_hoehe: boxH,
  logo_x: rand,
  logo_y: bildH - rand - boxH,
  bild_breite: bildB,
  bild_hoehe: bildH,
  badge_x: bildB - 172,
  badge_mitte_y: bildH - 172,
  badge_aussen_y: bildH - 320,
  badge_innen_y: bildH - 308,
  badge_nur_x: bildB - 198,
  badge_nur_y: bildH - 209,
  badge_preis_y: bildH - 116
}, binary: binary }];
