// Erzeugt aus dem Live-JSON des Workflows "Pizzarello Bot" den SDK-Code
// (workflows/pizzarello-bot.ts) und baut dabei den Basisfoto-Fix ein.
//
// Aufruf:  node workflows/build-pizzarello-bot-sdk.mjs <live.json> [ziel.ts]
//
// <live.json> ist die Antwort von mcp get_workflow_details, also entweder
// { workflow: {...} } oder direkt das Workflow-Objekt.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = dirname(fileURLToPath(import.meta.url));
const quelle = process.argv[2];
const ziel = process.argv[3] || join(hier, 'pizzarello-bot.ts');
if (!quelle) {
  console.error('Aufruf: node build-pizzarello-bot-sdk.mjs <live.json> [ziel.ts]');
  process.exit(1);
}

const roh = JSON.parse(readFileSync(quelle, 'utf8'));
const wf = roh.workflow || roh;

// ---------------------------------------------------------------- Fix-Bausteine
const patchDir = join(hier, 'patches', '2026-09-03-basisfoto');
const codeBasisfotoPruefen = readFileSync(join(patchDir, 'basisfoto-pruefen.js'), 'utf8').trimEnd();
const codeBildRequestFoto = readFileSync(join(patchDir, 'bild-request-bauen-foto.js'), 'utf8').trimEnd();
const codeBildExtrahieren = readFileSync(join(patchDir, 'bild-extrahieren.js'), 'utf8').trimEnd();

const nodes = wf.nodes.map((n) => ({ ...n, parameters: JSON.parse(JSON.stringify(n.parameters || {})) }));
const byName = new Map(nodes.map((n) => [n.name, n]));

function mussGeben(name) {
  const n = byName.get(name);
  if (!n) throw new Error('Node fehlt im Live-JSON: ' + name);
  return n;
}

// 1) Code der beiden bestehenden Nodes ersetzen
mussGeben('Bild-Request bauen (Foto)').parameters.jsCode = codeBildRequestFoto;
mussGeben('Bild extrahieren').parameters.jsCode = codeBildExtrahieren;

// 2) Zwei neue Nodes einziehen
const basisLaden = mussGeben('Basisfoto laden');
nodes.push({
  name: 'Basisfoto pruefen',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [basisLaden.position[0], basisLaden.position[1] - 176],
  parameters: { jsCode: codeBasisfotoPruefen }
});
nodes.push({
  name: 'Basisfoto normalisieren',
  type: 'n8n-nodes-base.editImage',
  typeVersion: 1,
  position: [basisLaden.position[0] + 176, basisLaden.position[1] - 176],
  parameters: {
    operation: 'resize',
    dataPropertyName: 'basis',
    width: 1536,
    height: 1536,
    resizeOption: 'onlyIfLarger',
    options: { destinationKey: 'basis', format: 'png', quality: 100 }
  }
});

// 3) Verbindungen umhaengen:
//    Basisfoto laden -> Basisfoto pruefen -> Basisfoto normalisieren -> Bild-Request bauen (Foto)
const conns = JSON.parse(JSON.stringify(wf.connections));
const altZiel = conns['Basisfoto laden'].main[0];
if (altZiel.length !== 1 || altZiel[0].node !== 'Bild-Request bauen (Foto)') {
  throw new Error('Unerwartete Verdrahtung hinter "Basisfoto laden": ' + JSON.stringify(altZiel));
}
conns['Basisfoto laden'].main[0] = [{ node: 'Basisfoto pruefen', type: 'main', index: 0 }];
conns['Basisfoto pruefen'] = { main: [[{ node: 'Basisfoto normalisieren', type: 'main', index: 0 }]] };
conns['Basisfoto normalisieren'] = { main: [[{ node: 'Bild-Request bauen (Foto)', type: 'main', index: 0 }]] };

// ---------------------------------------------------------------- Credentials
// HTTP-Request-Nodes bekommen beim Import ohnehin keine Credentials zugeordnet,
// die Angabe dient hier als Dokumentation der noetigen Nachpflege.
const CRED_NAMEN = {
  telegramApi: 'Telegram Pizzarello Bot',
  openAiApi: 'OpenAI Pizzarello',
  httpCustomAuth: 'imgbb',
  httpHeaderAuth: 'Buffer'
};

function credsFuer(n) {
  const p = n.parameters || {};
  if (n.type === 'n8n-nodes-base.telegram' || n.type === 'n8n-nodes-base.telegramTrigger') return { telegramApi: 'telegramApi' };
  if (n.type === '@n8n/n8n-nodes-langchain.lmChatOpenAi') return { openAiApi: 'openAiApi' };
  if (n.type === 'n8n-nodes-base.httpRequest') {
    if (p.authentication === 'predefinedCredentialType' && p.nodeCredentialType) return { [p.nodeCredentialType]: p.nodeCredentialType };
    if (p.authentication === 'genericCredentialType' && p.genericAuthType) return { [p.genericAuthType]: p.genericAuthType };
  }
  return null;
}

// ---------------------------------------------------------------- Serialisierung
const IDENT_OK = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function jsString(s) {
  // Immer einfache Anfuehrungszeichen, \n als Escape - kein Template-Literal,
  // damit Backticks und ${} im jsCode nicht interpretiert werden.
  return "'" + s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029') + "'";
}

function lit(v, tiefe) {
  const ein = '  '.repeat(tiefe);
  const einInnen = '  '.repeat(tiefe + 1);
  if (v === null) return 'null';
  if (typeof v === 'string') return jsString(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return '[\n' + v.map((x) => einInnen + lit(x, tiefe + 1)).join(',\n') + '\n' + ein + ']';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (keys.length === 0) return '{}';
    return '{\n' + keys.map((k) => einInnen + (IDENT_OK.test(k) ? k : jsString(k)) + ': ' + lit(v[k], tiefe + 1)).join(',\n') + '\n' + ein + '}';
  }
  throw new Error('Nicht serialisierbar: ' + typeof v);
}

// Variablennamen aus Node-Namen
const benutzt = new Set(['workflow', 'node', 'trigger', 'ifElse', 'switchCase', 'languageModel', 'memory', 'tool', 'outputParser', 'newCredential', 'expr', 'default', 'export', 'const', 'import']);
const varVon = new Map();
for (const n of nodes) {
  let basis = n.name
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
  if (!basis || /^[0-9]/.test(basis)) basis = 'n' + basis;
  let name = basis;
  let i = 2;
  while (benutzt.has(name)) name = basis + i++;
  benutzt.add(name);
  varVon.set(n.name, name);
}

// Fabrik je Node-Typ
const FABRIK = {
  'n8n-nodes-base.scheduleTrigger': 'trigger',
  'n8n-nodes-base.telegramTrigger': 'trigger',
  'n8n-nodes-base.if': 'ifElse',
  'n8n-nodes-base.switch': 'switchCase',
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': 'languageModel',
  '@n8n/n8n-nodes-langchain.memoryBufferWindow': 'memory',
  '@n8n/n8n-nodes-langchain.outputParserStructured': 'outputParser',
  'n8n-nodes-base.dataTableTool': 'tool'
};
const fabrikVon = (n) => FABRIK[n.type] || 'node';
// ifElse/switchCase tragen den Typ nicht selbst, alle anderen schon
const OHNE_TYP = new Set(['ifElse', 'switchCase']);

// Subnodes des Agents aus den ai_*-Verbindungen ableiten
const agentSub = new Map(); // agentName -> { model, memory, tools[], outputParser }
const AI_SLOT = { ai_languageModel: 'model', ai_memory: 'memory', ai_tool: 'tools', ai_outputParser: 'outputParser' };
for (const [von, ziele] of Object.entries(conns)) {
  for (const [typ, slot] of Object.entries(AI_SLOT)) {
    if (!ziele[typ]) continue;
    for (const gruppe of ziele[typ]) {
      for (const z of gruppe || []) {
        const s = agentSub.get(z.node) || { model: null, memory: null, tools: [], outputParser: null };
        if (slot === 'tools') s.tools.push(von);
        else s[slot] = von;
        agentSub.set(z.node, s);
      }
    }
  }
}

// ---------------------------------------------------------------- Node-Deklarationen
const zeilen = [];
zeilen.push("import { workflow, node, trigger, ifElse, switchCase, languageModel, memory, tool, outputParser, newCredential } from '@n8n/workflow-sdk';");
zeilen.push('');
zeilen.push('// Generiert von workflows/build-pizzarello-bot-sdk.mjs - nicht von Hand editieren.');
zeilen.push('// Quelle: Live-Stand des Workflows "Pizzarello Bot" (' + wf.id + ') plus Basisfoto-Fix.');
zeilen.push('');

// Reihenfolge: Subnodes zuerst, damit der Agent sie referenzieren kann
const istSubnode = new Set();
for (const s of agentSub.values()) {
  if (s.model) istSubnode.add(s.model);
  if (s.memory) istSubnode.add(s.memory);
  if (s.outputParser) istSubnode.add(s.outputParser);
  for (const t of s.tools) istSubnode.add(t);
}
const sortiert = [...nodes.filter((n) => istSubnode.has(n.name)), ...nodes.filter((n) => !istSubnode.has(n.name))];

for (const n of sortiert) {
  const fab = fabrikVon(n);
  const cfg = { name: n.name };
  cfg.parameters = n.parameters || {};
  const sub = agentSub.get(n.name);
  cfg.position = n.position;
  const teile = [];
  teile.push('  name: ' + jsString(n.name));
  teile.push('  parameters: ' + JSON.stringify(cfg.parameters));
  const creds = credsFuer(n);
  if (creds) {
    const eintraege = Object.keys(creds).map((k) => (IDENT_OK.test(k) ? k : jsString(k)) + ': newCredential(' + jsString(CRED_NAMEN[k] || k) + ')');
    teile.push('  credentials: { ' + eintraege.join(', ') + ' }');
  }
  if (sub) {
    const s = [];
    if (sub.model) s.push('model: ' + varVon.get(sub.model));
    if (sub.memory) s.push('memory: ' + varVon.get(sub.memory));
    if (sub.tools.length) s.push('tools: [' + sub.tools.map((t) => varVon.get(t)).join(', ') + ']');
    if (sub.outputParser) s.push('outputParser: ' + varVon.get(sub.outputParser));
    teile.push('  subnodes: { ' + s.join(', ') + ' }');
  }
  if (n.onError) teile.push('  onError: ' + jsString(n.onError));
  if (n.retryOnFail) teile.push('  retryOnFail: true');
  if (n.alwaysOutputData) teile.push('  alwaysOutputData: true');
  if (n.executeOnce) teile.push('  executeOnce: true');
  teile.push('  position: [' + n.position[0] + ', ' + n.position[1] + ']');

  const args = [];
  if (!OHNE_TYP.has(fab)) args.push('type: ' + jsString(n.type));
  args.push('version: ' + n.typeVersion);
  args.push('config: { ' + teile.map((t) => t.trim()).join(', ') + ' }');

  zeilen.push('const ' + varVon.get(n.name) + ' = ' + fab + '({ ' + args.join(', ') + ' });');
}

// ---------------------------------------------------------------- Komposition
const komp = [];
const angefasst = new Set();

for (const n of nodes) {
  const aus = (conns[n.name] || {}).main;
  if (!aus || !aus.length) continue;
  const fab = fabrikVon(n);
  const v = varVon.get(n.name);
  if (fab === 'ifElse') {
    const teile = [];
    (aus[0] || []).forEach((z) => teile.push('.onTrue(' + varVon.get(z.node) + ')'));
    (aus[1] || []).forEach((z) => teile.push('.onFalse(' + varVon.get(z.node) + ')'));
    komp.push('  .add(' + v + teile.join('') + ')');
  } else if (fab === 'switchCase') {
    const teile = [];
    aus.forEach((gruppe, i) => (gruppe || []).forEach((z) => teile.push('.onCase(' + i + ', ' + varVon.get(z.node) + ')')));
    komp.push('  .add(' + v + teile.join('') + ')');
  } else {
    aus.forEach((gruppe, i) => {
      for (const z of gruppe || []) {
        const von = i === 0 ? v : v + '.output(' + i + ')';
        komp.push('  .add(' + von + ').to(' + varVon.get(z.node) + ')');
      }
    });
  }
  angefasst.add(n.name);
  for (const gruppe of aus) for (const z of gruppe || []) angefasst.add(z.node);
}

// Nodes ohne jede main-Verbindung trotzdem aufnehmen (z. B. reine Endpunkte)
for (const n of nodes) {
  if (angefasst.has(n.name) || istSubnode.has(n.name)) continue;
  komp.push('  .add(' + varVon.get(n.name) + ')');
}

zeilen.push('export default workflow(' + jsString(wf.id) + ', ' + jsString(wf.name) + ')');
zeilen.push(komp.join('\n') + ';');
zeilen.push('');

const out = zeilen.join('\n');
writeFileSync(ziel, out);

const nichtAscii = out.match(/[^\x00-\x7F]/g);
console.log('geschrieben:', ziel);
console.log('Zeichen:', out.length, '| Nodes:', nodes.length, '| Kanten-Zeilen:', komp.length);
console.log('Nicht-ASCII-Zeichen:', nichtAscii ? nichtAscii.length + ' -> ' + JSON.stringify([...new Set(nichtAscii)]) : 0);
