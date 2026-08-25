import { workflow, node, trigger, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

const GASTRONOM_CHAT = '7582948490';
const BETREIBER_CHAT = '7582948490';
const T_SESSIONS = '8WhvJ2bY2B6wKyGY';
const BOT_NAME = 'Pizzarello Bot';

const errTrig = trigger({
  type: 'n8n-nodes-base.errorTrigger',
  version: 1,
  config: { name: 'Fehler-Eingang', parameters: {}, position: [0, 0] },
  output: [{ execution: { id: '123', url: 'https://n8n.srv964622.hstgr.cloud/workflow/abc/executions/123', error: { message: 'Logo-Binary fehlt' }, lastNodeExecuted: 'Bild-Request bauen (Foto)', mode: 'trigger' }, workflow: { id: 'abc', name: 'Pizzarello Bot' } }]
});

const fehlerAufbereiten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Fehler aufbereiten',
    parameters: { jsCode: `const j = $json || {};
const ex = j.execution || {};
const wf = j.workflow || {};
const NL = String.fromCharCode(10);
const FEUER = String.fromCodePoint(0x1F6A8);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const wf_name = String(wf.name || 'unbekannter Workflow');
let fehlertext = '';
if (ex.error && ex.error.message) fehlertext = String(ex.error.message);
else if (ex.error) fehlertext = JSON.stringify(ex.error).slice(0, 400);
else fehlertext = 'kein Fehlertext uebermittelt';
const node_name = String(ex.lastNodeExecuted || 'unbekannt');
const link = String(ex.url || '');
let text = '<b>' + FEUER + ' Fehler in n8n</b>' + NL + NL;
text += 'Workflow: ' + esc(wf_name) + NL;
text += 'Node: ' + esc(node_name) + NL;
text += 'Modus: ' + esc(String(ex.mode || '-')) + NL + NL;
text += '<b>Fehler:</b>' + NL + '<code>' + esc(fehlertext.slice(0, 900)) + '</code>';
if (link) text += NL + NL + 'Execution: ' + esc(link);
else if (ex.id) text += NL + NL + 'Execution-ID: ' + esc(String(ex.id));
return [{ json: { betreiber_text: text.slice(0, 4000), workflow_name: wf_name, ist_bot: wf_name.indexOf('${BOT_NAME}') !== -1 } }];` },
    position: [220, 0]
  },
  output: [{ betreiber_text: 'Fehler in n8n', workflow_name: 'Pizzarello Bot', ist_bot: true }]
});

const betreiberInfo = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Betreiber informieren',
    parameters: { resource: 'message', operation: 'sendMessage', chatId: BETREIBER_CHAT, text: expr('{{ $json.betreiber_text }}'), additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    onError: 'continueRegularOutput',
    position: [440, 0]
  },
  output: [{ ok: true, result: { message_id: 30 } }]
});

const botBetroffenIf = ifElse({
  version: 2.2,
  config: {
    name: 'Bot betroffen?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Fehler aufbereiten').first().json.ist_bot }}"), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [660, 0]
  }
});

const wirtInfo = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Wirt informieren',
    parameters: { resource: 'message', operation: 'sendMessage', chatId: GASTRONOM_CHAT, text: 'Da ist bei mir was schiefgelaufen - versuch es bitte nochmal.', additionalFields: { appendAttribution: false, disable_web_page_preview: true } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    onError: 'continueRegularOutput',
    position: [880, -120]
  },
  output: [{ ok: true, result: { message_id: 31 } }]
});

const busyLoesen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'BUSY zuruecksetzen',
    parameters: { operation: 'update', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: GASTRONOM_CHAT }, { keyName: 'state', condition: 'eq', keyValue: 'BUSY' }] }, columns: { mappingMode: 'defineBelow', value: { state: 'IDLE', updated: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: [{ id: 'state', displayName: 'state', type: 'string', required: false, display: true, removed: false }, { id: 'updated', displayName: 'updated', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [1100, -120]
  },
  output: [{ state: 'IDLE' }]
});

const anderesFlow = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Anderer Workflow', parameters: {}, position: [880, 120] },
  output: [{}]
});

const wf = workflow('pizzarello-fehler-melder', 'Pizzarello Fehler-Melder');

wf.add(errTrig).to(fehlerAufbereiten).to(betreiberInfo).to(botBetroffenIf
  .onTrue(wirtInfo.to(busyLoesen))
  .onFalse(anderesFlow));

export default wf;
