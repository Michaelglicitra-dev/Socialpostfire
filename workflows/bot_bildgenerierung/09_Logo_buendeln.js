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
return [{ json: {
  logo_box_breite: boxB,
  logo_box_hoehe: boxH,
  logo_x: rand,
  logo_y: bildH - rand - boxH,
  bild_breite: bildB,
  bild_hoehe: bildH
}, binary: binary }];
