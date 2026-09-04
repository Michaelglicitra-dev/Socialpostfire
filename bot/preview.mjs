#!/usr/bin/env node
// Rendert die fertigen Bild-Prompts des Live-Bots aus den Node-Dateien in bot/nodes/.
// Fuehrt den echten Node-Code aus, damit die Vorschau nicht vom Workflow abweichen kann.
//
//   node bot/preview.mjs                    -> alle Layouts, Neu-Generierung
//   node bot/preview.mjs promo_poster       -> nur ein Layout
//   node bot/preview.mjs --foto             -> Foto-Pfad (Node "Bild-Request bauen (Foto)")
//   node bot/preview.mjs --out bot/prompts/ -> zusaetzlich als .txt ablegen

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (n) => readFileSync(join(root, 'bot', 'nodes', n), 'utf8');

async function runNode(code, items, input = {}, binary = null) {
  const $ = (name) => {
    if (!(name in items)) throw new Error(`Testdaten fuer Node "${name}" fehlen`);
    return { first: () => ({ json: items[name] }) };
  };
  const $input = { first: () => ({ json: input, binary }), all: () => [{ json: input }] };
  const ctx = {
    helpers: {
      // 1x1-PNG, damit die Dateityp-Pruefung im Foto-Node echt durchlaeuft
      getBinaryDataBuffer: async () => Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a4944415478' +
        '9c6300010000050001' + '0d0a2db4' + '00000000049454e44ae426082', 'hex')
    }
  };
  const fn = new Function('$', '$input', `return (async () => {\n${code}\n})();`);
  const out = await fn.call(ctx, $, $input);
  return out[0].json;
}

const cfg = await runNode(lies('Restaurant-Konfiguration.js'), {}, {});

const faelle = {
  klassik: { saeule: 'angebote', bild_typ: 'produkt', preis: '', headline: 'Frisch aus dem Ofen',
    subline: 'Mortadella - Stracciatella - Pistazie', info: '', cta: '',
    brief: 'A napoletana pizza with mortadella rosettes, stracciatella and pistachio, held on a dark peel by two hands, shot slightly from above' },
  promo_poster: { saeule: 'angebote', bild_typ: 'produkt', preis: '', headline: 'NEUE SPECIALS',
    subline: 'Infused Burrata', info: 'SEPTEMBER SPECIAL', cta: '',
    brief: 'A napoletana pizza with rocket, shaved parmesan and a burrata ball, cropped large at the right edge against a near-black ground' },
  menue_karte: { saeule: 'saisonal', bild_typ: 'saison', preis: '', headline: 'Herbst auf der Pizza',
    subline: 'Steinpilz - Salsiccia - Thymian', info: '', cta: '',
    brief: 'A whole autumn pizza with porcini and salsiccia, straight top-down on a dark steel surface, raw porcini beside it' },
  angebots_sticker: { saeule: 'angebote', bild_typ: 'angebot', preis: '7,90 EUR', headline: 'Pizza der Woche',
    subline: 'Nur Mittwoch bis Freitag', info: '', cta: '',
    brief: 'A margherita cropped large at the left edge, cheese pull caught in motion, deep black background' },
  produkt_spotlight: { saeule: 'community', bild_typ: 'angebot', preis: '', headline: 'Der Familien-Abend',
    subline: 'Vier Pizzen, ein Preis', info: '', cta: 'Jetzt bestellen',
    brief: 'Several pizzas on a warm dark table seen from above, hands reaching in, warm evening light out of focus behind' },
  event_poster: { saeule: 'community', bild_typ: 'flyer', preis: '', headline: 'FESTA ITALIANA',
    subline: 'Das Strassenfest vor der Pizzeria', info: 'SAMSTAG - FRIEDRICH-KARL-STRASSE', cta: 'Tisch sichern',
    brief: 'An evening street party in front of an Italian pizzeria, string lights above the tables, guests softly out of focus, warm sunset sky' },
  pur: { saeule: 'saisonal', bild_typ: 'produkt', preis: '', headline: '', subline: '', info: '', cta: '',
    brief: 'A single napoletana pizza with a blistered leopard-spotted crust, straight top-down on a dark steel surface' },
  zitat: { saeule: 'community', bild_typ: 'bts', preis: '', headline: 'La pizza e vita', subline: '', info: '', cta: '',
    brief: 'Floured hands stretching a dough ball on a dark counter, warm directional light, oven flames blurred behind' }
};

const args = process.argv.slice(2);
const foto = args.includes('--foto');
const outIdx = args.indexOf('--out');
const outDir = outIdx === -1 ? null : args[outIdx + 1];
const nur = args.filter((a) => a !== '--out' && a !== outDir && a !== '--foto')[0];
const code = lies(foto ? 'Bild-Request-bauen-Foto.js' : 'Bild-Request-bauen-Neu.js');

const layouts = Object.keys(faelle).filter((l) => !nur || l === nur);
if (!layouts.length) { console.error(`Unbekanntes Layout "${nur}". Bekannt: ${Object.keys(faelle).join(', ')}`); process.exit(1); }
if (outDir) mkdirSync(join(root, outDir), { recursive: true });

for (const layout of layouts) {
  const c = faelle[layout];
  const post = { layout, bild_typ: c.bild_typ, preis_text: c.preis, bild_headline: c.headline,
    bild_subline: c.subline, bild_infozeile: c.info, bild_cta: c.cta, image_brief: c.brief };
  const items = {
    'Restaurant-Konfiguration': cfg,
    'Post aufbereiten': { post },
    'Kontext': { saeule: c.saeule },
    'Auftrag': { reason: '' },
    'Bild-Modus': { anpassung: false, base_url: 'https://example.invalid/foto.png' }
  };
  const res = await runNode(code, items, {}, foto ? { basis: { mimeType: 'image/png', fileName: 'basis.png' } } : null);
  const prompt = res.openai_gen_body ? res.openai_gen_body.prompt : res.prompt;
  const l = cfg.layouts[layout] || {};
  console.log(`\n${'='.repeat(78)}\n${layout}  (${l.name}, Stil: ${l.stil}, Schrift: ${l.font})  -  ${foto ? 'Foto-Pfad' : 'Neu-Generierung'}  -  ${prompt.length} Zeichen  -  ${res.size}\n${'='.repeat(78)}\n${prompt}`);
  if (outDir) {
    const file = join(root, outDir, `${layout}${foto ? '_foto' : ''}.txt`);
    writeFileSync(file, prompt + '\n', 'utf8');
    console.error(`  -> ${file}`);
  }
}
