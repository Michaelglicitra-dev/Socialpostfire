#!/usr/bin/env node
// Rendert die fertigen Bild-Prompts fuer jedes Layout - direkt aus workflows/hauptflow.ts.
//
// Der Code der Nodes "Restaurant-Konfiguration" und "Gen-Request" wird aus der
// Workflow-Datei extrahiert und ausgefuehrt. Dadurch zeigt die Vorschau immer
// exakt den Prompt, den n8n spaeter an gpt-image-1 schickt - kein zweiter Ort,
// der auseinanderlaufen kann.
//
//   node tools/bildprompt_preview.mjs              -> alle Layouts in die Konsole
//   node tools/bildprompt_preview.mjs promo_poster -> nur ein Layout
//   node tools/bildprompt_preview.mjs --out prompts/  -> zusaetzlich als .txt
//   node tools/bildprompt_preview.mjs --foto        -> Foto-Pfad statt Neu-Generierung
//                                                      (Node "Kombi-Request", images/edits)

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'workflows', 'hauptflow.ts'), 'utf8');

/** Holt den jsCode-Block des Nodes mit dem angegebenen Namen aus der SDK-Datei. */
function nodeCode(name) {
  const at = src.indexOf(`name: '${name}',`);
  if (at === -1) throw new Error(`Node "${name}" nicht gefunden`);
  const open = src.indexOf('jsCode: `', at);
  if (open === -1) throw new Error(`jsCode fuer "${name}" nicht gefunden`);
  const start = open + 'jsCode: `'.length;
  const end = src.indexOf('` }', start);
  if (end === -1) throw new Error(`jsCode-Ende fuer "${name}" nicht gefunden`);
  // Template-Literal-Escapes aufloesen, so wie es der TS-Compiler tut
  return src.slice(start, end).replace(/\\`/g, '`').replace(/\\\$/g, '$').replace(/\\\\/g, '\\');
}

/** Fuehrt einen n8n-Code-Node aus; `items` stellt $('NodeName').first().json bereit. */
async function runNode(code, items, input = {}, binary = null) {
  const $ = (name) => {
    if (!(name in items)) throw new Error(`Testdaten fuer Node "${name}" fehlen`);
    return { first: () => ({ json: items[name] }) };
  };
  const $input = { first: () => ({ json: input, binary }) };
  // Stellt die n8n-Binaerhelfer nach, damit auch der Foto-Pfad durchlaeuft.
  const ctx = {
    helpers: {
      getBinaryDataBuffer: async () => Buffer.from('testfoto'),
      prepareBinaryData: async () => ({ mimeType: 'image/jpeg' })
    }
  };
  const fn = new Function('$', '$input', `return (async () => {\n${code}\n})();`);
  const out = await fn.call(ctx, $, $input);
  return out[0].json;
}

const cfg = await runNode(nodeCode('Restaurant-Konfiguration'), {}, {});

// Realistische Testdaten pro Layout - so, wie der Post-Agent sie liefern wuerde.
const faelle = {
  klassik: {
    saeule: 'angebote',
    post: { layout: 'klassik', bild_typ: 'produkt', preis_text: '',
      bild_headline: 'Frisch aus dem Ofen', bild_subline: 'Mortadella - Stracciatella - Pistazie',
      bild_infozeile: '', bild_cta: '',
      image_brief: 'A napoletana pizza with mortadella rosettes, stracciatella and pistachio, held on a dark wooden peel by two hands, shot slightly from above' }
  },
  promo_poster: {
    saeule: 'angebote',
    post: { layout: 'promo_poster', bild_typ: 'produkt', preis_text: '',
      bild_headline: 'NEUE SPECIALS', bild_subline: 'Infused Burrata',
      bild_infozeile: 'SEPTEMBER - OBERHAUSEN', bild_cta: '',
      image_brief: 'A napoletana pizza with rocket, shaved parmesan and a burrata ball in the centre, cropped large at the right edge against a near-black ground, three small infused burrata balls resting at the lower left' }
  },
  menue_karte: {
    saeule: 'saisonal',
    post: { layout: 'menue_karte', bild_typ: 'saison', preis_text: '',
      bild_headline: 'Herbst auf der Pizza', bild_subline: 'Steinpilz - Salsiccia - Thymian',
      bild_infozeile: '', bild_cta: '',
      image_brief: 'A whole autumn pizza with porcini mushrooms and salsiccia, seen straight top-down on a dark steel surface, raw porcini beside it' }
  },
  angebots_sticker: {
    saeule: 'angebote',
    post: { layout: 'angebots_sticker', bild_typ: 'angebot', preis_text: '7,90 EUR',
      bild_headline: 'Pizza der Woche', bild_subline: 'Nur Mittwoch bis Freitag',
      bild_infozeile: '', bild_cta: '',
      image_brief: 'A margherita pizza cropped large at the left edge, cheese pull caught in motion, deep black background' }
  },
  produkt_spotlight: {
    saeule: 'community',
    post: { layout: 'produkt_spotlight', bild_typ: 'angebot', preis_text: '',
      bild_headline: 'Hol dir den Familien-Abend', bild_subline: 'Vier Pizzen, ein Preis',
      bild_infozeile: '', bild_cta: 'Jetzt bestellen',
      image_brief: 'Several pizzas on a warm dark table seen from above, hands reaching in, warm evening light falling softly out of focus in the background' }
  },
  event_poster: {
    saeule: 'community',
    post: { layout: 'event_poster', bild_typ: 'flyer', preis_text: '',
      bild_headline: 'FESTA ITALIANA', bild_subline: 'Das Strassenfest vor der Pizzeria',
      bild_infozeile: 'SAMSTAG - FRIEDRICH-KARL-STRASSE', bild_cta: 'Tisch sichern',
      image_brief: 'An evening street party in front of an Italian pizzeria, string lights above the tables, guests softly out of focus, warm sunset sky behind the rooftops' }
  },
  pur: {
    saeule: 'saisonal',
    post: { layout: 'pur', bild_typ: 'produkt', preis_text: '',
      bild_headline: '', bild_subline: '', bild_infozeile: '', bild_cta: '',
      image_brief: 'A single napoletana pizza with a blistered leopard-spotted crust, straight top-down on a dark steel surface' }
  },
  zitat: {
    saeule: 'community',
    post: { layout: 'zitat', bild_typ: 'bts', preis_text: '',
      bild_headline: 'La pizza e vita', bild_subline: '', bild_infozeile: '', bild_cta: '',
      image_brief: 'Floured hands stretching a dough ball on a dark marble counter, warm directional light, oven flames blurred in the background' }
  }
};

const args = process.argv.slice(2);
const fotoModus = args.includes('--foto');
const outIdx = args.indexOf('--out');
const outDir = outIdx === -1 ? null : args[outIdx + 1];
const nurLayout = args.filter((a) => a !== '--out' && a !== outDir && a !== '--foto')[0];

// Neu-Generierung laeuft ueber "Gen-Request", ein mitgeschicktes Foto ueber "Kombi-Request".
const code = nodeCode(fotoModus ? 'Kombi-Request' : 'Gen-Request');

const layouts = Object.keys(faelle).filter((l) => !nurLayout || l === nurLayout);
if (!layouts.length) {
  console.error(`Unbekanntes Layout "${nurLayout}". Bekannt: ${Object.keys(faelle).join(', ')}`);
  process.exit(1);
}
if (outDir) mkdirSync(join(root, outDir), { recursive: true });

for (const layout of layouts) {
  const { saeule, post } = faelle[layout];
  const res = await runNode(code, {
    'Restaurant-Konfiguration': cfg,
    'Post aufbereiten': { post },
    'Kontext': { saeule }
  }, {}, fotoModus ? { data: { mimeType: 'image/jpeg', data: 'x' } } : null);
  const prompt = res.bild_prompt;
  const name = cfg.layouts[layout] ? cfg.layouts[layout].name : layout;
  const stil = cfg.layouts[layout] ? cfg.layouts[layout].stil : '?';
  const pfad = fotoModus ? 'Foto-Pfad (images/edits)' : 'Neu-Generierung (images/generations)';
  console.log(`\n${'='.repeat(78)}\n${layout}  (${name}, Stil: ${stil})  -  ${pfad}  -  ${prompt.length} Zeichen\n${'='.repeat(78)}\n${prompt}`);
  if (outDir) {
    const file = join(root, outDir, `${layout}${fotoModus ? '_foto' : ''}.txt`);
    writeFileSync(file, prompt + '\n', 'utf8');
    console.error(`  -> ${file}`);
  }
}
