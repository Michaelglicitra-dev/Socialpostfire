#!/usr/bin/env node
// Baut aus dem Live-Snapshot und den Node-Dateien eine importierbare Workflow-JSON.
//
//   node bot/build-workflow-json.mjs
//
// Der Snapshot (bot/live/Pizzarello-Bot.workflow.json) bleibt unberuehrt; erzeugt wird
// bot/live/Pizzarello-Bot-v3.import.json. Serverseitige Felder (id, versionId, active,
// scopes, ...) werden entfernt, damit der Import einen frischen Workflow anlegt.
//
// ACHTUNG: Der Snapshot enthaelt KEINE Credentials - die n8n-API liefert sie nicht aus.
// Nach dem Import muessen alle Credentials neu zugeordnet werden.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lies = (p) => readFileSync(join(root, p), 'utf8');
const wf = JSON.parse(lies('bot/live/Pizzarello-Bot.workflow.json'));

const nodeVon = (name) => {
  const n = wf.nodes.find((x) => x.name === name);
  if (!n) throw new Error(`Node "${name}" fehlt im Snapshot`);
  return n;
};

let angewendet = 0;
const setzeCode = (name, datei) => {
  const n = nodeVon(name);
  const neu = lies(`bot/nodes/${datei}`).replace(/\n$/, '');
  if (typeof n.parameters.jsCode !== 'string') throw new Error(`${name}: kein jsCode-Feld`);
  n.parameters.jsCode = neu;
  angewendet++;
};

setzeCode('Restaurant-Konfiguration', 'Restaurant-Konfiguration.js');
setzeCode('Post aufbereiten', 'Post-aufbereiten.js');
setzeCode('Bild-Request bauen (Neu)', 'Bild-Request-bauen-Neu.js');
setzeCode('Bild-Request bauen (Foto)', 'Bild-Request-bauen-Foto.js');
setzeCode('Logo buendeln', 'Logo-buendeln.js');

const schema = nodeVon('Post-Schema');
schema.parameters.jsonSchemaExample = lies('bot/nodes/Post-Schema.jsonSchemaExample.txt').trim();
JSON.parse(schema.parameters.jsonSchemaExample);
angewendet++;

const agent = nodeVon('Post-Agent');
agent.parameters.options = agent.parameters.options || {};
agent.parameters.options.systemMessage = lies('bot/nodes/Post-Agent.systemMessage.txt').replace(/\n$/, '');
angewendet++;

// Preis-Badge: feste Y-Werte fuer 1024x1536 -> Abstand von der Unterkante.
// Bei 1024x1536 liefern die Ausdruecke exakt die bisherigen Zahlen.
const ref = (feld) => `={{ $('Logo buendeln').first().json.${feld} }}`;
const badge = nodeVon('Preis-Badge stempeln').parameters.operations.operations;
const erwartet = [
  { i: 0, feld: 'startPositionY', alt: 1364, neu: 'badge_mitte_y' },
  { i: 0, feld: 'endPositionY', alt: 1216, neu: 'badge_aussen_y' },
  { i: 1, feld: 'startPositionY', alt: 1364, neu: 'badge_mitte_y' },
  { i: 1, feld: 'endPositionY', alt: 1228, neu: 'badge_innen_y' },
  { i: 0, feld: 'startPositionX', alt: 852, neu: 'badge_x' },
  { i: 0, feld: 'endPositionX', alt: 852, neu: 'badge_x' },
  { i: 1, feld: 'startPositionX', alt: 852, neu: 'badge_x' },
  { i: 1, feld: 'endPositionX', alt: 852, neu: 'badge_x' },
  { i: 2, feld: 'positionY', alt: 1327, neu: 'badge_nur_y' },
  { i: 2, feld: 'positionX', alt: 826, neu: 'badge_nur_x' },
  { i: 3, feld: 'positionY', alt: 1420, neu: 'badge_preis_y' }
];
for (const e of erwartet) {
  const op = badge[e.i];
  if (op[e.feld] !== e.alt) throw new Error(`Preis-Badge Operation ${e.i}.${e.feld}: erwartet ${e.alt}, gefunden ${op[e.feld]}`);
  op[e.feld] = ref(e.neu);
  angewendet++;
}
// Der X-Wert des Preistextes rechnet mit fester Bildmitte 852 -> an die Leinwand binden.
const preisOp = badge[3];
if (typeof preisOp.positionX !== 'string' || preisOp.positionX.indexOf('852') === -1) {
  throw new Error('Preis-Badge: X-Ausdruck des Preistextes sieht anders aus als erwartet');
}
preisOp.positionX = preisOp.positionX.replace(
  'return Math.round(852 - w / 2);',
  "return Math.round($('Logo buendeln').first().json.badge_x - w / 2);"
);
angewendet++;

// Nur die Felder behalten, die ein Import braucht.
const raus = {
  name: 'Pizzarello Bot v3',
  nodes: wf.nodes.map((n) => { const { webhookId, ...rest } = n; return rest; }),
  connections: wf.connections,
  settings: wf.settings,
  meta: wf.meta,
  pinData: {}
};

if (angewendet !== 19) throw new Error(`Nur ${angewendet} von 19 Aenderungen angewendet`);
if (raus.nodes.length !== wf.nodes.length) throw new Error('Node-Anzahl veraendert');

const ziel = 'bot/live/Pizzarello-Bot-v3.import.json';
writeFileSync(join(root, ziel), JSON.stringify(raus, null, 2) + '\n', 'utf8');
console.log(`${ziel}: ${raus.nodes.length} Nodes, ${Object.keys(raus.connections).length} Verbindungen, ${angewendet} Aenderungen angewendet`);
