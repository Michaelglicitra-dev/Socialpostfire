// Erzeugt aus dem Live-JSON des Workflows "Pizzarello Bot" eine komplette,
// einfuegefertige Workflow-JSON (workflows/pizzarello-bot-fixed.json) inklusive
// Basisfoto-Fix. Der Inhalt kann im n8n-Editor mit Strg+V auf die Canvas
// eingefuegt werden und ersetzt so den ganzen Flow in einem Schritt.
//
// Aufruf:  node workflows/build-pizzarello-bot-json.mjs <live.json> [ziel.json]
//
// Basis ist die UNVEROEFFENTLICHTE Version (top-level nodes/connections), nicht
// die zuletzt publizierte activeVersion.

import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const quelle = process.argv[2];
const ziel = process.argv[3] || join(hier, 'pizzarello-bot-fixed.json');
if (!quelle) {
  console.error('Aufruf: node build-pizzarello-bot-json.mjs <live.json> [ziel.json]');
  process.exit(1);
}

const roh = JSON.parse(readFileSync(quelle, 'utf8'));
const wf = roh.workflow || roh;

const patchDir = join(hier, 'patches', '2026-09-03-basisfoto');
const lese = (f) => readFileSync(join(patchDir, f), 'utf8').trimEnd();

const nodes = JSON.parse(JSON.stringify(wf.nodes));
const conns = JSON.parse(JSON.stringify(wf.connections));
const byName = new Map(nodes.map((n) => [n.name, n]));
const mussGeben = (name) => {
  const n = byName.get(name);
  if (!n) throw new Error('Node fehlt im Live-JSON: ' + name);
  return n;
};

// 1) Code der beiden bestehenden Nodes ersetzen
mussGeben('Bild-Request bauen (Foto)').parameters.jsCode = lese('bild-request-bauen-foto.js');
mussGeben('Bild extrahieren').parameters.jsCode = lese('bild-extrahieren.js');

// 2) Zwei neue Nodes einziehen
const basisLaden = mussGeben('Basisfoto laden');
nodes.push({
  parameters: { jsCode: lese('basisfoto-pruefen.js') },
  id: randomUUID(),
  name: 'Basisfoto pruefen',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [basisLaden.position[0], basisLaden.position[1] - 176]
});
nodes.push({
  parameters: {
    operation: 'resize',
    dataPropertyName: 'basis',
    width: 1536,
    height: 1536,
    resizeOption: 'onlyIfLarger',
    options: { destinationKey: 'basis', format: 'png', quality: 100 }
  },
  id: randomUUID(),
  name: 'Basisfoto normalisieren',
  type: 'n8n-nodes-base.editImage',
  typeVersion: 1,
  position: [basisLaden.position[0] + 176, basisLaden.position[1] - 176]
});

// 3) Verbindungen umhaengen
const altZiel = conns['Basisfoto laden'].main[0];
if (altZiel.length !== 1 || altZiel[0].node !== 'Bild-Request bauen (Foto)') {
  throw new Error('Unerwartete Verdrahtung hinter "Basisfoto laden": ' + JSON.stringify(altZiel));
}
conns['Basisfoto laden'].main[0] = [{ node: 'Basisfoto pruefen', type: 'main', index: 0 }];
conns['Basisfoto pruefen'] = { main: [[{ node: 'Basisfoto normalisieren', type: 'main', index: 0 }]] };
conns['Basisfoto normalisieren'] = { main: [[{ node: 'Bild-Request bauen (Foto)', type: 'main', index: 0 }]] };

// 4) Einfuegefertiges Paket. n8n erwartet beim Einfuegen genau diese Form.
const paket = {
  meta: { instanceId: 'pizzarello', templateCredsSetupCompleted: false },
  nodes,
  connections: conns,
  pinData: {}
};

writeFileSync(ziel, JSON.stringify(paket, null, 2) + '\n');

const txt = JSON.stringify(paket);
console.log('geschrieben:', ziel);
console.log('Nodes:', nodes.length, '| Quellen mit Verbindungen:', Object.keys(conns).length, '| Zeichen:', txt.length);
const nichtAscii = txt.match(/[^\x00-\x7F]/g);
console.log('Nicht-ASCII-Zeichen:', nichtAscii ? nichtAscii.length : 0);
