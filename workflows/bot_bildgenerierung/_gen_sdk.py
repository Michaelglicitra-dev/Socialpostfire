import json, re, sys

W = json.load(open('_deploy_source.json'))
NODES = W['nodes']
CONN = W['connections']

CRED = {
    'openAiApi': 'OpenAI Pizzarello',
    'httpCustomAuth': 'imgbb',
    'httpHeaderAuth': 'Buffer',
    'telegramApi': 'Telegram Pizzarello Bot',
}

def cred_for(n):
    t = n['type']
    p = n.get('parameters', {})
    if t in ('n8n-nodes-base.telegram', 'n8n-nodes-base.telegramTrigger'):
        return ('telegramApi', CRED['telegramApi'])
    if t == '@n8n/n8n-nodes-langchain.lmChatOpenAi':
        return ('openAiApi', CRED['openAiApi'])
    if t == 'n8n-nodes-base.httpRequest':
        if p.get('authentication') == 'predefinedCredentialType':
            k = p.get('nodeCredentialType')
            if k in CRED:
                return (k, CRED[k])
        if p.get('authentication') == 'genericCredentialType':
            k = p.get('genericAuthType')
            if k in CRED:
                return (k, CRED[k])
    return None

BUILDER = {
    'n8n-nodes-base.if': 'ifElse',
    'n8n-nodes-base.switch': 'switchCase',
    '@n8n/n8n-nodes-langchain.lmChatOpenAi': 'languageModel',
    '@n8n/n8n-nodes-langchain.memoryBufferWindow': 'memory',
    'n8n-nodes-base.dataTableTool': 'tool',
    '@n8n/n8n-nodes-langchain.outputParserStructured': 'outputParser',
}
TRIGGERS = ('n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.telegramTrigger')

used = {}
def varname(name):
    if name in used:
        return used[name]
    s = re.sub(r'[^0-9a-zA-Z]+', ' ', name).strip().split()
    v = s[0].lower() + ''.join(w.capitalize() for w in s[1:])
    if not v or v[0].isdigit():
        v = 'n' + v
    base, i = v, 2
    while v in used.values():
        v = base + str(i); i += 1
    used[name] = v
    return v

def js(v, indent=0):
    """Render a python value as a compact JS literal, turning n8n expressions into expr()."""
    if isinstance(v, str):
        if v.startswith('='):
            return 'expr(' + json.dumps(v[1:], ensure_ascii=True) + ')'
        return json.dumps(v, ensure_ascii=True)
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if v is None:
        return 'null'
    if isinstance(v, (int, float)):
        return json.dumps(v)
    if isinstance(v, list):
        return '[' + ', '.join(js(x) for x in v) + ']'
    if isinstance(v, dict):
        items = []
        for k, val in v.items():
            key = k if re.fullmatch(r'[A-Za-z_$][A-Za-z0-9_$]*', k) else json.dumps(k, ensure_ascii=True)
            items.append(key + ': ' + js(val))
        return '{ ' + ', '.join(items) + ' }' if items else '{}'
    raise TypeError(str(type(v)))

# --- subnode wiring for the agent ---
subnodes = {}  # agent name -> {'model':var,'memory':var,'tools':[vars],'outputParser':var}
edges = []     # (src, outIdx, dst)
for src, outs in CONN.items():
    for kind, lists in outs.items():
        for idx, targets in enumerate(lists or []):
            for tgt in targets or []:
                if kind == 'main':
                    edges.append((src, idx, tgt['node']))
                else:
                    agent = tgt['node']
                    d = subnodes.setdefault(agent, {'tools': []})
                    if kind == 'ai_languageModel': d['model'] = src
                    elif kind == 'ai_memory': d['memory'] = src
                    elif kind == 'ai_outputParser': d['outputParser'] = src
                    elif kind == 'ai_tool': d['tools'].append(src)
                    else: raise Exception('unknown connection kind ' + kind)

out = []
out.append("import { workflow, node, trigger, newCredential, ifElse, switchCase, languageModel, memory, tool, outputParser, expr } from '@n8n/workflow-sdk';")
out.append('')

order = {n['name']: i for i, n in enumerate(NODES)}
# subnodes must be declared before the agent that references them
def decl_sort_key(n):
    name = n['name']
    is_sub = any(name in (d.get('model'), d.get('memory'), d.get('outputParser')) or name in d['tools'] for d in subnodes.values())
    return (0 if is_sub else 1, order[name])

for n in sorted(NODES, key=decl_sort_key):
    name = n['name']
    v = varname(name)
    t = n['type']
    builder = BUILDER.get(t, 'trigger' if t in TRIGGERS else 'node')
    cfg = ['name: ' + json.dumps(name, ensure_ascii=True)]
    cfg.append('parameters: ' + js(n.get('parameters', {})))
    c = cred_for(n)
    if c:
        cfg.append('credentials: { %s: newCredential(%s) }' % (c[0], json.dumps(c[1])))
    if name in subnodes:
        d = subnodes[name]
        parts = []
        if d.get('model'): parts.append('model: ' + varname(d['model']))
        if d.get('memory'): parts.append('memory: ' + varname(d['memory']))
        if d.get('outputParser'): parts.append('outputParser: ' + varname(d['outputParser']))
        if d['tools']: parts.append('tools: [' + ', '.join(varname(x) for x in d['tools']) + ']')
        cfg.append('subnodes: { ' + ', '.join(parts) + ' }')
    cfg.append('position: ' + json.dumps(n['position']))
    for k in ('alwaysOutputData', 'executeOnce', 'retryOnFail', 'disabled'):
        if n.get(k):
            cfg.append(k + ': true')
    for k in ('maxTries', 'waitBetweenTries'):
        if k in n:
            cfg.append(k + ': ' + json.dumps(n[k]))
    if n.get('onError'):
        cfg.append('onError: ' + json.dumps(n['onError']))

    body = 'type: %s, version: %s, config: { %s }' % (
        json.dumps(t), json.dumps(n['typeVersion']), ', '.join(cfg))
    if builder in ('node', 'trigger'):
        body += ', output: [{}]'
    if builder in ('ifElse', 'switchCase'):
        body = 'version: %s, config: { %s }' % (json.dumps(n['typeVersion']), ', '.join(cfg))
    out.append('const %s = %s({ %s });' % (v, builder, body))
    out.append('')

settings = {k: v for k, v in W['settings'].items() if k != 'availableInMCP'}
out.append("const wf = workflow('pizzarello-bot', %s, { settings: %s });" % (json.dumps(W['name']), js(settings)))
for src, idx, dst in edges:
    sv, dv = varname(src), varname(dst)
    if idx == 0:
        out.append('wf.add(%s).to(%s);' % (sv, dv))
    else:
        out.append('wf.add(%s.output(%d).to(%s));' % (sv, idx, dv))
out.append('export default wf;')
out.append('')

open('_bot_generated.ts', 'w').write('\n'.join(out))
print('edges', len(edges), 'nodes', len(NODES), 'chars', sum(len(x) for x in out))
