#!/usr/bin/env node
// Prueft die Bausteine, bevor etwas zu einem Kunden geht.
//   node bot/pruefe.mjs
//
// 1. Jede Kundendatei laesst sich zu einem gueltigen Config-Node bauen.
// 2. Jeder erzeugte Code-Node ist syntaktisch gueltiges JavaScript.
// 3. Der Config-Node laeuft an allen sieben Wochentagen durch und liefert
//    eine aufgeloeste Plattform, ein Format und genau einen Buffer-Kanal.
// 4. Pizzarello aus dem Generator ist identisch mit dem gepflegten Live-Node
//    (Regressionsschutz fuer die Zerlegung in Branche + Kunde).

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(join(root, p), 'utf8');
let fehler = 0;
const sage = (ok, text) => { if (!ok) fehler++; console.log(`${ok ? 'OK  ' : 'FEHL'} ${text}`); };

const kanon = (o) => JSON.stringify(o, (k, v) =>
  (v && typeof v === 'object' && !Array.isArray(v))
    ? Object.keys(v).sort().reduce((a, x) => (a[x] = v[x], a), {}) : v);

const laufeConfig = (code, weekday) => {
  const now = { weekday, setZone: () => now };
  return new Function('$input', '$now', code)({ first: () => ({ json: {} }) }, now)[0].json;
};

// Jedes Branchen-Profil muss dieselbe Struktur haben wie gastronomie: gleiche
// Layout- und Guideline-Schluessel. Sonst laeuft der Prompt-Aufbau ins Leere,
// ohne dass ein Fehler auftritt.
const branchen = readdirSync(join(root, 'bot/template/branchen')).filter((f) => f.endsWith('.json'));
const leit = JSON.parse(lies('bot/template/branchen/gastronomie.json'));
const schluessel = (o) => Object.keys(o).sort().join(',');
for (const datei of branchen) {
  const b = JSON.parse(lies(`bot/template/branchen/${datei}`));
  const name = datei.replace(/\.json$/, '');
  sage(schluessel(b.layouts) === schluessel(leit.layouts), `${name}: dieselben acht Layouts`);
  sage(schluessel(b.bild_guideline) === schluessel(leit.bild_guideline), `${name}: dieselben Guideline-Bausteine`);
  sage(schluessel(b.bild_guideline.module) === schluessel(leit.bild_guideline.module), `${name}: dieselben Inhaltsmodule`);
  sage(schluessel(b.bild_guideline.stile) === schluessel(leit.bild_guideline.stile), `${name}: dieselben Stil-Familien`);
  const leer = Object.keys(b.layouts).filter((k) => !b.layouts[k].bild || !b.layouts[k].stil || !b.layouts[k].font);
  sage(leer.length === 0, `${name}: jedes Layout hat Beschreibung, Stil und Schrift${leer.length ? ' - fehlt bei ' + leer.join(', ') : ''}`);
}

const kunden = readdirSync(join(root, 'bot/kunden'))
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .map((f) => f.replace(/\.json$/, ''));

sage(kunden.length > 0, `${kunden.length} Kundendatei(en) gefunden: ${kunden.join(', ')}`);

for (const id of kunden) {
  try {
    execFileSync('node', [join(root, 'bot/build-kunde.mjs'), id], { cwd: root, stdio: 'pipe' });
    sage(true, `${id}: Generator laeuft durch`);
  } catch (e) {
    sage(false, `${id}: Generator bricht ab - ${String(e.stderr || e).slice(0, 200)}`);
    continue;
  }

  const konfig = lies(`bot/kunden/${id}/Restaurant-Konfiguration.js`);
  try { new Function('$input', '$now', konfig); sage(true, `${id}: Config-Node ist gueltiges JavaScript`); }
  catch (e) { sage(false, `${id}: Config-Node Syntaxfehler - ${e.message}`); continue; }

  let alleTage = true;
  for (let t = 1; t <= 7; t++) {
    try {
      const cfg = laufeConfig(konfig, t);
      if (!cfg.bild_size || !cfg.bild_format || !Array.isArray(cfg.buffer.kanaele)) alleTage = false;
      if (cfg.plattform && cfg.buffer.kanaele.length !== 1) alleTage = false;
    } catch (e) { alleTage = false; }
  }
  sage(alleTage, `${id}: Config liefert an allen sieben Wochentagen Plattform, Format und genau einen Kanal`);

  const nodes = join(root, `bot/kunden/${id}/nodes`);
  for (const d of readdirSync(nodes).filter((f) => /^[1-6]_/.test(f))) {
    try { new Function('$', '$input', '$now', `return (async()=>{${lies(`bot/kunden/${id}/nodes/${d}`)}})()`); }
    catch (e) { sage(false, `${id}/${d}: Syntaxfehler - ${e.message}`); }
  }
  try { JSON.parse(lies(`bot/kunden/${id}/nodes/7_Post-Schema.txt`)); sage(true, `${id}: Post-Schema ist gueltiges JSON`); }
  catch (e) { sage(false, `${id}: Post-Schema kein gueltiges JSON`); }
}

// Regressionsschutz: der gepflegte Live-Node und der generierte muessen gleich sein.
if (kunden.includes('pizzarello') && existsSync(join(root, 'bot/nodes/Restaurant-Konfiguration.js'))) {
  let gleich = true;
  for (let t = 1; t <= 7; t++) {
    const a = kanon(laufeConfig(lies('bot/nodes/Restaurant-Konfiguration.js'), t));
    const b = kanon(laufeConfig(lies('bot/kunden/pizzarello/Restaurant-Konfiguration.js'), t));
    if (a !== b) gleich = false;
  }
  sage(gleich, 'pizzarello: Generator-Ausgabe identisch mit dem gepflegten Live-Node');
}

console.log(fehler === 0 ? '\nAlles in Ordnung.' : `\n${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
