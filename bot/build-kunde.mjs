#!/usr/bin/env node
// Baut aus einer Kundendatei plus Branchen-Profil den kompletten Workflow fuer einen Kunden.
//
//   node bot/build-kunde.mjs pizzarello          -> bot/kunden/pizzarello/
//   node bot/build-kunde.mjs pizzarello --pruefen -> nur vergleichen, nichts schreiben
//
// Erzeugt:
//   bot/kunden/<id>/Restaurant-Konfiguration.js   Config-Node zum Einspielen
//   bot/kunden/<id>/<Name>.import.json            kompletter Workflow zum Importieren
//   bot/kunden/<id>/nodes/*.txt                   alle Nodes als Textdatei
//
// Kundenspezifisch getauscht werden: Config-Node, alle sechs Data-Table-IDs,
// die Telegram-Chat-ID und der Workflow-Name.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(join(root, p), 'utf8');
const liesJson = (p) => JSON.parse(lies(p));

const kundeId = process.argv[2];
const nurPruefen = process.argv.includes('--pruefen');
if (!kundeId) {
  console.error('Aufruf: node bot/build-kunde.mjs <kunden-id> [--pruefen]');
  process.exit(1);
}

const kunde = liesJson(`bot/kunden/${kundeId}.json`);
const branche = liesJson(`bot/template/branchen/${kunde.branche}.json`);
const { formate } = liesJson('bot/template/formate.json');

// ---- Pflichtfelder pruefen, bevor irgendetwas erzeugt wird ------------------------
const fehlt = [];
const pruefe = (pfad) => {
  const wert = pfad.split('.').reduce((o, k) => (o == null ? o : o[k]), kunde);
  if (wert == null || wert === '') fehlt.push(pfad);
  return wert;
};
['id', 'branche', 'stammdaten.name', 'stammdaten.website', 'marke.logo_url',
 'marke.brand_farben.akzent', 'telegram.chat_id', 'buffer.organizationId',
 'n8n.workflow_name'].forEach(pruefe);
for (const t of ['sessions', 'speisekarte', 'angebote', 'fotos', 'learnings', 'post_log']) {
  const v = (kunde.n8n && kunde.n8n.data_tables || {})[t];
  if (!v || String(v).startsWith('<')) fehlt.push(`n8n.data_tables.${t}`);
}
if (fehlt.length) {
  console.error(`Kundendatei unvollstaendig - fehlende Felder:\n  ${fehlt.join('\n  ')}`);
  process.exit(1);
}

// ---- Config-Node aus dem Template bauen ------------------------------------------
const konfig = lies('bot/template/Restaurant-Konfiguration.template.js')
  .replace('__KUNDE_ID__', kunde.id)
  .replace('__BRANCHE_ID__', kunde.branche)
  .replace('__KUNDE__', JSON.stringify(kunde, null, 2))
  .replace('__BRANCHE__', JSON.stringify({ bild_guideline: branche.bild_guideline, layouts: branche.layouts }, null, 2))
  .replace('__FORMATE__', JSON.stringify(formate, null, 2));

// ---- Workflow-JSON patchen --------------------------------------------------------
const wf = liesJson('bot/live/Pizzarello-Bot-v3.import.json');
const nodeVon = (name) => {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Node "${name}" fehlt in der Vorlage`);
  return n;
};
nodeVon('Restaurant-Konfiguration').parameters.jsCode = konfig.replace(/\n$/, '');

// Data-Table-IDs: die Vorlage traegt Pizzarellos IDs, sie werden ueber den
// cachedResultName zugeordnet und durch die des Kunden ersetzt.
const vorlageTabellen = {
  pizzarello_sessions: 'sessions', pizzarello_speisekarte: 'speisekarte',
  pizzarello_angebote: 'angebote', pizzarello_fotos: 'fotos',
  pizzarello_learnings: 'learnings', pizzarello_post_log: 'post_log'
};
let tabellenGesetzt = 0;
const gehDurch = (o) => {
  if (o == null || typeof o !== 'object') return;
  if (o.cachedResultName && vorlageTabellen[o.cachedResultName]) {
    const rolle = vorlageTabellen[o.cachedResultName];
    o.value = kunde.n8n.data_tables[rolle];
    o.cachedResultName = `${kunde.id}_${rolle}`;
    tabellenGesetzt++;
    return;
  }
  for (const k of Object.keys(o)) gehDurch(o[k]);
};
wf.nodes.forEach((n) => gehDurch(n.parameters));

// Telegram-Chat-ID ueberall ersetzen (Config-Node ist schon erneuert)
const altChatId = '7582948490';
let chatIdGesetzt = 0;
const ersetzeChatId = (o) => {
  if (o == null || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    if (typeof o[k] === 'string' && o[k].includes(altChatId)) {
      o[k] = o[k].split(altChatId).join(String(kunde.telegram.chat_id));
      chatIdGesetzt++;
    } else gehDurchChat(o[k]);
  }
};
const gehDurchChat = (o) => ersetzeChatId(o);
wf.nodes.forEach((n) => { if (n.name !== 'Restaurant-Konfiguration') ersetzeChatId(n.parameters); });

wf.name = kunde.n8n.workflow_name;

if (nurPruefen) {
  console.log(`Pruefung ${kunde.id}: ${tabellenGesetzt} Tabellen-Referenzen, ${chatIdGesetzt} Chat-ID-Stellen, ${wf.nodes.length} Nodes.`);
  process.exit(0);
}

const ziel = `bot/kunden/${kunde.id}`;
mkdirSync(join(root, ziel, 'nodes'), { recursive: true });
writeFileSync(join(root, ziel, 'Restaurant-Konfiguration.js'), konfig, 'utf8');
writeFileSync(join(root, ziel, `${kunde.n8n.workflow_name.replace(/\s+/g, '-')}.import.json`), JSON.stringify(wf, null, 2) + '\n', 'utf8');

// Alle Code-Nodes zusaetzlich als Textdatei, zum Einspielen von Hand
const einspielen = [
  ['Restaurant-Konfiguration', '1_Restaurant-Konfiguration'], ['Post aufbereiten', '2_Post-aufbereiten'],
  ['Router', '3_Router'], ['Bild-Request bauen (Neu)', '4_Bild-Request-bauen-Neu'],
  ['Bild-Request bauen (Foto)', '5_Bild-Request-bauen-Foto'], ['Logo buendeln', '6_Logo-buendeln']
];
for (const [node, datei] of einspielen) {
  writeFileSync(join(root, ziel, 'nodes', `${datei}.txt`), nodeVon(node).parameters.jsCode + '\n', 'utf8');
}
writeFileSync(join(root, ziel, 'nodes', '7_Post-Schema.txt'), nodeVon('Post-Schema').parameters.jsonSchemaExample + '\n', 'utf8');
writeFileSync(join(root, ziel, 'nodes', '8_Post-Agent-SystemMessage.txt'), nodeVon('Post-Agent').parameters.options.systemMessage + '\n', 'utf8');

console.log(`${ziel}/`);
console.log(`  Workflow "${wf.name}": ${wf.nodes.length} Nodes`);
console.log(`  ${tabellenGesetzt} Data-Table-Referenzen auf ${kunde.id} gesetzt`);
console.log(`  ${chatIdGesetzt} Stellen mit Telegram-Chat-ID ${kunde.telegram.chat_id}`);
console.log(`  Branche: ${branche.name} (${Object.keys(branche.layouts).length} Layouts)`);
