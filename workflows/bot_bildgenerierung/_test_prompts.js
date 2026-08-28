const fs = require('fs');
const dir = __dirname;
function readCfg() {
  const src = fs.readFileSync(dir + '/01_Restaurant-Konfiguration.js', 'utf8');
  return new Function('$input', src)({ first: () => ({ json: {} }) })[0].json;
}
const cfg = readCfg();
function build(file, ctx) {
  const src = fs.readFileSync(dir + '/' + file, 'utf8');
  const body = src.replace(/\$\('([^']+)'\)/g, 'CTX["$1"]').replace(/\$input/g, 'CTX["__input"]');
  return new Function('CTX', body)(ctx);
}
function ctxFor(post, auftrag, bm, saeule) {
  return {
    'Restaurant-Konfiguration': { first: () => ({ json: cfg }) },
    'Post aufbereiten': { first: () => ({ json: { post: post } }) },
    'Kontext': { first: () => ({ json: { saeule: saeule || 'angebote' } }) },
    'Auftrag': { first: () => ({ json: auftrag }) },
    'Bild-Modus': { first: () => ({ json: bm }) },
    'Logo laden': { first: () => ({ binary: { logo: {} } }) },
    '__input': { first: () => ({ binary: { basis: {} } }) }
  };
}
const basePost = { headline: 'Frisch aus dem Ofen', layout: 'klassik', bild_typ: 'produkt', bild_neu: false, bild_headline: 'FRISCH AUS DEM OFEN', image_brief: 'A thin-crust margherita pizza with basil, held by one hand over a brushed-steel counter', preis_text: '', archiv_foto_url: '' };
const faelle = [
  ['GEN produkt', '04_Bild-Request_bauen_Logo.js', Object.assign({}, basePost), { modus: 'neu' }, { anpassung: false }],
  ['GEN angebot + Preis', '04_Bild-Request_bauen_Logo.js', Object.assign({}, basePost, { bild_typ: 'angebot', layout: 'angebots_sticker', preis_text: '5,99 ' + String.fromCharCode(0x20ac), bild_headline: 'PIZZA DES TAGES' }), { modus: 'neu' }, { anpassung: false }],
  ['GEN flyer', '04_Bild-Request_bauen_Logo.js', Object.assign({}, basePost, { bild_typ: 'flyer', layout: 'event_poster', image_brief: 'An evening street festival in front of the pizzeria with string lights', bild_headline: 'STRASSENFEST AM SAMSTAG' }), { modus: 'neu' }, { anpassung: false }],
  ['GEN pur', '04_Bild-Request_bauen_Logo.js', Object.assign({}, basePost, { layout: 'pur', bild_headline: '' }), { modus: 'neu' }, { anpassung: false }],
  ['FOTO archiv', '03_Bild-Request_bauen_Foto.js', Object.assign({}, basePost, { archiv_foto_url: 'https://x/y.jpg' }), { modus: 'neu' }, { anpassung: false }],
  ['FOTO anpassung', '03_Bild-Request_bauen_Foto.js', Object.assign({}, basePost), { modus: 'aenderung', reason: 'Mach die Headline groesser und das Bild etwas heller' }, { anpassung: true }]
];
for (const [name, file, post, auftrag, bm] of faelle) {
  const out = build(file, ctxFor(post, auftrag, bm))[0].json;
  console.log('\n########## ' + name + '  (' + out.prompt_len + ' Zeichen, size ' + out.size + ')');
  console.log(out.prompt);
}
