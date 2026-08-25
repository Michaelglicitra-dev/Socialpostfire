import { workflow, node, trigger, languageModel, memory, tool, outputParser, ifElse, switchCase, newCredential, expr } from '@n8n/workflow-sdk';

const CHAT_ID = '7582948490';
const T_SESSIONS = '8WhvJ2bY2B6wKyGY';
const T_POSTLOG = 'HAaLrktmGAA8IddT';
const T_LEARNINGS = 'DfXfRBdmdGA5AwFs';
const T_ANGEBOTE = 'dVJNivQbpA7YUwAm';
const T_SPEISEKARTE = '8LOssi3MEAxKEXMd';
const T_FOTOS = 'x7QjV9d9CI0ZgrBz';

const sessionSchema = [
  { id: 'chat_id', displayName: 'chat_id', type: 'string', required: false, display: true, removed: false },
  { id: 'state', displayName: 'state', type: 'string', required: false, display: true, removed: false },
  { id: 'post_id', displayName: 'post_id', type: 'string', required: false, display: true, removed: false },
  { id: 'draft_json', displayName: 'draft_json', type: 'string', required: false, display: true, removed: false },
  { id: 'photo_url', displayName: 'photo_url', type: 'string', required: false, display: true, removed: false },
  { id: 'last_message_id', displayName: 'last_message_id', type: 'string', required: false, display: true, removed: false },
  { id: 'updated', displayName: 'updated', type: 'string', required: false, display: true, removed: false }
];

const logSchema = [
  { id: 'datum', displayName: 'datum', type: 'string', required: false, display: true, removed: false },
  { id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false },
  { id: 'headline', displayName: 'headline', type: 'string', required: false, display: true, removed: false },
  { id: 'post_text', displayName: 'post_text', type: 'string', required: false, display: true, removed: false },
  { id: 'hashtags', displayName: 'hashtags', type: 'string', required: false, display: true, removed: false },
  { id: 'image_url', displayName: 'image_url', type: 'string', required: false, display: true, removed: false },
  { id: 'status', displayName: 'status', type: 'string', required: false, display: true, removed: false },
  { id: 'buffer_ids', displayName: 'buffer_ids', type: 'string', required: false, display: true, removed: false },
  { id: 'kanaele', displayName: 'kanaele', type: 'string', required: false, display: true, removed: false },
  { id: 'geplant_fuer', displayName: 'geplant_fuer', type: 'string', required: false, display: true, removed: false }
];

// ===================== TRIGGER =====================
const tgTrig = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  config: {
    name: 'Telegram Eingang',
    parameters: { updates: ['message', 'callback_query'], additionalFields: { download: true, imageSize: 'large' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [-620, 260]
  },
  output: [{ message: { message_id: 11, chat: { id: 7582948490 }, text: 'Mach mal was fuer naechsten Freitag' } }]
});

const schedTrig = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Taeglich 09:30', parameters: { rule: { interval: [{ field: 'days', triggerAtHour: 9, triggerAtMinute: 30 }] } }, position: [-620, 20] },
  output: [{}]
});

// ===================== NORMALISIERUNG =====================
const updateNorm = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Update normalisieren',
    parameters: { jsCode: `const b = $json || {};
const cb = b.callback_query || null;
const msg = cb ? (cb.message || {}) : (b.message || b.edited_message || {});
const chat = msg.chat || {};
const from = cb ? (cb.from || {}) : (msg.from || {});
const chat_id = String(chat.id || from.id || '');
let typ = 'unbekannt';
let text = '';
let callback_data = '';
let callback_query_id = '';
let photo_b64 = '';
if (cb) {
  typ = 'callback';
  callback_data = String(cb.data || '');
  callback_query_id = String(cb.id || '');
} else if (msg.photo) {
  typ = 'foto';
  text = String(msg.caption || '').trim();
  try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); photo_b64 = buf.toString('base64'); } catch (e) { photo_b64 = ''; }
} else if (msg.text) {
  typ = 'text';
  text = String(msg.text).trim();
}
return [{ json: { quelle: 'telegram', chat_id: chat_id, typ: typ, text: text, callback_data: callback_data, callback_query_id: callback_query_id, message_id: String(msg.message_id || ''), has_photo: photo_b64 !== '', photo_b64: photo_b64 } }];` },
    position: [-400, 260]
  },
  output: [{ quelle: 'telegram', chat_id: '7582948490', typ: 'text', text: 'Mach mal was fuer naechsten Freitag', callback_data: '', callback_query_id: '', message_id: '11', has_photo: false, photo_b64: '' }]
});

const tagespostNorm = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Tagespost normalisieren',
    parameters: { jsCode: `return [{ json: { quelle: 'schedule', chat_id: '${CHAT_ID}', typ: 'schedule', text: '', callback_data: '', callback_query_id: '', message_id: '', has_photo: false, photo_b64: '' } }];` },
    position: [-400, 20]
  },
  output: [{ quelle: 'schedule', chat_id: '7582948490', typ: 'schedule', text: '', callback_data: '', callback_query_id: '', message_id: '', has_photo: false, photo_b64: '' }]
});

const eingang = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Eingang',
    parameters: { jsCode: `const j = $input.first().json || {};
return [{ json: { quelle: j.quelle, chat_id: j.chat_id, typ: j.typ, text: j.text, callback_data: j.callback_data, callback_query_id: j.callback_query_id, message_id: j.message_id, has_photo: !!j.has_photo } }];` },
    position: [-180, 140]
  },
  output: [{ quelle: 'telegram', chat_id: '7582948490', typ: 'text', text: 'Mach mal was fuer naechsten Freitag', callback_data: '', callback_query_id: '', message_id: '11', has_photo: false }]
});

// ===================== KONFIGURATION =====================
const config = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurant-Konfiguration',
    parameters: { jsCode: `const inp = $input.first().json || {};
const cfg = {
  restaurant: {
    name: 'Pizzarello',
    kueche: 'Pizzeria in Oberhausen - handgemachte, hauchduenn-knusprige Pizza zum Abholen und Bestellen',
    standort: 'Friedrich-Karl-Strasse 19, 46045 Oberhausen',
    telefon: '0208 / 888 802',
    website: 'https://www.pizzarello.net',
    oeffnungszeiten: 'Mo + Di Ruhetag (ausser Feiertage), Mi-Fr 17:00-22:00 Uhr, Sa-So 13:00-22:00 Uhr',
    ton: 'familiaer-italienisch, herzlich, ein bisschen verspielt, Du-Ansprache',
    brand_farben: { primaer: '#C8102E', sekundaer: '#2E7D32', akzent: '#F5E6C8', dunkel: '#1e1a17' },
    bild_guideline: {
      markenkern: 'BRAND CORE (always apply): Pizzarello - a MODERN, premium, editorial food-brand look, like a high-end campaign, NOT a cosy trattoria and NOT a menu card. Reduced, confident, almost a lifestyle-product feel. BACKGROUND: a calm single-colour or very subtly textured surface - brushed warm-grey stainless steel/metal, deep black, or anthracite; a studio-like setup, never a rustic wooden table and never cosy warmth props. NEGATIVE SPACE: deliberately a lot of empty room (usually the upper third) as a clear zone for the headline; text and food stay clearly separated, never overlapping; the composition breathes, never crowded; optionally one thin fine terracotta 1px accent rule as a graphic divider between the text zone and the image zone. TYPOGRAPHY: a clean geometric/humanist sans-serif (in the spirit of Poppins / Circular / General Sans) - rounded, friendly yet high-end; NO serif, NO heavy block lettering; letters in white or cream on the dark/neutral ground; regular to medium weight, light and elegant, quietly confident rather than loud. COLOUR: a reduced palette - neutral grey/black or brushed metal as the base plus ONE warm accent (terracotta / rust red) used only as a thin line or a tiny detail; the pizza/food itself is the only real colour in the frame, everything else stays muted and calm; no tricolore red-green-white cliche. FOOD PHOTOGRAPHY: precise and close to the product, shot slightly from above (about 60-75 degrees) or straight top-down (90 degrees); visible craft - one or two hands holding or serving the pizza (never a face), high-quality ingredients clearly readable and deliberately styled (single mortadella rosettes, burrata drops, pistachio); light soft but contrasty enough to bring out texture (crust, cheese pull), never flat diffuse light and never hard flash. GRAPHIC ELEMENTS: use extras VERY sparingly - a small fine circular badge ONLY when a concrete date, period or location is actually part of the content, otherwise none; never invent a brand logo, wordmark or emblem of your own - the ONLY logo allowed is the attached Pizzarello logo.',
      grading: 'BRAND GRADE (apply as a gentle modern look, but keep the existing dish, composition and setting): move it towards a clean editorial premium campaign feel - a neutral grey/anthracite or brushed-metal mood, soft but contrasty light that keeps texture crisp, muted surroundings so the food is the only real colour; no cosy warm candlelight, no orange cast, photorealistic.',
      module: {
        produkt: 'CONTENT Product/Menu (clean studio look): the pizza on a neutral brushed-metal or warm-grey surface, shot slightly from above, one or two hands holding/presenting it (craft, no face); a calm headline in the upper area plus one ingredient line separated by dots (e.g. "Zutat - Zutat - Zutat"), with generous empty space between the text and the pizza.',
        event: 'CONTENT Event (modern editorial ad): a dark, calm background with only a hinted atmosphere (softly blurred people far in the background, hands, glasses - never clear recognisable faces), the food still clearly staged; a clean light headline with plenty of negative space, inviting but premium, never a busy cosy scene.',
        angebot: 'CONTENT Offer/Special (minimal look): a dark or neutral background, a clear headline hierarchy in the upper area (size = importance); keep the LOWER-RIGHT area calm and completely free for a real round price badge that is composited afterwards - do NOT draw any price, number or badge yourself; the product shown large but cropped at the left or bottom edge (a detail crop, not the whole pizza centred), optionally a few small side elements (antipasti or dessert miniatures) at the edge.',
        saison: 'CONTENT Season (clean studio look): the seasonal ingredient staged prominently, fresh or raw, on a neutral brushed-metal or grey surface next to the finished dish, precise and close, with lots of negative space; modern editorial rather than a rustic harvest scene.',
        bts: 'CONTENT Behind the scenes (clean documentary): an authentic craft moment - hands shaping dough or sliding a pizza into the stone oven - framed cleanly and modern against a dark/neutral studio-like background, honest and human, never a clear recognisable face, never a cluttered rustic kitchen.',
        flyer: 'CONTENT Campaign/Ad (dark editorial vertical ad, NOT a printed flyer): an almost black or very dark background, a large food detail (a cut pizza or snack in close-up) along the lower or side edge, a headline in clean light sans-serif at the top, and a discreet CTA area (a rounded rectangle in the terracotta accent colour) with a short action line; it reads like a high-end social-ad campaign, calm and text-light.'
      },
      typo: 'TEXT STYLE: render in-image text in a MODERN sans-serif type system - main headlines in Poppins (Medium or Regular weight); a bold CONDENSED ad-style headline in Barlow Condensed or Archivo Narrow; any subline or body text in Inter or General Sans. Cream-white or white letters, clean and contemporary, NEVER a serif and NEVER a generic default/system font. Set the text in its own calm negative-space zone with a GENEROUS clear margin from every edge (never touching the top or side edges); clearly separated from the food, not pasted over it; optionally one thin fine terracotta rule as a divider; keep any subline to a single short line separated by dots; the lettering must look like part of one cohesive photograph, not a pasted-on graphic.',
      negativ: 'AVOID: rustic wooden-table look, trattoria kitsch, cosy candle or warmth props, serif typefaces, heavy block-lettering headlines, overloaded composition, several props at once (wine, napkin, herbs together), loud oversaturated red-green-white tricolore cliche, hard camera flash, orange colour cast, generic stock-photo look, recognisable faces of real people, distorted hands or fingers, logo distortions, any invented or second brand logo, wordmark or emblem, any badge, ribbon, sticker, seal or date/time stamp that was not explicitly part of the request, any price, number, percentage or currency symbol rendered into the image (prices are added afterwards as a real badge), and any text beyond a headline plus at most one short subline per image.',
      text_safety: 'TEXT SAFE AREA (critical): every piece of text, lettering, price, badge or ribbon MUST sit completely inside the image within a safe margin of at least 12 percent from every edge, with EXTRA clearance at the TOP so the first headline line never touches or runs off the top edge; never let any letter, word, badge or ribbon touch, overlap or run off any image border; if a headline is long, scale it DOWN and/or wrap it onto two lines so the whole headline fits fully within the frame with margin to spare; no text may be cut off or cropped at any edge.'
    }
  },
  layouts: {
    klassik: { name: 'Klassik', bild: 'Modern editorial look: place the headline in the calm upper-third negative-space zone in clean light sans-serif, cream-white, optionally with a thin 1px terracotta rule directly under it; keep the food in the lower two-thirds with clear empty space between text and food.' },
    menue_karte: { name: 'Menue-Karte', bild: 'Clean product look: the headline sits top-centre or top-left in a light humanist sans-serif, with one ingredient subline separated by dots ("Zutat - Zutat - Zutat") just beneath it, lots of negative space, and the food fully visible below.' },
    angebots_sticker: { name: 'Angebots-Sticker', bild: 'Minimal special look: a clear headline hierarchy in the upper area, plenty of calm negative space, and the LOWER-RIGHT area kept completely free for a real round price badge added afterwards; do NOT draw any price, number or badge yourself.' },
    event_poster: { name: 'Event-Poster', bild: 'Dark editorial ad look: the headline in clean light sans-serif in the upper area with generous negative space, the food as a large detail along a lower or side edge, and a discreet rounded-rectangle CTA area in the terracotta accent colour near the bottom.' },
    pur: { name: 'Pur', bild: 'No text at all in the image. Only the clean food photo. Absolutely no headline, no words, no badges and no captions inside the image.' },
    zitat: { name: 'Zitat', bild: 'Editorial quote look: one short clean sans-serif line set in calm negative space, cream-white, no band and no box, clearly separated from the food.' }
  },
  logo_url: 'https://graph.microsoft.com/v1.0/me/drive/root:/Pizzarello/assets/pizzarello_transparent.png:/content',
  bild_size: '1024x1536',
  saeulen_rotation: { '1': 'angebote', '2': 'saisonal', '3': 'community', '4': 'angebote', '5': 'saisonal', '6': 'community', '7': 'angebote' },
  hashtags: {
    angebote: ['#pizzarello', '#tagesangebot', '#pizzaderwoche', '#oberhausen', '#pizzaliebe', '#handmadepizza'],
    saisonal: ['#pizzarello', '#saisonal', '#frischezutaten', '#regional', '#oberhausen', '#italienischekueche', '#handmadepizza'],
    community: ['#pizzarello', '#stammgaeste', '#behindthescenes', '#oberhausen', '#supportlocal', '#lapizzaevita']
  },
  telegram_chat_id: '${CHAT_ID}',
  buffer: {
    organizationId: '69f7afabd110cb66bf840334',
    posting_zeit: '17:00',
    kanaele: [
      { key: 'instagram', name: 'Instagram', channelId: '6a805d6bb2d9d57743816131', aktiv: true, format: 'master', tags: 'max5' },
      { key: 'facebook', name: 'Facebook', channelId: '', aktiv: false, format: 'master', tags: 'full' },
      { key: 'tiktok', name: 'TikTok', channelId: '', aktiv: false, format: 'vertical', tags: 'full' }
    ],
    pinterest_url: 'https://www.pizzarello.net'
  }
};
return [{ json: Object.assign({}, inp, cfg) }];` },
    position: [40, 140]
  },
  output: [{ chat_id: '7582948490', typ: 'text', telegram_chat_id: '7582948490', restaurant: { name: 'Pizzarello' } }]
});

// ===================== ZUSTAND LADEN + ROUTER =====================
const sessionLaden = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Session laden',
    parameters: { operation: 'get', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: expr('{{ $json.chat_id }}') }] }, returnAll: false, limit: 1 },
    alwaysOutputData: true,
    position: [260, 140]
  },
  output: [{ chat_id: '7582948490', state: 'IDLE', post_id: '', draft_json: '', photo_url: '', last_message_id: '', updated: '2026-08-25T09:00:00.000Z' }]
});

const router = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Router',
    parameters: { jsCode: `const e = $('Eingang').first().json;
const cfg = $('Restaurant-Konfiguration').first().json;
const row = $input.first().json || {};
const hatZeile = !!(row && row.chat_id);
const state = hatZeile ? String(row.state || 'IDLE') : 'IDLE';
const erlaubt = String(cfg.telegram_chat_id);
const parts = String(e.callback_data || '').split(':');
const aktion = parts[0] || '';
const cb_post_id = parts.slice(1).join(':');
const gueltig = (state === 'DRAFT_OPEN') && cb_post_id !== '' && String(row.post_id || '') === cb_post_id;
let hinweis = 'Dieser Entwurf ist nicht mehr aktuell.';
if (gueltig) {
  if (aktion === 'ok') hinweis = 'Alles klar - ich plane den Post ein.';
  else if (aktion === 'neu') hinweis = 'Ich baue dir eine andere Variante.';
  else if (aktion === 'weg') hinweis = 'Verworfen.';
  else hinweis = 'Unbekannte Aktion.';
}
let route = 5;
if (e.quelle === 'telegram' && String(e.chat_id) !== erlaubt) route = 5;
else if (e.typ === 'callback') route = 0;
else if (state === 'BUSY') route = (e.quelle === 'schedule') ? 5 : 1;
else if (e.typ === 'foto') route = 2;
else if (e.typ === 'text') route = 3;
else if (e.typ === 'schedule') route = 4;
else route = 5;
return [{ json: {
  route: route,
  state: state,
  aktion: aktion,
  cb_post_id: cb_post_id,
  gueltig: gueltig && (aktion === 'ok' || aktion === 'neu' || aktion === 'weg'),
  callback_hinweis: hinweis.slice(0, 190),
  sess_post_id: String(row.post_id || ''),
  sess_draft_json: String(row.draft_json || ''),
  sess_photo_url: String(row.photo_url || ''),
  sess_last_message_id: String(row.last_message_id || '')
} }];` },
    position: [480, 140]
  },
  output: [{ route: 3, state: 'IDLE', aktion: '', cb_post_id: '', gueltig: false, callback_hinweis: 'Dieser Entwurf ist nicht mehr aktuell.', sess_post_id: '', sess_draft_json: '', sess_photo_url: '', sess_last_message_id: '' }]
});

const routerSwitch = switchCase({
  version: 3.4,
  config: { name: 'Zweig waehlen', parameters: { mode: 'expression', numberOutputs: 6, output: expr('{{ $json.route }}'), looseTypeValidation: true }, position: [700, 140] }
});

// ===================== ZWEIG 5: IGNORIEREN =====================
const ignorieren = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Ignorieren', parameters: {}, position: [940, 1180] },
  output: [{}]
});

// ===================== ZWEIG 1: BUSY =====================
const busyAbwimmeln = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Bin beschaeftigt',
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), text: 'Bin noch am Bauen, einen Moment - ich melde mich gleich mit dem Ergebnis.', additionalFields: { appendAttribution: false, disable_web_page_preview: true } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [940, 460]
  },
  output: [{ ok: true, result: { message_id: 12 } }]
});

// ===================== ZWEIG 0: CALLBACK =====================
const callbackBestaetigen = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Callback bestaetigen',
    parameters: { resource: 'callback', operation: 'answerQuery', queryId: expr("{{ $('Eingang').first().json.callback_query_id }}"), additionalFields: { text: expr('{{ $json.callback_hinweis }}') } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [940, 40]
  },
  output: [{ ok: true, result: true }]
});

const callbackGueltigIf = ifElse({
  version: 2.2,
  config: {
    name: 'Entwurf noch gueltig?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Router').first().json.gueltig }}"), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [1160, 40]
  }
});

const callbackVerfallen = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Toter Entwurf', parameters: {}, position: [1380, 200] },
  output: [{}]
});

const callbackAktion = switchCase({
  version: 3.4,
  config: { name: 'Callback-Aktion', parameters: { mode: 'expression', numberOutputs: 3, output: expr("{{ $('Router').first().json.aktion === 'ok' ? 0 : ($('Router').first().json.aktion === 'neu' ? 1 : 2) }}"), looseTypeValidation: true }, position: [1380, -80] }
});

// ===================== ZWEIG 2: FOTO =====================
const fotoUpload = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Eingangsfoto hochladen',
    parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr("{{ $('Update normalisieren').first().json.photo_b64 }}") }] }, options: { response: { response: { neverError: true } } } },
    credentials: { httpCustomAuth: newCredential('imgbb') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    position: [940, 620]
  },
  output: [{ data: { url: 'https://i.ibb.co/abc/eingang.png' } }]
});

const fotoAuftrag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Foto-Auftrag',
    parameters: { jsCode: `const e = $('Eingang').first().json;
const r = $('Router').first().json;
let url = '';
try { url = String(($json.data && $json.data.url) || ''); } catch (er) { url = ''; }
if (!url) throw new Error('imgbb Upload des Eingangsfotos fehlgeschlagen: ' + JSON.stringify($json).slice(0, 300));
const brief = e.text || '(nur ein Foto, kein Text)';
const agent_input = 'Neue Eingabe vom Wirt mit EIGENEM FOTO: "' + brief + '". Das mitgeschickte Foto ist die Bildgrundlage - waehle KEIN Archiv-Foto und lass archiv_foto_url leer. Erstelle daraus EINEN fertigen Social-Media-Post.';
return [{ json: { chat_id: e.chat_id, modus: 'neu', typ: 'foto', agent_input: agent_input, photo_url: url, prev_image_url: '', saeule: 'angebote', reason: '' } }];` },
    position: [1160, 620]
  },
  output: [{ chat_id: '7582948490', modus: 'neu', typ: 'foto', agent_input: 'Neue Eingabe vom Wirt mit EIGENEM FOTO', photo_url: 'https://i.ibb.co/abc/eingang.png', prev_image_url: '', saeule: 'angebote', reason: '' }]
});

// ===================== ZWEIG 3: TEXT =====================
const textAuftrag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Text-Auftrag',
    parameters: { jsCode: `const e = $('Eingang').first().json;
const r = $('Router').first().json;
const txt = String(e.text || '').trim();
let d = {};
try { d = JSON.parse(r.sess_draft_json || '{}'); } catch (er) { d = {}; }
let modus = 'neu';
let agent_input = '';
if (r.state === 'AWAITING_ANSWER') {
  modus = 'antwort';
  agent_input = 'Antwort des Wirts auf deine Rueckfrage: "' + txt + '". Beruecksichtige die urspruengliche Anfrage samt dieser Antwort und erstelle jetzt EINEN fertigen Social-Media-Post. Stelle nur dann noch eine weitere Rueckfrage, wenn es immer noch voellig unklar ist.';
} else if (r.state === 'DRAFT_OPEN') {
  modus = 'aenderung';
  agent_input = 'AENDERUNGSWUNSCH des Wirts zum aktuellen Entwurf (Headline: "' + String(d.headline || '') + '"): "' + txt + '". Entscheide: Wenn der Wunsch ein ANDERES oder neues Motiv verlangt, setze bild_neu=true. Wenn nur Text oder Details geaendert werden sollen, setze bild_neu=false, damit das bisherige Bild als Basis bleibt und nur angepasst wird. Erstelle einen verbesserten Post, der den Wunsch strikt beachtet. Rufe get_learnings erneut auf und verletze keine gespeicherten Regeln.';
} else {
  modus = 'neu';
  agent_input = 'Neue Eingabe vom Wirt: "' + txt + '". Es wurde KEIN eigenes Foto geschickt - waehle mit get_bildarchiv ein passendes Archiv-Foto als Bildgrundlage. Erstelle daraus EINEN fertigen Social-Media-Post.';
}
return [{ json: { chat_id: e.chat_id, modus: modus, typ: 'text', agent_input: agent_input, photo_url: (modus === 'neu' ? '' : r.sess_photo_url), prev_image_url: String(d.image_url || ''), saeule: String(d.saeule || 'angebote'), reason: (modus === 'aenderung' ? txt : '') } }];` },
    position: [940, 780]
  },
  output: [{ chat_id: '7582948490', modus: 'neu', typ: 'text', agent_input: 'Neue Eingabe vom Wirt', photo_url: '', prev_image_url: '', saeule: 'angebote', reason: '' }]
});

// ===================== ZWEIG 4: TAGESPOST =====================
const tagespostAuftrag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Tagespost-Auftrag',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const heute = $now.setZone('Europe/Berlin');
const wtage = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const saeule = cfg.saeulen_rotation[String(heute.weekday)] || 'angebote';
const agent_input = 'Taeglicher Auto-Post fuer die Saeule "' + saeule + '" am ' + wtage[heute.weekday] + '. Es wurde KEIN eigenes Foto geschickt - waehle mit get_bildarchiv ein passendes Archiv-Foto als Bildgrundlage. Nutze get_speisekarte und die Website-Infos fuer korrekte Fakten. Stelle NIEMALS eine Rueckfrage - entscheide eigenstaendig. Erstelle EINEN fertigen Social-Media-Post.';
return [{ json: { chat_id: String(cfg.telegram_chat_id), modus: 'tagespost', typ: 'schedule', agent_input: agent_input, photo_url: '', prev_image_url: '', saeule: saeule, reason: '' } }];` },
    position: [940, 940]
  },
  output: [{ chat_id: '7582948490', modus: 'tagespost', typ: 'schedule', agent_input: 'Taeglicher Auto-Post', photo_url: '', prev_image_url: '', saeule: 'angebote', reason: '' }]
});

// ===================== REGENERATE (Button "Andere Variante") =====================
const regenAuftrag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Variante-Auftrag',
    parameters: { jsCode: `const r = $('Router').first().json;
const cfg = $('Restaurant-Konfiguration').first().json;
let d = {};
try { d = JSON.parse(r.sess_draft_json || '{}'); } catch (er) { d = {}; }
const agent_input = 'Der Wirt moechte eine ANDERE VARIANTE des aktuellen Entwurfs (bisherige Headline: "' + String(d.headline || '') + '"). Erstelle einen deutlich anderen Post zum selben Anlass: neue Headline, neuer Text, anderes Motiv. Setze bild_neu=true. Wiederhole die bisherige Headline nicht. Rufe get_learnings auf und verletze keine gespeicherten Regeln.';
return [{ json: { chat_id: String(cfg.telegram_chat_id), modus: 'variante', typ: 'callback', agent_input: agent_input, photo_url: r.sess_photo_url, prev_image_url: String(d.image_url || ''), saeule: String(d.saeule || 'angebote'), reason: '' } }];` },
    position: [1600, -80]
  },
  output: [{ chat_id: '7582948490', modus: 'variante', typ: 'callback', agent_input: 'Der Wirt moechte eine ANDERE VARIANTE', photo_url: '', prev_image_url: 'https://i.ibb.co/abc/post.png', saeule: 'angebote', reason: '' }]
});

// ===================== GEMEINSAMER AGENT-PFAD =====================
const auftrag = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Auftrag',
    parameters: { jsCode: `const j = $input.first().json || {};
return [{ json: { chat_id: String(j.chat_id || ''), modus: String(j.modus || 'neu'), typ: String(j.typ || 'text'), agent_input: String(j.agent_input || ''), photo_url: String(j.photo_url || ''), prev_image_url: String(j.prev_image_url || ''), saeule: String(j.saeule || 'angebote'), reason: String(j.reason || '') } }];` },
    position: [1820, 620]
  },
  output: [{ chat_id: '7582948490', modus: 'neu', typ: 'text', agent_input: 'Neue Eingabe vom Wirt', photo_url: '', prev_image_url: '', saeule: 'angebote', reason: '' }]
});

const busySetzen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Status BUSY setzen',
    parameters: { operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: expr('{{ $json.chat_id }}') }] }, columns: { mappingMode: 'defineBelow', value: { chat_id: expr('{{ $json.chat_id }}'), state: 'BUSY', photo_url: expr('{{ $json.photo_url }}'), updated: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: sessionSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [2040, 620]
  },
  output: [{ chat_id: '7582948490', state: 'BUSY' }]
});

const tippenAnzeigen = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Tippen anzeigen',
    parameters: { resource: 'message', operation: 'sendChatAction', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), action: 'upload_photo' },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    onError: 'continueRegularOutput',
    position: [2260, 620]
  },
  output: [{ ok: true, result: true }]
});

const websiteLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Website laden',
    parameters: { method: 'GET', url: expr("{{ $('Restaurant-Konfiguration').first().json.restaurant.website }}"), options: { response: { response: { neverError: true } }, timeout: 15000 } },
    alwaysOutputData: true,
    position: [2480, 620]
  },
  output: [{ data: '<html>...</html>' }]
});

const feiertageLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Feiertage laden',
    parameters: { method: 'GET', url: expr("{{ 'https://feiertage-api.de/api/?nur_land=NW&jahr=' + $now.setZone('Europe/Berlin').year }}"), options: { response: { response: { neverError: true } }, timeout: 15000 } },
    alwaysOutputData: true,
    position: [2700, 620]
  },
  output: [{ Neujahrstag: { datum: '2026-01-01', hinweis: '' } }]
});

const kontext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kontext',
    parameters: { jsCode: `const a = $('Auftrag').first().json;
const heute = $now.setZone('Europe/Berlin');
const wtage = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
let website_text = '';
try {
  const w = $('Website laden').first();
  let html = '';
  if (w && w.json) { if (typeof w.json.data === 'string') html = w.json.data; else if (typeof w.json.body === 'string') html = w.json.body; }
  const reScript = new RegExp('<script[^]*?</script>', 'gi');
  const reStyle = new RegExp('<style[^]*?</style>', 'gi');
  const reTag = new RegExp('<[^>]+>', 'g');
  const reEnt = new RegExp('&[a-z#0-9]+;', 'gi');
  const reWs = new RegExp('[ ' + String.fromCharCode(10) + String.fromCharCode(13) + String.fromCharCode(9) + ']+', 'g');
  website_text = String(html).replace(reScript, ' ').replace(reStyle, ' ').replace(reTag, ' ').replace(reEnt, ' ').replace(reWs, ' ').trim();
  if (website_text.length > 2500) website_text = website_text.slice(0, 2000) + ' [...] ' + website_text.slice(-500);
} catch (e) { website_text = ''; }
const monat = heute.month;
let saison = 'Winter';
if (monat >= 3 && monat <= 5) saison = 'Fruehling';
else if (monat >= 6 && monat <= 8) saison = 'Sommer';
else if (monat >= 9 && monat <= 11) saison = 'Herbst';
let feiertage_text = '';
try {
  const fj = $('Feiertage laden').first().json || {};
  const heuteISO = heute.toISODate();
  const bis = heute.plus({ days: 21 }).toISODate();
  const kommende = [];
  for (const fn in fj) { const d = fj[fn] && fj[fn].datum; if (d && d >= heuteISO && d <= bis) kommende.push(fn + ' (' + d + ')'); }
  if (kommende.length) feiertage_text = kommende.join(', ');
} catch (e) { feiertage_text = ''; }
let agent_input = a.agent_input;
agent_input += ' | HEUTE: ' + wtage[heute.weekday] + ', ' + heute.toISODate() + '. SAISON: ' + saison + '.';
if (feiertage_text) agent_input += ' NAECHSTE FEIERTAGE (NRW): ' + feiertage_text + '. Beziehe passende Feiertage oder die Saison dezent ein, wenn es zum Thema passt.';
if (website_text) agent_input += ' | AKTUELLE WEBSITE-INFOS: ' + website_text;
return [{ json: { agent_input: agent_input, session_key: String(a.chat_id), saeule: a.saeule, datum: heute.toISODate(), modus: a.modus } }];` },
    position: [2920, 620]
  },
  output: [{ agent_input: 'Neue Eingabe vom Wirt ...', session_key: '7582948490', saeule: 'angebote', datum: '2026-08-25', modus: 'neu' }]
});

// ===================== AGENT =====================
const gptModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI gpt-5-mini',
    parameters: { model: { __rl: true, mode: 'list', value: 'gpt-5-mini', cachedResultName: 'gpt-5-mini' } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    position: [3060, 880]
  }
});

const dialogMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.3,
  config: {
    name: 'Gespraechs-Memory',
    parameters: { sessionIdType: 'customKey', sessionKey: expr('{{ $json.session_key }}'), contextWindowLength: 14 },
    position: [3200, 880]
  }
});

const toolLearnings = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_learnings',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die gespeicherten Lern-Regeln aus abgelehnten Posts. IMMER zuerst aufrufen und jede aktive Regel strikt befolgen.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: T_LEARNINGS, cachedResultName: 'pizzarello_learnings' }, returnAll: true },
    position: [3340, 880]
  }
});

const toolAngebote = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_aktuelle_angebote',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die hinterlegten Angebote (typ, titel, beschreibung, preis, gueltig_von, gueltig_bis, aktiv). Nur aktive und aktuell gueltige Angebote verwenden, keine Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: T_ANGEBOTE, cachedResultName: 'pizzarello_angebote' }, returnAll: true },
    position: [3480, 880]
  }
});

const toolSpeisekarte = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_speisekarte',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die komplette Speisekarte des Restaurants (kategorie, name, beschreibung, preis, aktiv). Nutze sie fuer korrekte Gericht-Namen, Zutaten und Preise. Keine Gerichte oder Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: T_SPEISEKARTE, cachedResultName: 'pizzarello_speisekarte' }, returnAll: true },
    position: [3620, 880]
  }
});

const toolBildarchiv = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_bildarchiv',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert das Foto-Archiv des Restaurants (url, kategorie, beschreibung, aktiv). Wenn KEIN eigenes Foto mitgeschickt wurde, waehle hier das thematisch am besten passende aktive Foto und gib dessen url im Feld archiv_foto_url zurueck.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: T_FOTOS, cachedResultName: 'pizzarello_fotos' }, returnAll: true },
    position: [3760, 880]
  }
});

const postParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Post-Schema',
    parameters: { schemaType: 'fromJson', jsonSchemaExample: '{ "needs_clarification": false, "clarification_question": "", "headline": "Frisch aus dem Ofen", "post_text": "Heute Abend duftet es bei uns nach Ofenpizza - komm vorbei und lass es dir schmecken!", "hashtags": ["#pizzarello", "#oberhausen"], "layout": "klassik", "bild_typ": "produkt", "bild_neu": false, "bild_headline": "FRISCH AUS DEM OFEN", "image_brief": "A single pizza on a brushed-metal surface, held by one hand, shot slightly from above", "preis_text": "", "archiv_foto_url": "" }' },
    position: [3900, 880]
  }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Post-Agent',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.agent_input }}'),
      hasOutputParser: true,
      options: {
        maxIterations: 12,
        systemMessage: `Du bist der Social-Media-Creator fuer die Pizzeria Pizzarello in Oberhausen. Du chattest direkt mit dem Wirt in Telegram und erstellst EINEN fertigen Instagram/Facebook/TikTok-Post pro Anfrage.

WERKZEUGE (rufe jedes NUR EINMAL und nur bei Bedarf auf, eine leere Antwort ist normal):
- get_learnings: dauerhafte Stil-Praeferenzen des Wirts aus frueherem Feedback. IMMER zuerst aufrufen und sinngemaess beruecksichtigen. ABER: uebernimm NIEMALS einen Titel, Satz oder ein Bild-Motiv woertlich aus einem Learning - Learnings sind Leitplanken, keine fertigen Vorlagen.
- get_aktuelle_angebote: aktuelle Angebote/Preise. Nur diese verwenden, nichts erfinden.
- get_speisekarte: echte Gerichte, Zutaten und Preise fuer korrekte Fakten.
- get_bildarchiv: vorhandene Restaurant-Fotos (url, kategorie, beschreibung).

BILDGRUNDLAGE:
- Wenn der Wirt KEIN eigenes Foto mitgeschickt hat, rufe get_bildarchiv auf und waehle das thematisch am besten passende aktive Foto. Gib dessen exakte url im Feld archiv_foto_url zurueck.
- Findest du wirklich kein passendes Archiv-Foto (oder das Archiv ist leer), lass archiv_foto_url leer - dann wird ein Bild neu erzeugt.
- Wenn ein eigenes Foto mitgeschickt wurde, lass archiv_foto_url leer.
- Waehle nicht immer dasselbe Archiv-Foto - variiere die Motive.
- Bei bild_typ "flyer" wird das Bild IMMER frisch als Plakat generiert (KEIN Archiv-Foto): lass archiv_foto_url leer und beschreibe in image_brief die Szene/Location des Events (z.B. abendliches Strassenfest vor der Pizzeria mit Lichterketten), NICHT ein einzelnes Gericht.

RUECKFRAGEN (nur bei direktem Wirt-Input):
- Wenn die Eingabe des Wirts wirklich unklar, widerspruechlich oder unvollstaendig ist (z.B. unklar welches Gericht, welches Angebot, welcher Anlass, welcher Preis oder welches Datum gemeint ist) und du ohne diese Info keinen guten Post erstellen kannst, dann stelle GENAU EINE kurze, konkrete Rueckfrage auf Deutsch: setze needs_clarification=true, schreibe die Frage in clarification_question und lass alle anderen Post-Felder leer.
- Die Rueckfrage wird dem Wirt als normale Chat-Nachricht geschickt; seine Antwort kommt als naechste Nachricht zurueck. Formuliere sie also wie im Gespraech, kurz und freundlich.
- Frage NUR, wenn es wirklich noetig ist. Bei kleinen Unklarheiten triff selbst eine sinnvolle, markengerechte Annahme statt zu fragen.
- Bei taeglichen Auto-Posts (kein direkter Wirt-Input) stellst du NIEMALS eine Rueckfrage - entscheide eigenstaendig und setze needs_clarification=false.
- Sobald alles klar ist (auch nach Erhalt einer Antwort auf deine Rueckfrage), setze needs_clarification=false und liefere den fertigen Post.
- Bei einem AENDERUNGSWUNSCH oder einer ANDEREN VARIANTE zu einem bereits gezeigten Entwurf fragst du NICHT nach, sondern lieferst direkt den ueberarbeiteten Post.

Wenn du KEINE Rueckfrage stellst, MUSST du sofort deinen fertigen Post als finale Antwort im vorgegebenen JSON-Schema liefern. Rufe kein Tool ein zweites Mal auf und drehe keine weiteren Runden.

MARKE & TON:
- familiaer-italienisch, herzlich, ein bisschen verspielt, Du-Ansprache.
- VARIIERE die Eroeffnung jedes Posts stark. Beginne NIE mit "Mamma mia". Italienische Ausrufe nur selten, sparsam und nie als erste Worte.
- Erfinde fuer JEDEN Post eine NEUE, eigenstaendige Headline. Wiederhole nie denselben Titel wie in einem frueheren Post oder aus einem Learning. Gerade bei der Saeule "community": variiere Thema und Titel stark und nutze nicht immer "Nachbarschaft".
- Kein Clickbait, keine erfundenen Fakten.

FELDER:
- needs_clarification: true NUR wenn du eine Rueckfrage brauchst, sonst false.
- clarification_question: deine EINE Rueckfrage auf Deutsch, sonst leer.
- headline: kurze, knackige Ueberschrift.
- post_text: 2 bis 5 Saetze, warm und konkret, mit dezentem Call-to-Action. Emojis sparsam.
- hashtags: 3 bis 6 relevante Tags (Basis-Tags werden automatisch ergaenzt).
- layout: genau einer von klassik, menue_karte, angebots_sticker, event_poster, pur, zitat.
- bild_typ: Art des Motivs, genau einer von: produkt (einzelnes Gericht), event (Ambiente/Gaeste-Stimmung), angebot (Rabatt/Preis im Fokus), saison (saisonale Zutaten), flyer (grossflaechige Event-Ankuendigung wie Strassenfest/Themenabend/Public Viewing - plakativ und textbetont), bts (Behind-the-Scenes: Teig, Ofen, Handwerk). Waehle den Typ passend zum Post-Inhalt. Fuer flyer passt layout "event_poster".
- bild_neu: true NUR wenn ein KOMPLETT ANDERES/neues Bild gewuenscht ist. false, wenn das bisherige Bild beibehalten und nur angepasst werden soll. Bei einem ERSTEN Entwurf immer false.
- bild_headline: sehr kurzer Bild-Text (max 40 Zeichen), ASCII ohne Umlaute (ae/oe/ue/ss). Bei layout "pur" leer lassen.
- image_brief: EIN englischer Satz, der das appetitliche Foto-Motiv beschreibt (Gericht/Szene), im MODERNEN Studio-Look (cleaner neutraler Hintergrund, viel Negativraum), nicht rustikal.
- preis_text: NUR bei einem Angebot mit konkretem Preis den exakten Preis im deutschen Format wie "5,99 EUR" oder "5,99 Euro" (NIEMALS einen Preis erfinden - nur der vom Wirt genannte oder der Preis aus get_aktuelle_angebote/get_speisekarte). Sonst LEER. Dieser Preis wird spaeter als echter Badge aufs Bild gestempelt; im image_brief/bild_headline selbst KEINE Zahl/Preis nennen.
- archiv_foto_url: url eines passenden Archiv-Fotos aus get_bildarchiv, sonst leer.`
      }
    },
    subnodes: { model: gptModel, memory: dialogMemory, tools: [toolLearnings, toolAngebote, toolSpeisekarte, toolBildarchiv], outputParser: postParser },
    position: [3140, 620]
  },
  output: [{ output: { needs_clarification: false, headline: 'Frisch aus dem Ofen', post_text: 'Heute Abend duftet es bei uns nach Ofenpizza.', hashtags: ['#pizzarello', '#oberhausen'], layout: 'klassik', bild_typ: 'produkt', bild_neu: false, bild_headline: 'FRISCH AUS DEM OFEN', image_brief: 'A single pizza on a brushed-metal surface', preis_text: '', archiv_foto_url: '' } }]
});

// ===================== RUECKFRAGE =====================
const rueckfrageIf = ifElse({
  version: 2.2,
  config: {
    name: 'Rueckfrage noetig?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.output ? $json.output.needs_clarification === true : false }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [3360, 620]
  }
});

const rueckfrageSenden = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Rueckfrage senden',
    parameters: { resource: 'message', operation: 'sendMessage', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), text: expr("{{ $('Post-Agent').first().json.output.clarification_question }}"), additionalFields: { appendAttribution: false, disable_web_page_preview: true } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [3580, 400]
  },
  output: [{ ok: true, result: { message_id: 13 } }]
});

const sessionWartet = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Session AWAITING_ANSWER',
    parameters: { operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: expr("{{ $('Auftrag').first().json.chat_id }}") }] }, columns: { mappingMode: 'defineBelow', value: { chat_id: expr("{{ $('Auftrag').first().json.chat_id }}"), state: 'AWAITING_ANSWER', updated: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: sessionSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [3800, 400]
  },
  output: [{ chat_id: '7582948490', state: 'AWAITING_ANSWER' }]
});

// ===================== POST AUFBEREITEN =====================
const postAufbereiten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Post aufbereiten',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const k = $('Kontext').first().json;
const o = ($('Post-Agent').first().json.output) || {};
const post = {
  headline: String(o.headline || '').trim(),
  post_text: String(o.post_text || '').trim(),
  hashtags: Array.isArray(o.hashtags) ? o.hashtags : [],
  layout: o.layout,
  bild_typ: String(o.bild_typ || '').trim().toLowerCase(),
  bild_neu: (o.bild_neu === true || o.bild_neu === 'true'),
  bild_headline: String(o.bild_headline || ''),
  image_brief: String(o.image_brief || ''),
  preis_text: String(o.preis_text || '').trim(),
  archiv_foto_url: String(o.archiv_foto_url || '').trim()
};
const EURO = String.fromCharCode(0x20ac);
let preis = post.preis_text.replace(/euro/ig, EURO).replace(/EUR/g, EURO).replace(/  +/g, ' ').trim();
if (!/[0-9]/.test(preis)) preis = '';
if (preis && preis.indexOf(EURO) === -1) preis = preis + ' ' + EURO;
post.preis_text = preis.slice(0, 16);
if (post.archiv_foto_url.indexOf('http') !== 0) post.archiv_foto_url = '';
if (!post.headline || !post.post_text) throw new Error('Agent-Ausgabe unvollstaendig: ' + JSON.stringify(o).slice(0, 300));
const erlaubte = ['klassik', 'menue_karte', 'angebots_sticker', 'event_poster', 'pur', 'zitat'];
if (erlaubte.indexOf(post.layout) === -1) post.layout = 'klassik';
const bildTypen = ['produkt', 'event', 'angebot', 'saison', 'flyer', 'bts'];
if (bildTypen.indexOf(post.bild_typ) === -1) post.bild_typ = '';
if (post.layout === 'pur') post.bild_headline = '';
else if (!post.bild_headline) post.bild_headline = post.headline.split(' ').slice(0, 5).join(' ');
const norm = post.hashtags.map(function (t) { t = String(t).trim().replace(/ /g, ''); if (!t) return ''; return t.charAt(0) === '#' ? t : '#' + t; }).filter(function (t) { return t.length > 1; });
const setTags = cfg.hashtags[k.saeule] || cfg.hashtags.angebote;
post.hashtags = setTags.concat(norm.filter(function (t) { return setTags.indexOf(t) === -1; })).slice(0, 12);
if (!post.image_brief) post.image_brief = 'Appetizing signature dish from ' + cfg.restaurant.name;
return [{ json: { post: post } }];` },
    position: [3580, 620]
  },
  output: [{ post: { headline: 'Frisch aus dem Ofen', post_text: 'Heute Abend duftet es bei uns nach Ofenpizza.', hashtags: ['#pizzarello'], layout: 'klassik', bild_typ: 'produkt', bild_neu: false, bild_headline: 'FRISCH AUS DEM OFEN', image_brief: 'A single pizza', preis_text: '', archiv_foto_url: '' } }]
});

// ===================== BILD-PIPELINE =====================
const bildModus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild-Modus',
    parameters: { jsCode: `const a = $('Auftrag').first().json;
const post = $('Post aufbereiten').first().json.post || {};
let base_url = '';
if (post.bild_typ === 'flyer') base_url = '';
else if (a.modus === 'aenderung' && !post.bild_neu && a.prev_image_url) base_url = a.prev_image_url;
else if (a.photo_url) base_url = a.photo_url;
else if (post.archiv_foto_url) base_url = post.archiv_foto_url;
const mode = base_url ? 'edit_url' : 'generate';
return [{ json: { mode: mode, base_url: base_url, hat_basisfoto: mode === 'edit_url' } }];` },
    position: [3800, 620]
  },
  output: [{ mode: 'edit_url', base_url: 'https://i.ibb.co/abc/archiv.png', hat_basisfoto: true }]
});

const logoLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Logo laden',
    parameters: { method: 'GET', url: expr("{{ $('Restaurant-Konfiguration').first().json.logo_url }}"), authentication: 'predefinedCredentialType', nodeCredentialType: 'microsoftOneDriveOAuth2Api', options: { response: { response: { responseFormat: 'file', outputPropertyName: 'logo' } }, timeout: 30000 } },
    credentials: { microsoftOneDriveOAuth2Api: newCredential('OneDrive Pizzarello') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [4020, 620]
  },
  output: [{}]
});

const basisfotoIf = ifElse({
  version: 2.2,
  config: {
    name: 'Mit Basisfoto?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Bild-Modus').first().json.hat_basisfoto }}"), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [4240, 620]
  }
});

const basisfotoLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Basisfoto laden',
    parameters: { method: 'GET', url: expr("{{ $('Bild-Modus').first().json.base_url }}"), options: { response: { response: { responseFormat: 'file', outputPropertyName: 'basis' } }, timeout: 30000 } },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [4460, 460]
  },
  output: [{}]
});

const bildRequestEdit = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild-Request bauen (Foto)',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const a = $('Auftrag').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
const istAnpassung = (a.modus === 'aenderung' && !post.bild_neu && a.prev_image_url);
let prompt = '';
if (istAnpassung) {
  prompt += 'Das erste beigefuegte Bild ist der AKTUELLE Post-Entwurf. Behalte Komposition, Gericht, Hintergrund, Personen, Farben, Licht und Gesamtstil im Wesentlichen GLEICH. Erfinde die Szene nicht neu. Setze NUR den folgenden Aenderungswunsch um: "' + String(a.reason || 'kleine Verbesserung') + '". ';
} else {
  prompt += 'Erstelle aus dem beigefuegten Foto ein fertiges Social-Media-Post-Bild im Hochformat 2:3 fuer eine italienische Pizzeria. Uebernimm das Gericht, die Komposition und das Setting treu - ersetze oder erfinde keine Speisen und keine Personen. ';
  prompt += (g.grading || '') + ' ';
}
prompt += 'ES SIND ZWEI BILDER BEIGEFUEGT: 1) das FOTO als Bildgrundlage, 2) das PIZZARELLO-LOGO. ';
prompt += '- Das beigefuegte Foto treu uebernehmen (Gericht, Komposition, Personen nicht veraendern). ';
prompt += '- Das beigefuegte Logo GENAU EINMAL, unveraendert in Form und Farbe, dezent und klein in eine ruhige Ecke integrieren (bevorzugt oben rechts) - als natuerlicher Teil der Aufnahme, nicht als aufgeklebtes Element. ';
prompt += '- Erfinde KEIN eigenes Logo, keinen Schriftzug, kein Emblem. ';
prompt += 'Rendere KEINEN Preis, keine Zahl, kein Prozentzeichen und kein Waehrungssymbol - Preise werden spaeter als echter Badge aufgestempelt. ';
if (String(post.preis_text || '') !== '') { prompt += 'Halte den Bereich UNTEN RECHTS ruhig und frei fuer einen runden Preis-Badge, der spaeter aufkomponiert wird. '; }
prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
if (post.layout === 'pur' || !headline) { prompt += 'Rendere KEINE Headline und keinen anderen Text im Bild. '; }
else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY, letter for letter, as: "' + headline + '". Perfect spelling is critical. Use a modern geometric sans-serif (Poppins, Medium or Regular weight), in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. No other text anywhere. '; }
prompt += (g.text_safety || '') + ' ' + (g.negativ || '') + ' No watermark, no border, tack-sharp, high-resolution, clean, no film grain or noise.';
const logoBin = $('Logo laden').first().binary || {};
const inBin = $input.first().binary || {};
const binary = {};
if (inBin.basis) binary.image0 = inBin.basis;
if (logoBin.logo) binary.logo = logoBin.logo;
if (!binary.image0) throw new Error('Basisfoto-Binary fehlt');
if (!binary.logo) throw new Error('Logo-Binary fehlt');
return [{ json: { prompt: prompt, size: String(cfg.bild_size || '1024x1536') }, binary: binary }];` },
    position: [4680, 460]
  },
  output: [{ prompt: 'ES SIND ZWEI BILDER BEIGEFUEGT ...', size: '1024x1536' }]
});

const bildRequestGen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild-Request bauen (Logo)',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
function pickModul(saeule, layout) {
  if (layout === 'event_poster') return 'event';
  if (saeule === 'saisonal') return 'saison';
  if (saeule === 'angebote' || layout === 'angebots_sticker') return 'angebot';
  if (saeule === 'community') return 'bts';
  return 'produkt';
}
const modul = (g.module || {})[post.bild_typ] || (g.module || {})[pickModul(k.saeule, post.layout)] || '';
const fontHint = (post.bild_typ === 'flyer') ? 'a bold CONDENSED modern sans-serif (Barlow Condensed or Archivo Narrow)' : 'a modern geometric sans-serif (Poppins, Medium or Regular weight)';
let prompt = 'Erzeuge ein neues Bild im Hochformat 2:3. ' + post.image_brief + ' ' + (g.markenkern || '') + ' ' + modul + ' ';
prompt += 'ES IST EIN BILD BEIGEFUEGT: das PIZZARELLO-LOGO. ';
prompt += '- Das beigefuegte Logo GENAU EINMAL, unveraendert in Form und Farbe, dezent und klein in eine ruhige Ecke integrieren (bevorzugt oben rechts) - als natuerlicher Teil der Aufnahme, nicht als aufgeklebtes Element. ';
prompt += '- Erfinde KEIN eigenes Logo, keinen Schriftzug, kein Emblem. Uebernimm das Logo NICHT als Bildmotiv - das Motiv ist die oben beschriebene Szene. ';
prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
prompt += 'Rendere KEINEN Preis, keine Zahl, kein Prozentzeichen und kein Waehrungssymbol - Preise werden spaeter als echter Badge aufgestempelt. ';
if (String(post.preis_text || '') !== '') { prompt += 'Halte den Bereich UNTEN RECHTS ruhig und frei fuer einen runden Preis-Badge, der spaeter aufkomponiert wird. '; }
if (post.layout === 'pur' || !headline) { prompt += 'Rendere KEINE Headline und keinen Text im Bild. '; }
else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY, letter for letter, as: "' + headline + '". Perfect spelling is critical, no other words. Use ' + fontHint + ', in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. '; }
prompt += (g.text_safety || '') + ' ' + (g.negativ || '');
const logoBin = $('Logo laden').first().binary || {};
const binary = {};
if (logoBin.logo) binary.logo = logoBin.logo;
if (!binary.logo) throw new Error('Logo-Binary fehlt');
return [{ json: { prompt: prompt, size: String(cfg.bild_size || '1024x1536') }, binary: binary }];` },
    position: [4680, 780]
  },
  output: [{ prompt: 'Erzeuge ein neues Bild im Hochformat 2:3 ...', size: '1024x1536' }]
});

const gptBildFoto = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GPT Bild (Foto + Logo)',
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/edits', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [{ name: 'model', value: 'gpt-image-1' }, { name: 'prompt', value: expr('{{ $json.prompt }}') }, { name: 'size', value: expr('{{ $json.size }}') }, { name: 'quality', value: 'high' }, { name: 'input_fidelity', value: 'high' }, { name: 'n', value: '1' }, { parameterType: 'formBinaryData', name: 'image[]', inputDataFieldName: 'image0' }, { parameterType: 'formBinaryData', name: 'image[]', inputDataFieldName: 'logo' }] }, options: { response: { response: { responseFormat: 'json' } }, timeout: 240000 } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    position: [4900, 460]
  },
  output: [{ data: [{ b64_json: 'xxxx' }] }]
});

const gptBildLogo = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GPT Bild (nur Logo)',
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/edits', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [{ name: 'model', value: 'gpt-image-1' }, { name: 'prompt', value: expr('{{ $json.prompt }}') }, { name: 'size', value: expr('{{ $json.size }}') }, { name: 'quality', value: 'high' }, { name: 'n', value: '1' }, { parameterType: 'formBinaryData', name: 'image[]', inputDataFieldName: 'logo' }] }, options: { response: { response: { responseFormat: 'json' } }, timeout: 240000 } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
    position: [4900, 780]
  },
  output: [{ data: [{ b64_json: 'xxxx' }] }]
});

const bildExtrahieren = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild extrahieren',
    parameters: { jsCode: `const b64 = $json.data && $json.data[0] && $json.data[0].b64_json;
if (!b64) throw new Error('OpenAI Bild fehlt: ' + JSON.stringify($json).slice(0, 300));
const binary = {};
binary.data = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'post.png', 'image/png');
return [{ json: { image_b64_len: b64.length }, binary: binary }];` },
    position: [5120, 620]
  },
  output: [{ image_b64_len: 120000 }]
});

const preisIf = ifElse({
  version: 2.2,
  config: {
    name: 'Preis-Badge?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }] } },
    position: [5340, 620]
  }
});

const preisBadge = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Preis-Badge stempeln',
    parameters: {
      operation: 'multiStep',
      dataPropertyName: 'data',
      operations: {
        operations: [
          { operation: 'draw', primitive: 'circle', color: '#C8102E', startPositionX: 852, startPositionY: 1364, endPositionX: 852, endPositionY: 1216 },
          { operation: 'draw', primitive: 'circle', color: '#F5E6C8', startPositionX: 852, startPositionY: 1364, endPositionX: 852, endPositionY: 1228 },
          { operation: 'text', text: 'nur', fontSize: 34, fontColor: '#3a322a', positionX: 826, positionY: 1327 },
          { operation: 'text', text: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), fontSize: 60, fontColor: '#C8102E', positionX: expr("{{ 852 - Math.round((($('Post aufbereiten').first().json.post.preis_text || '').length) * 15) }}"), positionY: 1420 }
        ]
      },
      options: { destinationKey: 'data', format: 'png', quality: 100 }
    },
    position: [5560, 460]
  },
  output: [{}]
});

const finalExtract = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Finalbild extrahieren',
    parameters: { jsCode: `let b64 = null;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); if (buf && buf.length > 0) b64 = buf.toString('base64'); } catch (e) {}
if (!b64) throw new Error('Finales Bild konnte nicht gelesen werden');
return [{ json: { image_b64: b64 } }];` },
    position: [5780, 620]
  },
  output: [{ image_b64: 'xxxx' }]
});

const imgbbUpload = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'imgbb hochladen',
    parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr('{{ $json.image_b64 }}') }] }, options: {} },
    credentials: { httpCustomAuth: newCredential('imgbb') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    position: [6000, 620]
  },
  output: [{ data: { url: 'https://i.ibb.co/abc/post.png' } }]
});

// ===================== ENTWURF SENDEN =====================
const entwurfDaten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Entwurf-Daten bauen',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const p = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const a = $('Auftrag').first().json;
const url = $json.data && $json.data.url;
if (!url) throw new Error('imgbb lieferte keine URL: ' + JSON.stringify($json).slice(0, 300));
const NL = String.fromCharCode(10);
const OK = String.fromCodePoint(0x2705);
const NEU = String.fromCodePoint(0x1F504);
const WEG = String.fromCodePoint(0x1F5D1);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const emoji = { angebote: String.fromCodePoint(0x1F355), saisonal: String.fromCodePoint(0x1F33F), community: String.fromCodePoint(0x2764) };
const post_id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
const aktive = (cfg.buffer.kanaele || []).filter(function (kk) { return kk.aktiv && kk.channelId && String(kk.channelId).indexOf('<') === -1; });
const kanalNamen = aktive.map(function (kk) { return kk.name; }).join(', ');
const caption = ('<b>' + (emoji[k.saeule] || '') + ' ' + esc(p.headline) + '</b>').slice(0, 1000);
let text = '<b>' + esc(p.headline) + '</b>' + NL + NL + esc(p.post_text) + NL + NL + esc(p.hashtags.join(' ')) + NL + NL;
text += 'Geplant fuer heute ' + cfg.buffer.posting_zeit + ' Uhr auf: ' + esc(kanalNamen || 'kein aktiver Kanal') + NL;
text += 'Saeule: ' + esc(k.saeule) + ' | Layout: ' + esc(p.layout) + NL + NL;
text += 'Was soll ich damit machen? Du kannst auch einfach schreiben, was anders werden soll.';
const draft = { post_id: post_id, image_url: url, headline: p.headline, post_text: p.post_text, hashtags: p.hashtags, layout: p.layout, bild_typ: p.bild_typ, preis_text: p.preis_text, saeule: k.saeule, datum: k.datum, photo_url: a.photo_url || '' };
return [{ json: {
  post_id: post_id,
  image_url: url,
  caption: caption,
  entscheidungs_text: text.slice(0, 4000),
  draft_json: JSON.stringify(draft),
  btn_ok: OK + ' Freigeben',
  btn_neu: NEU + ' Andere Variante',
  btn_weg: WEG + ' Verwerfen',
  cb_ok: 'ok:' + post_id,
  cb_neu: 'neu:' + post_id,
  cb_weg: 'weg:' + post_id
} }];` },
    position: [6220, 620]
  },
  output: [{ post_id: '1756100000000-a1b2c3', image_url: 'https://i.ibb.co/abc/post.png', caption: '<b>Frisch aus dem Ofen</b>', entscheidungs_text: 'Frisch aus dem Ofen ...', draft_json: '{}', btn_ok: 'Freigeben', btn_neu: 'Andere Variante', btn_weg: 'Verwerfen', cb_ok: 'ok:1', cb_neu: 'neu:1', cb_weg: 'weg:1' }]
});

const fotoSenden = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Entwurf-Foto senden',
    parameters: { resource: 'message', operation: 'sendPhoto', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), binaryData: false, file: expr('{{ $json.image_url }}'), additionalFields: { caption: expr('{{ $json.caption }}'), parse_mode: 'HTML' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [6440, 620]
  },
  output: [{ ok: true, result: { message_id: 20 } }]
});

const entscheidungSenden = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Entscheidung senden',
    parameters: {
      resource: 'message',
      operation: 'sendMessage',
      chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"),
      text: expr("{{ $('Entwurf-Daten bauen').first().json.entscheidungs_text }}"),
      replyMarkup: 'inlineKeyboard',
      inlineKeyboard: {
        rows: [
          { row: { buttons: [{ text: expr("{{ $('Entwurf-Daten bauen').first().json.btn_ok }}"), additionalFields: { callback_data: expr("{{ $('Entwurf-Daten bauen').first().json.cb_ok }}") } }] } },
          { row: { buttons: [{ text: expr("{{ $('Entwurf-Daten bauen').first().json.btn_neu }}"), additionalFields: { callback_data: expr("{{ $('Entwurf-Daten bauen').first().json.cb_neu }}") } }, { text: expr("{{ $('Entwurf-Daten bauen').first().json.btn_weg }}"), additionalFields: { callback_data: expr("{{ $('Entwurf-Daten bauen').first().json.cb_weg }}") } }] } }
        ]
      },
      additionalFields: { appendAttribution: false, parse_mode: 'HTML', disable_web_page_preview: true }
    },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [6660, 620]
  },
  output: [{ ok: true, result: { message_id: 21 } }]
});

const sessionDraftOpen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Session DRAFT_OPEN',
    parameters: { operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: expr("{{ $('Auftrag').first().json.chat_id }}") }] }, columns: { mappingMode: 'defineBelow', value: { chat_id: expr("{{ $('Auftrag').first().json.chat_id }}"), state: 'DRAFT_OPEN', post_id: expr("{{ $('Entwurf-Daten bauen').first().json.post_id }}"), draft_json: expr("{{ $('Entwurf-Daten bauen').first().json.draft_json }}"), photo_url: expr("{{ $('Auftrag').first().json.photo_url }}"), last_message_id: expr('{{ $json.result.message_id }}'), updated: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: sessionSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [6880, 620]
  },
  output: [{ chat_id: '7582948490', state: 'DRAFT_OPEN' }]
});

// ===================== FREIGABE -> BUFFER =====================
const freigabeVorbereiten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Freigabe vorbereiten',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const r = $('Router').first().json;
let d = {};
try { d = JSON.parse(r.sess_draft_json || '{}'); } catch (e) { d = {}; }
if (!d.image_url) throw new Error('Entwurf konnte nicht gelesen werden (draft_json leer)');
const kanaele = (cfg.buffer.kanaele || []).filter(function (k) { return k.aktiv && k.channelId && String(k.channelId).indexOf('<') === -1; });
const braucht_vertikal = kanaele.some(function (k) { return k.format === 'vertical'; });
const parts = String(cfg.buffer.posting_zeit || '17:00').split(':');
let due = $now.setZone('Europe/Berlin').set({ hour: Number(parts[0]), minute: Number(parts[1] || 0), second: 0, millisecond: 0 });
if (due.diffNow('minutes').minutes < 15) due = due.plus({ days: 1 });
return [{ json: {
  post_id: String(d.post_id || r.sess_post_id || ''),
  image_url: String(d.image_url),
  headline: String(d.headline || ''),
  post_text: String(d.post_text || ''),
  hashtags: Array.isArray(d.hashtags) ? d.hashtags : [],
  saeule: String(d.saeule || 'angebote'),
  datum: String(d.datum || $now.setZone('Europe/Berlin').toISODate()),
  preis_text: String(d.preis_text || ''),
  kanaele: kanaele,
  kanal_anzahl: kanaele.length,
  braucht_vertikal: braucht_vertikal,
  dueAt: due.toUTC().toISO({ suppressMilliseconds: true }),
  zeit_text: due.toFormat('dd.MM. HH:mm')
} }];` },
    position: [1600, -320]
  },
  output: [{ post_id: '1756100000000-a1b2c3', image_url: 'https://i.ibb.co/abc/post.png', headline: 'Frisch aus dem Ofen', post_text: 'x', hashtags: ['#pizzarello'], saeule: 'angebote', datum: '2026-08-25', preis_text: '', kanaele: [{ key: 'instagram', name: 'Instagram', channelId: '6a805d6bb2d9d57743816131', aktiv: true, format: 'master', tags: 'max5' }], kanal_anzahl: 1, braucht_vertikal: false, dueAt: '2026-08-25T15:00:00Z', zeit_text: '25.08. 17:00' }]
});

const kanaeleIf = ifElse({
  version: 2.2,
  config: {
    name: 'Kanal aktiv?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.kanal_anzahl }}'), rightValue: 0, operator: { type: 'number', operation: 'gt' } }] } },
    position: [1820, -320]
  }
});

const keinKanalMelden = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Kein Kanal melden',
    parameters: { resource: 'message', operation: 'editMessageText', messageType: 'message', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), messageId: expr("{{ $('Router').first().json.sess_last_message_id }}"), text: expr("{{ $('Freigabe-Ergebnis-Text').first().json.text }}"), replyMarkup: 'none', additionalFields: { parse_mode: 'HTML' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [2260, -160]
  },
  output: [{ ok: true, result: { message_id: 21 } }]
});

const keinKanalText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Freigabe-Ergebnis-Text',
    parameters: { jsCode: `const f = $('Freigabe vorbereiten').first().json;
const NL = String.fromCharCode(10);
const WARN = String.fromCodePoint(0x26A0);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const text = '<b>' + WARN + ' Freigegeben - aber kein Kanal aktiv</b>' + NL + NL + '<i>' + esc(f.headline) + '</i>' + NL + NL + 'Der Post konnte nirgends eingeplant werden, weil aktuell kein Social-Media-Kanal verbunden ist. Bitte die Buffer-Kanal-ID im Workflow eintragen.' + NL + NL + 'Bild: ' + esc(f.image_url);
return [{ json: { text: text.slice(0, 4000) } }];` },
    position: [2040, -160]
  },
  output: [{ text: 'Freigegeben - aber kein Kanal aktiv' }]
});

const vertikalIf = ifElse({
  version: 2.2,
  config: {
    name: 'Braucht Hochformat?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Freigabe vorbereiten').first().json.braucht_vertikal }}"), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [2040, -480]
  }
});

const masterLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Master laden',
    parameters: { method: 'GET', url: expr("{{ $('Freigabe vorbereiten').first().json.image_url }}"), options: { response: { response: { responseFormat: 'file', outputPropertyName: 'data' } }, timeout: 30000 } },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [2260, -640]
  },
  output: [{}]
});

const tiktokBg = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Hochformat Hintergrund',
    parameters: {
      operation: 'multiStep',
      dataPropertyName: 'data',
      operations: { operations: [
        { operation: 'resize', width: 1080, height: 1920, resizeOption: 'ignoreAspectRatio' },
        { operation: 'blur', blur: 45, sigma: 22 }
      ] },
      options: { destinationKey: 'bg', format: 'png', quality: 90 }
    },
    position: [2480, -640]
  },
  output: [{}]
});

const tiktokFg = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Hochformat Vordergrund',
    parameters: { operation: 'resize', dataPropertyName: 'data', width: 1080, height: 1620, resizeOption: 'ignoreAspectRatio', options: { destinationKey: 'fg', format: 'png', quality: 100 } },
    position: [2700, -640]
  },
  output: [{}]
});

const tiktokComposite = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Hochformat komponieren',
    parameters: { operation: 'composite', dataPropertyName: 'bg', dataPropertyNameComposite: 'fg', operator: 'Over', positionX: 0, positionY: 150, options: { destinationKey: 'data', format: 'png', quality: 100 } },
    position: [2920, -640]
  },
  output: [{}]
});

const vertikalExtract = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Hochformat extrahieren',
    parameters: { jsCode: `let b64 = null;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); if (buf && buf.length > 0) b64 = buf.toString('base64'); } catch (e) {}
if (!b64) throw new Error('Hochformat-Variante konnte nicht gelesen werden');
return [{ json: { image_b64: b64 } }];` },
    position: [3140, -640]
  },
  output: [{ image_b64: 'xxxx' }]
});

const imgbbVertikal = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'imgbb Hochformat',
    parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr('{{ $json.image_b64 }}') }] }, options: {} },
    credentials: { httpCustomAuth: newCredential('imgbb') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    position: [3360, -640]
  },
  output: [{ data: { url: 'https://i.ibb.co/abc/post_9x16.png' } }]
});

const bufferRequests = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Buffer-Requests bauen',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const f = $('Freigabe vorbereiten').first().json;
let vertikal_url = '';
try { vertikal_url = String(($('imgbb Hochformat').first().json.data || {}).url || ''); } catch (e) { vertikal_url = ''; }
const q = 'mutation($input: CreatePostInput!){ createPost(input:$input){ __typename ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }';
const NL2 = String.fromCharCode(10) + String.fromCharCode(10);
const tagsFull = f.hashtags.join(' ');
const tagsMax5 = f.hashtags.slice(0, 5).join(' ');
const meta = {
  facebook: { facebook: { type: 'post' } },
  instagram: { instagram: { type: 'post', shouldShareToFeed: true } },
  pinterest: { pinterest: { title: String(f.headline).slice(0, 100), url: cfg.buffer.pinterest_url } }
};
const out = [];
for (const k of f.kanaele) {
  const bild = (k.format === 'vertical') ? (vertikal_url || f.image_url) : f.image_url;
  const tags = (k.tags === 'max5') ? tagsMax5 : tagsFull;
  const input = { text: f.post_text + NL2 + tags, channelId: k.channelId, schedulingType: 'automatic', mode: 'customScheduled', dueAt: f.dueAt, assets: [{ image: { url: bild } }] };
  if (meta[k.key]) input.metadata = meta[k.key];
  out.push({ json: { kanal_key: k.key, kanal_name: k.name, bild_url: bild, graphql: { query: q, variables: { input: input } } } });
}
return out;` },
    position: [3580, -480]
  },
  output: [{ kanal_key: 'instagram', kanal_name: 'Instagram', bild_url: 'https://i.ibb.co/abc/post.png', graphql: { query: 'mutation...' } }]
});

const bufferPost = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Buffer Post planen',
    parameters: { method: 'POST', url: 'https://api.buffer.com', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.graphql) }}'), options: { response: { response: { neverError: true } }, timeout: 60000 } },
    credentials: { httpHeaderAuth: newCredential('Buffer') },
    alwaysOutputData: true,
    position: [3800, -480]
  },
  output: [{ data: { createPost: { post: { id: 'p1', dueAt: '2026-08-25T15:00:00Z' } } } }]
});

const freigabeErgebnis = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Freigabe-Ergebnis',
    parameters: { jsCode: `const f = $('Freigabe vorbereiten').first().json;
const reqs = $('Buffer-Requests bauen').all().map(function (i) { return i.json; });
const items = $input.all();
const NL = String.fromCharCode(10);
const OK = String.fromCodePoint(0x2705);
const FAIL = String.fromCodePoint(0x274C);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const ids = [], zeilen = [], kanalNamen = [], urls = [];
let okCount = 0;
items.forEach(function (i, idx) {
  const req = reqs[idx] || { kanal_name: 'unbekannt', kanal_key: 'unbekannt', bild_url: '' };
  const cp = i.json && i.json.data && i.json.data.createPost;
  if (cp && cp.post) {
    okCount++;
    ids.push(req.kanal_key + ':' + cp.post.id);
    kanalNamen.push(req.kanal_name);
    urls.push(req.kanal_key + '=' + req.bild_url);
    let zeit = '';
    try { zeit = DateTime.fromISO(String(cp.post.dueAt)).setZone('Europe/Berlin').toFormat('dd.MM. HH:mm'); } catch (e) { zeit = f.zeit_text; }
    zeilen.push(OK + ' ' + req.kanal_name + ' - geplant fuer ' + zeit + ' Uhr');
  } else {
    let msg = 'unbekannter Fehler';
    if (cp && cp.message) msg = String(cp.message);
    else if (i.json && i.json.errors) msg = JSON.stringify(i.json.errors).slice(0, 120);
    ids.push(req.kanal_key + ':ERROR ' + msg);
    urls.push(req.kanal_key + '=' + req.bild_url);
    zeilen.push(FAIL + ' ' + req.kanal_name + ' - ' + msg);
  }
});
const kopf = okCount > 0 ? '<b>' + OK + ' Freigegeben</b>' : '<b>' + FAIL + ' Uebergabe an Buffer fehlgeschlagen</b>';
const fuss = okCount > 0 ? 'Du musst nichts weiter tun.' : 'Bitte pruefe die Buffer-Verbindung.';
const text = kopf + NL + NL + '<i>' + esc(f.headline) + '</i>' + NL + NL + zeilen.map(esc).join(NL) + NL + NL + fuss;
return [{ json: {
  bestaetigung: text.slice(0, 4000),
  datum: f.datum,
  saeule: f.saeule,
  headline: f.headline,
  post_text: f.post_text,
  hashtags: f.hashtags.join(' '),
  image_url: f.image_url,
  status: okCount > 0 ? 'GEPLANT' : 'FEHLER',
  buffer_ids: ids.join(' | '),
  kanaele: (kanalNamen.join(', ') || 'keiner') + (urls.length ? ' | ' + urls.join(' ') : ''),
  geplant_fuer: f.zeit_text
} }];` },
    position: [4020, -480]
  },
  output: [{ bestaetigung: 'Freigegeben', datum: '2026-08-25', saeule: 'angebote', headline: 'x', post_text: 'x', hashtags: '#x', image_url: 'https://i.ibb.co/abc/post.png', status: 'GEPLANT', buffer_ids: 'instagram:p1', kanaele: 'Instagram', geplant_fuer: '25.08. 17:00' }]
});

const logSchreiben = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log schreiben',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: T_POSTLOG, cachedResultName: 'pizzarello_post_log' }, columns: { mappingMode: 'defineBelow', value: { datum: expr('{{ $json.datum }}'), saeule: expr('{{ $json.saeule }}'), headline: expr('{{ $json.headline }}'), post_text: expr('{{ $json.post_text }}'), hashtags: expr('{{ $json.hashtags }}'), image_url: expr('{{ $json.image_url }}'), status: expr('{{ $json.status }}'), buffer_ids: expr('{{ $json.buffer_ids }}'), kanaele: expr('{{ $json.kanaele }}'), geplant_fuer: expr('{{ $json.geplant_fuer }}') }, matchingColumns: [], schema: logSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [4240, -480]
  },
  output: [{ datum: '2026-08-25' }]
});

const freigabeBestaetigen = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Freigabe bestaetigen',
    parameters: { resource: 'message', operation: 'editMessageText', messageType: 'message', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), messageId: expr("{{ $('Router').first().json.sess_last_message_id }}"), text: expr("{{ $('Freigabe-Ergebnis').first().json.bestaetigung }}"), replyMarkup: 'none', additionalFields: { parse_mode: 'HTML' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [4460, -480]
  },
  output: [{ ok: true, result: { message_id: 21 } }]
});

// ===================== VERWERFEN =====================
const verwurfDaten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Verwurf-Daten',
    parameters: { jsCode: `const r = $('Router').first().json;
let d = {};
try { d = JSON.parse(r.sess_draft_json || '{}'); } catch (e) { d = {}; }
const NL = String.fromCharCode(10);
const WEG = String.fromCodePoint(0x1F5D1);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const text = '<b>' + WEG + ' Verworfen</b>' + NL + NL + '<i>' + esc(String(d.headline || '')) + '</i>' + NL + NL + 'Der Entwurf geht nicht raus. Schreib mir einfach, wenn du etwas Neues brauchst.';
return [{ json: {
  bestaetigung: text.slice(0, 4000),
  datum: String(d.datum || $now.setZone('Europe/Berlin').toISODate()),
  saeule: String(d.saeule || 'angebote'),
  headline: String(d.headline || ''),
  post_text: String(d.post_text || ''),
  hashtags: Array.isArray(d.hashtags) ? d.hashtags.join(' ') : '',
  image_url: String(d.image_url || ''),
  status: 'VERWORFEN',
  buffer_ids: 'per Button verworfen',
  kanaele: 'keiner',
  geplant_fuer: ''
} }];` },
    position: [1600, 180]
  },
  output: [{ bestaetigung: 'Verworfen', datum: '2026-08-25', saeule: 'angebote', headline: 'x', post_text: 'x', hashtags: '#x', image_url: 'https://i.ibb.co/abc/post.png', status: 'VERWORFEN', buffer_ids: 'per Button verworfen', kanaele: 'keiner', geplant_fuer: '' }]
});

const verwurfLoggen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Verwurf loggen',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: T_POSTLOG, cachedResultName: 'pizzarello_post_log' }, columns: { mappingMode: 'defineBelow', value: { datum: expr('{{ $json.datum }}'), saeule: expr('{{ $json.saeule }}'), headline: expr('{{ $json.headline }}'), post_text: expr('{{ $json.post_text }}'), hashtags: expr('{{ $json.hashtags }}'), image_url: expr('{{ $json.image_url }}'), status: expr('{{ $json.status }}'), buffer_ids: expr('{{ $json.buffer_ids }}'), kanaele: expr('{{ $json.kanaele }}'), geplant_fuer: expr('{{ $json.geplant_fuer }}') }, matchingColumns: [], schema: logSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [1820, 180]
  },
  output: [{ status: 'VERWORFEN' }]
});

const verwurfBestaetigen = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Verwurf bestaetigen',
    parameters: { resource: 'message', operation: 'editMessageText', messageType: 'message', chatId: expr("{{ $('Restaurant-Konfiguration').first().json.telegram_chat_id }}"), messageId: expr("{{ $('Router').first().json.sess_last_message_id }}"), text: expr("{{ $('Verwurf-Daten').first().json.bestaetigung }}"), replyMarkup: 'none', additionalFields: { parse_mode: 'HTML' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [2040, 180]
  },
  output: [{ ok: true, result: { message_id: 21 } }]
});

const sessionZuruecksetzen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Session zuruecksetzen',
    parameters: { operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: T_SESSIONS, cachedResultName: 'pizzarello_sessions' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'chat_id', condition: 'eq', keyValue: expr("{{ $('Eingang').first().json.chat_id }}") }] }, columns: { mappingMode: 'defineBelow', value: { chat_id: expr("{{ $('Eingang').first().json.chat_id }}"), state: 'IDLE', post_id: '', draft_json: '', photo_url: '', updated: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: sessionSchema, attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [4680, -160]
  },
  output: [{ chat_id: '7582948490', state: 'IDLE' }]
});

// ===================== LEARNING-SCHLEIFE =====================
const aenderungIf = ifElse({
  version: 2.2,
  config: {
    name: 'Aenderungswunsch?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.modus }}'), rightValue: 'aenderung', operator: { type: 'string', operation: 'equals' } }] } },
    position: [1160, 940]
  }
});

const bewertungsAnfrage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bewertungs-Anfrage',
    parameters: { jsCode: `const reason = String($('Text-Auftrag').first().json.reason || '');
const prompt = 'Ein Gastronom hat einen Social-Media-Post-Entwurf bemaengelt. Begruendung: "' + reason + '". Entscheide, ob daraus eine DAUERHAFTE, allgemein gueltige Regel fuer ALLE kuenftigen Posts wird, oder ob es nur eine EINMALIGE Korrektur fuer genau diesen einen Post ist (z.B. ein konkreter Titel, ein konkreter Preis oder ein bestimmtes Motiv fuer diesen Anlass). Einmalige Titel-, Text- oder Preiswuensche und Bezuege auf "diesen Post" sind NICHT dauerhaft. Formuliere eine dauerhafte Regel nur, wenn sie sinnvoll auf jeden kuenftigen Post anwendbar ist. Antworte NUR mit JSON: {"dauerhaft": true oder false, "kind": "bild|text|stil|allgemein", "regel": "eine knappe verallgemeinerte Regel in Du-Form, die immer gilt; leer wenn nicht dauerhaft"}.';
return [{ json: { openai_body: { model: 'gpt-5-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } } } }];` },
    position: [1380, 1100]
  },
  output: [{ openai_body: { model: 'gpt-5-mini' } }]
});

const learningBewerten = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Learning bewerten',
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/chat/completions', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.openai_body) }}'), options: { timeout: 60000, response: { response: { neverError: true } } } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    alwaysOutputData: true,
    position: [1600, 1100]
  },
  output: [{ choices: [{ message: { content: '{"dauerhaft":false,"kind":"text","regel":""}' } }] }]
});

const learningParsen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Learning parsen',
    parameters: { jsCode: `const a = $('Text-Auftrag').first().json;
let dauerhaft = false, kind = 'allgemein', regel = '';
try {
  const content = $json.choices[0].message.content;
  const p = JSON.parse(content);
  dauerhaft = p.dauerhaft === true;
  kind = String(p.kind || 'allgemein');
  regel = String(p.regel || '').trim();
} catch (e) { dauerhaft = false; }
if (!regel) dauerhaft = false;
return [{ json: { dauerhaft: dauerhaft, kind: kind, regel: regel, reason: String(a.reason || ''), saeule: String(a.saeule || 'angebote') } }];` },
    position: [1820, 1100]
  },
  output: [{ dauerhaft: false, kind: 'text', regel: '', reason: 'Der Titel ist zu lang', saeule: 'angebote' }]
});

const dauerhaftIf = ifElse({
  version: 2.2,
  config: {
    name: 'Dauerhaft?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.dauerhaft }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [2040, 1100]
  }
});

const learningSpeichern = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Learning speichern',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: T_LEARNINGS, cachedResultName: 'pizzarello_learnings' }, columns: { mappingMode: 'defineBelow', value: { saeule: expr('{{ $json.saeule }}'), kind: expr('{{ $json.kind }}'), reason: expr('{{ $json.reason }}'), learning: expr('{{ $json.regel }}'), aktiv: expr('{{ true }}') }, matchingColumns: [], schema: [{ id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false }, { id: 'kind', displayName: 'kind', type: 'string', required: false, display: true, removed: false }, { id: 'reason', displayName: 'reason', type: 'string', required: false, display: true, removed: false }, { id: 'learning', displayName: 'learning', type: 'string', required: false, display: true, removed: false }, { id: 'aktiv', displayName: 'aktiv', type: 'boolean', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: false }, options: {} },
    position: [2260, 1020]
  },
  output: [{ regel: 'Halte Titel kurz.' }]
});

const learningVerwerfen = node({
  type: 'n8n-nodes-base.noOp',
  version: 1,
  config: { name: 'Kein Learning', parameters: {}, position: [2260, 1180] },
  output: [{}]
});

// ===================== COMPOSE =====================
const wf = workflow('pizzarello-bot', 'Pizzarello Bot');

wf.add(tgTrig).to(updateNorm).to(eingang);
wf.add(schedTrig).to(tagespostNorm).to(eingang);

wf.add(eingang).to(config).to(sessionLaden).to(router).to(routerSwitch
  .onCase(0, callbackBestaetigen.to(callbackGueltigIf
    .onTrue(callbackAktion
      .onCase(0, freigabeVorbereiten.to(kanaeleIf
        .onTrue(vertikalIf
          .onTrue(masterLaden.to(tiktokBg).to(tiktokFg).to(tiktokComposite).to(vertikalExtract).to(imgbbVertikal).to(bufferRequests))
          .onFalse(bufferRequests))
        .onFalse(keinKanalText.to(keinKanalMelden).to(sessionZuruecksetzen))))
      .onCase(1, regenAuftrag.to(auftrag))
      .onCase(2, verwurfDaten.to(verwurfLoggen).to(verwurfBestaetigen).to(sessionZuruecksetzen)))
    .onFalse(callbackVerfallen)))
  .onCase(1, busyAbwimmeln)
  .onCase(2, fotoUpload.to(fotoAuftrag).to(auftrag))
  .onCase(3, textAuftrag.to(auftrag))
  .onCase(4, tagespostAuftrag.to(auftrag))
  .onCase(5, ignorieren));

wf.add(textAuftrag).to(aenderungIf
  .onTrue(bewertungsAnfrage.to(learningBewerten).to(learningParsen).to(dauerhaftIf
    .onTrue(learningSpeichern)
    .onFalse(learningVerwerfen)))
  .onFalse(learningVerwerfen));

wf.add(bufferRequests).to(bufferPost).to(freigabeErgebnis).to(logSchreiben).to(freigabeBestaetigen).to(sessionZuruecksetzen);

wf.add(auftrag).to(busySetzen).to(tippenAnzeigen).to(websiteLaden).to(feiertageLaden).to(kontext).to(agent);

wf.add(agent).to(rueckfrageIf
  .onTrue(rueckfrageSenden.to(sessionWartet))
  .onFalse(postAufbereiten.to(bildModus).to(logoLaden).to(basisfotoIf
    .onTrue(basisfotoLaden.to(bildRequestEdit).to(gptBildFoto).to(bildExtrahieren))
    .onFalse(bildRequestGen.to(gptBildLogo).to(bildExtrahieren)))));

wf.add(bildExtrahieren).to(preisIf
  .onTrue(preisBadge.to(finalExtract))
  .onFalse(finalExtract));

wf.add(finalExtract).to(imgbbUpload).to(entwurfDaten).to(fotoSenden).to(entscheidungSenden).to(sessionDraftOpen);

export default wf;
