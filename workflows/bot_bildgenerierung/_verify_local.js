const fs = require('fs');
const src = fs.readFileSync(__dirname + '/_bot_generated.ts', 'utf8')
  .replace(/^import .*$/m, '')
  .replace(/^export default wf;$/m, 'module.exports = wf;');

const nodes = [];
function mk(kind) {
  return function (spec) {
    const c = spec.config || {};
    const n = {
      __kind: kind,
      name: c.name,
      type: spec.type || null,
      typeVersion: spec.version,
      position: c.position,
      parameters: c.parameters || {},
      credentials: c.credentials,
      subnodes: c.subnodes,
      flags: {}
    };
    for (const k of ['alwaysOutputData', 'executeOnce', 'retryOnFail', 'disabled', 'maxTries', 'waitBetweenTries', 'onError']) {
      if (c[k] !== undefined) n.flags[k] = c[k];
    }
    n.output = function (i) { return { __src: n, __idx: i, to: function (t) { return { __edges: [[n, i, t]], __tail: t }; } }; };
    n.to = function (t) { return { __edges: [[n, 0, t]], __tail: t }; };
    nodes.push(n);
    return n;
  };
}
const node = mk('node'), trigger = mk('trigger'), ifElse = mk('if'), switchCase = mk('switch');
const languageModel = mk('lm'), memory = mk('memory'), tool = mk('tool'), outputParser = mk('parser');
const expr = (s) => '=' + s;
const newCredential = (n) => ({ __cred: n });
const edges = [];
function workflow(id, name, opts) {
  const wf = {
    id, name, settings: (opts || {}).settings || {},
    add: function (x) {
      let tail = x;
      if (x.__edges) { for (const e of x.__edges) edges.push(e); tail = x.__tail; }
      return {
        to: function (t) { edges.push([tail, 0, t]); tail = t; return this; }
      };
    }
  };
  return wf;
}
const wf = new Function('node', 'trigger', 'ifElse', 'switchCase', 'languageModel', 'memory', 'tool', 'outputParser', 'expr', 'newCredential', 'workflow', 'module',
  src + '\nreturn module.exports;')(node, trigger, ifElse, switchCase, languageModel, memory, tool, outputParser, expr, newCredential, workflow, { exports: null });

// rebuild n8n-style structure
const out = { name: wf.name, settings: wf.settings, nodes: [], connections: {} };
for (const n of nodes) {
  const o = { name: n.name, type: n.type, typeVersion: n.typeVersion, position: n.position, parameters: n.parameters };
  Object.assign(o, n.flags);
  out.nodes.push(o);
}
function push(src, kind, idx, dst) {
  const c = out.connections[src] || (out.connections[src] = {});
  const arr = c[kind] || (c[kind] = []);
  while (arr.length <= idx) arr.push([]);
  arr[idx].push({ node: dst, type: kind, index: 0 });
}
for (const [s, i, d] of edges) push(s.name, 'main', i, d.name);
for (const n of nodes) {
  if (!n.subnodes) continue;
  const s = n.subnodes;
  if (s.model) push(s.model.name, 'ai_languageModel', 0, n.name);
  if (s.memory) push(s.memory.name, 'ai_memory', 0, n.name);
  if (s.outputParser) push(s.outputParser.name, 'ai_outputParser', 0, n.name);
  for (const t of (s.tools || [])) push(t.name, 'ai_tool', 0, n.name);
}
fs.writeFileSync(__dirname + '/_rebuilt.json', JSON.stringify(out, null, 2));
console.log('nodes', out.nodes.length, 'edges', edges.length);
