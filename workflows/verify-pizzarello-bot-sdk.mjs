// Prueft den generierten SDK-Code, ohne ihn nach n8n zu schicken:
// fuehrt ihn gegen ein Stub-SDK aus, baut daraus Nodes + Verbindungen und
// vergleicht beides mit dem Live-Stand plus erwartetem Fix.
//
// Aufruf:  node workflows/verify-pizzarello-bot-sdk.mjs <live.json> <generiert.ts>

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const [, , liveDatei, codeDatei] = process.argv;
if (!liveDatei || !codeDatei) {
  console.error('Aufruf: node verify-pizzarello-bot-sdk.mjs <live.json> <generiert.ts>');
  process.exit(1);
}

const roh = JSON.parse(readFileSync(liveDatei, 'utf8'));
const live = roh.workflow || roh;
let code = readFileSync(codeDatei, 'utf8');

// ------------------------------------------------------------------ Stub-SDK
const gesammelt = new Map(); // name -> nodeDef
const kanten = []; // { von, ausgang, nach }
let lfd = 0;

function mach(art, arg, typ) {
  const cfg = arg.config || {};
  const def = {
    art,
    name: cfg.name || 'node' + ++lfd,
    type: typ || arg.type,
    typeVersion: arg.version,
    parameters: cfg.parameters || {},
    credentials: cfg.credentials || null,
    subnodes: cfg.subnodes || null,
    onError: cfg.onError,
    retryOnFail: cfg.retryOnFail,
    alwaysOutputData: cfg.alwaysOutputData,
    executeOnce: cfg.executeOnce,
    position: cfg.position
  };
  gesammelt.set(def.name, def);
  const h = {
    __def: def,
    to(ziel) { kanten.push({ von: def.name, ausgang: 0, nach: ziel.__def.name }); return h; },
    output(i) { return { __def: def, __ausgang: i, to(ziel) { kanten.push({ von: def.name, ausgang: i, nach: ziel.__def.name }); return h; } }; },
    onTrue(ziel) { kanten.push({ von: def.name, ausgang: 0, nach: ziel.__def.name }); return h; },
    onFalse(ziel) { kanten.push({ von: def.name, ausgang: 1, nach: ziel.__def.name }); return h; },
    onCase(i, ziel) { kanten.push({ von: def.name, ausgang: i, nach: ziel.__def.name }); return h; }
  };
  return h;
}

const sdk = {
  node: (a) => mach('node', a),
  trigger: (a) => mach('trigger', a),
  ifElse: (a) => mach('ifElse', a, 'n8n-nodes-base.if'),
  switchCase: (a) => mach('switchCase', a, 'n8n-nodes-base.switch'),
  languageModel: (a) => mach('languageModel', a),
  memory: (a) => mach('memory', a),
  tool: (a) => mach('tool', a),
  outputParser: (a) => mach('outputParser', a),
  newCredential: (name) => ({ __cred: name }),
  expr: (s) => '=' + s,
  workflow: (id, name) => {
    const b = {
      __id: id,
      __name: name,
      __aktuell: null,
      add(x) { b.__aktuell = x; return b; },
      to(ziel) {
        const q = b.__aktuell;
        kanten.push({ von: q.__def.name, ausgang: q.__ausgang || 0, nach: ziel.__def.name });
        b.__aktuell = ziel;
        return b;
      }
    };
    return b;
  }
};

// import/export entfernen und im VM ausfuehren
code = code
  .replace(/^import[^;]*;\s*/m, '')
  .replace(/export default /, 'globalThis.__wf = ');
const ctx = vm.createContext({ ...sdk, console });
ctx.globalThis = ctx;
vm.runInContext(code, ctx);
const gebaut = ctx.__wf;

// ------------------------------------------------------------------ Erwartung
const erwartetNodes = new Map();
for (const n of live.nodes) erwartetNodes.set(n.name, JSON.parse(JSON.stringify(n)));

const patchDir = new URL('./patches/2026-09-03-basisfoto/', import.meta.url);
const lese = (f) => readFileSync(new URL(f, patchDir), 'utf8').trimEnd();
erwartetNodes.get('Bild-Request bauen (Foto)').parameters.jsCode = lese('bild-request-bauen-foto.js');
erwartetNodes.get('Bild extrahieren').parameters.jsCode = lese('bild-extrahieren.js');
erwartetNodes.set('Basisfoto pruefen', {
  name: 'Basisfoto pruefen', type: 'n8n-nodes-base.code', typeVersion: 2,
  parameters: { jsCode: lese('basisfoto-pruefen.js') }
});
erwartetNodes.set('Basisfoto normalisieren', {
  name: 'Basisfoto normalisieren', type: 'n8n-nodes-base.editImage', typeVersion: 1,
  parameters: { operation: 'resize', dataPropertyName: 'basis', width: 1536, height: 1536, resizeOption: 'onlyIfLarger', options: { destinationKey: 'basis', format: 'png', quality: 100 } }
});

const erwartetKanten = new Set();
for (const [von, ziele] of Object.entries(live.connections)) {
  (ziele.main || []).forEach((gruppe, i) => (gruppe || []).forEach((z) => erwartetKanten.add(von + ' #' + i + ' -> ' + z.node)));
}
erwartetKanten.delete('Basisfoto laden #0 -> Bild-Request bauen (Foto)');
erwartetKanten.add('Basisfoto laden #0 -> Basisfoto pruefen');
erwartetKanten.add('Basisfoto pruefen #0 -> Basisfoto normalisieren');
erwartetKanten.add('Basisfoto normalisieren #0 -> Bild-Request bauen (Foto)');

// AI-Verbindungen -> erwartete Subnode-Zuordnung
const erwartetSub = new Map();
const SLOT = { ai_languageModel: 'model', ai_memory: 'memory', ai_tool: 'tools', ai_outputParser: 'outputParser' };
for (const [von, ziele] of Object.entries(live.connections)) {
  for (const [typ, slot] of Object.entries(SLOT)) {
    for (const gruppe of ziele[typ] || []) {
      for (const z of gruppe || []) {
        const s = erwartetSub.get(z.node) || { tools: [] };
        if (slot === 'tools') s.tools.push(von); else s[slot] = von;
        erwartetSub.set(z.node, s);
      }
    }
  }
}

// ------------------------------------------------------------------ Vergleich
const fehler = [];
const norm = (v) => JSON.stringify(v === undefined ? null : v);

for (const name of erwartetNodes.keys()) if (!gesammelt.has(name)) fehler.push('Node fehlt im SDK-Code: ' + name);
for (const name of gesammelt.keys()) if (!erwartetNodes.has(name)) fehler.push('Node zusaetzlich im SDK-Code: ' + name);

for (const [name, e] of erwartetNodes) {
  const g = gesammelt.get(name);
  if (!g) continue;
  if (g.type !== e.type) fehler.push(name + ': type ' + g.type + ' != ' + e.type);
  if (Number(g.typeVersion) !== Number(e.typeVersion)) fehler.push(name + ': typeVersion ' + g.typeVersion + ' != ' + e.typeVersion);
  if (norm(g.parameters) !== norm(e.parameters)) fehler.push(name + ': parameters weichen ab');
  if (norm(g.onError) !== norm(e.onError)) fehler.push(name + ': onError ' + norm(g.onError) + ' != ' + norm(e.onError));
  if (!!g.retryOnFail !== !!e.retryOnFail) fehler.push(name + ': retryOnFail ' + !!g.retryOnFail + ' != ' + !!e.retryOnFail);
  if (!!g.alwaysOutputData !== !!e.alwaysOutputData) fehler.push(name + ': alwaysOutputData weicht ab');
  if (!!g.executeOnce !== !!e.executeOnce) fehler.push(name + ': executeOnce weicht ab');
}

const gebauteKanten = new Set(kanten.map((k) => k.von + ' #' + k.ausgang + ' -> ' + k.nach));
for (const k of erwartetKanten) if (!gebauteKanten.has(k)) fehler.push('Kante fehlt: ' + k);
for (const k of gebauteKanten) if (!erwartetKanten.has(k)) fehler.push('Kante zusaetzlich: ' + k);

for (const [agent, e] of erwartetSub) {
  const g = gesammelt.get(agent);
  const s = (g && g.subnodes) || {};
  const nm = (x) => (x && x.__def ? x.__def.name : null);
  if (nm(s.model) !== (e.model || null)) fehler.push(agent + ': subnode model ' + nm(s.model) + ' != ' + e.model);
  if (nm(s.memory) !== (e.memory || null)) fehler.push(agent + ': subnode memory ' + nm(s.memory) + ' != ' + e.memory);
  if (nm(s.outputParser) !== (e.outputParser || null)) fehler.push(agent + ': subnode outputParser weicht ab');
  const gt = (s.tools || []).map(nm).sort().join(',');
  const et = (e.tools || []).slice().sort().join(',');
  if (gt !== et) fehler.push(agent + ': subnode tools [' + gt + '] != [' + et + ']');
}

// Credentials: Uebersicht, was nachgepflegt werden muss
const credListe = [];
for (const [name, g] of gesammelt) {
  if (!g.credentials) continue;
  for (const [typ, c] of Object.entries(g.credentials)) credListe.push({ node: name, typ, name: c.__cred, nodeType: g.type });
}

console.log('Workflow-ID im Code:', gebaut.__id, '| Name:', gebaut.__name);
console.log('Nodes im SDK-Code:', gesammelt.size, '| erwartet:', erwartetNodes.size);
console.log('Kanten im SDK-Code:', gebauteKanten.size, '| erwartet:', erwartetKanten.size);
console.log('Credential-Bindungen:', credListe.length);
const proTyp = {};
for (const c of credListe) proTyp[c.typ] = (proTyp[c.typ] || 0) + 1;
console.log('  ' + Object.entries(proTyp).map(([k, v]) => k + '=' + v).join(', '));
if (fehler.length === 0) {
  console.log('\nERGEBNIS: identisch zum Live-Stand plus erwartetem Fix.');
} else {
  console.log('\nABWEICHUNGEN (' + fehler.length + '):');
  for (const f of fehler) console.log(' - ' + f);
  process.exitCode = 1;
}
