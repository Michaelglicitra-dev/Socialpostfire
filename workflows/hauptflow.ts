import { workflow, node, trigger, languageModel, memory, tool, outputParser, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

// ===================== TRIGGERS =====================
const schedTrig = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Taeglich 09:30', parameters: { rule: { interval: [{ field: 'days', triggerAtHour: 9, triggerAtMinute: 30 }] } }, position: [-400, 0] },
  output: [{}]
});

const tgTrig = trigger({
  type: 'n8n-nodes-base.telegramTrigger',
  version: 1.2,
  config: {
    name: 'Telegram Eingang',
    parameters: { updates: ['message'], additionalFields: { download: true, imageSize: 'large', chatIds: '7582948490' } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [-400, 300]
  },
  output: [{ message: { text: '2 Pizzen zum Preis von 1 heute Abend', photo: [] } }]
});

// ===================== TELEGRAM EINGANG =====================
const hatFotoIf = ifElse({
  version: 2.2,
  config: {
    name: 'Hat Foto?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ !!($json.message && $json.message.photo) }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [-160, 300]
  }
});

const eingangsfotoLesen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Eingangsfoto lesen',
    parameters: { jsCode: `const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
const b64 = buf.toString('base64');
const msg = $json.message || {};
const brief = String(msg.caption || msg.text || '').trim();
return [{ json: { image_b64: b64, brief: brief } }];` },
    position: [60, 200]
  },
  output: [{ image_b64: 'xxxx', brief: 'unser neues Tiramisu' }]
});

const imgbbEingang = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'imgbb Eingangsfoto',
    parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr('{{ $json.image_b64 }}') }] }, options: {} },
    credentials: { httpCustomAuth: newCredential('imgbb') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    position: [280, 200]
  },
  output: [{ data: { url: 'https://i.ibb.co/abc/eingang.png' } }]
});

const tgKontextFoto = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'TG-Kontext (Foto)',
    parameters: { jsCode: `return [{ json: { source: 'telegram', brief: $('Eingangsfoto lesen').first().json.brief, has_photo: true, photo_url: $json.data.url } }];` },
    position: [500, 200]
  },
  output: [{ source: 'telegram', brief: 'unser neues Tiramisu', has_photo: true, photo_url: 'https://i.ibb.co/abc/eingang.png' }]
});

const tgKontextText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'TG-Kontext (Text)',
    parameters: { jsCode: `const msg = $json.message || {};
return [{ json: { source: 'telegram', brief: String(msg.text || '').trim(), has_photo: false, photo_url: '' } }];` },
    position: [60, 420]
  },
  output: [{ source: 'telegram', brief: '2 Pizzen zum Preis von 1', has_photo: false, photo_url: '' }]
});

// ===================== SCHEDULE EINGANG =====================
const schedKontext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Schedule-Kontext',
    parameters: { jsCode: `return [{ json: { source: 'schedule', brief: '', has_photo: false, photo_url: '' } }];` },
    position: [-160, 0]
  },
  output: [{ source: 'schedule', brief: '', has_photo: false, photo_url: '' }]
});

// ===================== CONFIG + KONTEXT =====================
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
    brand_farben: { primaer: '#C8102E', sekundaer: '#2E7D32', akzent: '#F5E6C8' },
    bild_guideline: {
      markenkern: 'BRAND CORE (always apply): Pizzarello - a MODERN, premium, editorial food-brand look, like a high-end campaign, NOT a cosy trattoria and NOT a menu card. Reduced, confident, almost a lifestyle-product feel. BACKGROUND: a calm single-colour or very subtly textured surface - brushed warm-grey stainless steel/metal, deep black, or anthracite; a studio-like setup, never a rustic wooden table and never cosy warmth props. NEGATIVE SPACE: deliberately a lot of empty room (usually the upper third) as a clear zone for the headline; text and food stay clearly separated, never overlapping; the composition breathes, never crowded; optionally one thin fine terracotta 1px accent rule as a graphic divider between the text zone and the image zone. TYPOGRAPHY: a clean geometric/humanist sans-serif (in the spirit of Poppins / Circular / General Sans) - rounded, friendly yet high-end; NO serif, NO heavy block lettering; letters in white or cream on the dark/neutral ground; regular to medium weight, light and elegant, quietly confident rather than loud. COLOUR: a reduced palette - neutral grey/black or brushed metal as the base plus ONE warm accent (terracotta / rust red) used only as a thin line or a tiny detail; the pizza/food itself is the only real colour in the frame, everything else stays muted and calm; no tricolore red-green-white cliche. FOOD PHOTOGRAPHY: precise and close to the product, shot slightly from above (about 60-75 degrees) or straight top-down (90 degrees); visible craft - one or two hands holding or serving the pizza (never a face), high-quality ingredients clearly readable and deliberately styled (single mortadella rosettes, burrata drops, pistachio); light soft but contrasty enough to bring out texture (crust, cheese pull), never flat diffuse light and never hard flash. GRAPHIC ELEMENTS: use extras VERY sparingly - a small fine circular badge ONLY when a concrete date, period or location is actually part of the content, otherwise none; never invent a brand logo, wordmark or emblem (a real logo is added afterwards).',
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
      negativ: 'AVOID: rustic wooden-table look, trattoria kitsch, cosy candle or warmth props, serif typefaces, heavy block-lettering headlines, overloaded composition, several props at once (wine, napkin, herbs together), loud oversaturated red-green-white tricolore cliche, hard camera flash, orange colour cast, generic stock-photo look, recognisable faces of real people, distorted hands or fingers, logo distortions, any invented brand logo/wordmark/emblem, any badge, ribbon, sticker, seal or date/time stamp that was not explicitly part of the request, any price, number, percentage or currency symbol rendered into the image (prices are added afterwards as a real badge), and any text beyond a headline plus at most one short subline per image.',
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
  logo_onedrive_pfad: '/Pizzarello/assets/pizzarello_transparent.png',
  saeulen_rotation: { '1': 'angebote', '2': 'saisonal', '3': 'community', '4': 'angebote', '5': 'saisonal', '6': 'community', '7': 'angebote' },
  hashtags: {
    angebote: ['#pizzarello', '#tagesangebot', '#pizzaderwoche', '#oberhausen', '#pizzaliebe', '#handmadepizza'],
    saisonal: ['#pizzarello', '#saisonal', '#frischezutaten', '#regional', '#oberhausen', '#italienischekueche', '#handmadepizza'],
    community: ['#pizzarello', '#stammgaeste', '#behindthescenes', '#oberhausen', '#supportlocal', '#lapizzaevita']
  },
  posting_zeit: '17:00',
  telegram_chat_id: '7582948490',
  buffer: {
    organizationId: '69f7afabd110cb66bf840334',
    nur_demo: true,
    demo_channel_id: '6a805d6bb2d9d57743816131',
    demo_platform: 'instagram',
    channels: { facebook: '<FB_CHANNEL_ID>', instagram: '<IG_CHANNEL_ID>', pinterest: '<PIN_CHANNEL_ID>' },
    pinterest_board_service_id: '<PIN_BOARD_SERVICE_ID>',
    pinterest_url: 'https://www.pizzarello.net'
  }
};
return [{ json: Object.assign({}, inp, cfg) }];` },
    position: [740, 200]
  },
  output: [{ source: 'schedule', restaurant: { name: 'Pizzarello' }, telegram_chat_id: '7582948490' }]
});

const websiteLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Website laden',
    parameters: { method: 'GET', url: expr("{{ $('Restaurant-Konfiguration').first().json.restaurant.website }}"), options: { response: { response: { neverError: true } }, timeout: 15000 } },
    position: [900, 400]
  },
  output: [{ data: '<html>...</html>' }]
});

const feiertageLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Feiertage laden',
    parameters: { method: 'GET', url: expr("{{ 'https://feiertage-api.de/api/?nur_land=NW&jahr=' + $now.setZone('Europe/Berlin').year }}"), options: { response: { response: { neverError: true } }, timeout: 15000 } },
    position: [900, 560]
  },
  output: [{ Neujahrstag: { datum: '2026-01-01', hinweis: '' } }]
});

const kontext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kontext',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const heute = $now.setZone('Europe/Berlin');
const wtage = ['', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const saeule = cfg.source === 'telegram' ? 'angebote' : (cfg.saeulen_rotation[String(heute.weekday)] || 'angebote');
let website_text = '';
try {
  const w = $('Website laden').first();
  let html = '';
  if (w && w.json) { if (typeof w.json.data === 'string') html = w.json.data; else if (typeof w.json.body === 'string') html = w.json.body; }
  website_text = String(html).replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\\s+/g, ' ').trim();
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
  const heuteISO2 = heute.toISODate();
  const bis = heute.plus({ days: 21 }).toISODate();
  const kommende = [];
  for (const fn in fj) { const d = fj[fn] && fj[fn].datum; if (d && d >= heuteISO2 && d <= bis) kommende.push(fn + ' (' + d + ')'); }
  if (kommende.length) feiertage_text = kommende.join(', ');
} catch (e) { feiertage_text = ''; }
let agent_input;
if (cfg.source === 'telegram') {
  agent_input = 'Neue Eingabe vom Wirt: "' + (cfg.brief || '(nur ein Foto, kein Text)') + '". ' + (cfg.has_photo ? 'Es wurde ein eigenes Foto mitgeschickt, das als Bildgrundlage dient - kein Archiv-Foto waehlen. ' : 'Es wurde KEIN eigenes Foto geschickt - waehle mit get_bildarchiv ein passendes Archiv-Foto als Bildgrundlage. ') + 'Erstelle daraus EINEN fertigen Social-Media-Post.';
} else {
  agent_input = 'Taeglicher Auto-Post fuer die Saeule "' + saeule + '" am ' + wtage[heute.weekday] + '. Es wurde KEIN eigenes Foto geschickt - waehle mit get_bildarchiv ein passendes Archiv-Foto als Bildgrundlage. Nutze get_speisekarte und die Website-Infos fuer korrekte Fakten. Erstelle EINEN fertigen Social-Media-Post.';
}
agent_input += ' | SAISON: ' + saison + '.';
if (feiertage_text) agent_input += ' NAECHSTE FEIERTAGE (NRW): ' + feiertage_text + '. Beziehe passende Feiertage oder die Saison dezent ein, wenn es zum Thema passt.';
if (website_text) agent_input += ' | AKTUELLE WEBSITE-INFOS: ' + website_text;
const session_key = cfg.source === 'telegram' ? String(cfg.telegram_chat_id) : (String(cfg.telegram_chat_id) + '_' + heute.toISODate());
return [{ json: { source: cfg.source, brief: cfg.brief || '', has_photo: !!cfg.has_photo, photo_url: cfg.photo_url || '', datum: heute.toISODate(), wochentag: wtage[heute.weekday], saeule: saeule, agent_input: agent_input, chat_id: cfg.telegram_chat_id, session_key: session_key } }];` },
    position: [960, 200]
  },
  output: [{ source: 'schedule', saeule: 'angebote', datum: '2026-08-14', agent_input: 'Taeglicher Auto-Post ...', chat_id: '7582948490', has_photo: false, photo_url: '' }]
});

// ===================== AGENT + SUBNODES =====================
const gptModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: {
    name: 'OpenAI gpt-5-mini',
    parameters: { model: { __rl: true, mode: 'list', value: 'gpt-5-mini', cachedResultName: 'gpt-5-mini' } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    position: [1120, 460]
  }
});

const dialogMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.3,
  config: {
    name: 'Gespraechs-Memory',
    parameters: { sessionIdType: 'customKey', sessionKey: expr('{{ $json.session_key }}'), contextWindowLength: 12 },
    position: [1260, 460]
  }
});

const toolLearnings = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_learnings',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die gespeicherten Lern-Regeln aus abgelehnten Posts. IMMER zuerst aufrufen und jede aktive Regel strikt befolgen.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'DfXfRBdmdGA5AwFs', cachedResultName: 'pizzarello_learnings' }, returnAll: true },
    position: [1400, 460]
  }
});

const toolAngebote = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_aktuelle_angebote',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die hinterlegten Angebote (typ, titel, beschreibung, preis, gueltig_von, gueltig_bis, aktiv). Nur aktive und aktuell gueltige Angebote verwenden, keine Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'dVJNivQbpA7YUwAm', cachedResultName: 'pizzarello_angebote' }, returnAll: true },
    position: [1540, 460]
  }
});

const toolSpeisekarte = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_speisekarte',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert die komplette Speisekarte des Restaurants (kategorie, name, beschreibung, preis, aktiv). Nutze sie fuer korrekte Gericht-Namen, Zutaten und Preise. Keine Gerichte oder Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '8LOssi3MEAxKEXMd', cachedResultName: 'pizzarello_speisekarte' }, returnAll: true },
    position: [1660, 620]
  }
});

const toolBildarchiv = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: {
    name: 'get_bildarchiv',
    parameters: { descriptionType: 'manual', toolDescription: 'Liefert das Foto-Archiv des Restaurants (url, kategorie, beschreibung, aktiv). Wenn KEIN eigenes Foto mitgeschickt wurde, waehle hier das thematisch am besten passende aktive Foto und gib dessen url im Feld archiv_foto_url zurueck.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'x7QjV9d9CI0ZgrBz', cachedResultName: 'pizzarello_fotos' }, returnAll: true },
    position: [1800, 620]
  }
});

const postParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: {
    name: 'Post-Schema',
    parameters: { schemaType: 'fromJson', jsonSchemaExample: '{ "needs_clarification": false, "clarification_question": "", "headline": "Frisch aus dem Ofen", "post_text": "Heute Abend duftet es bei uns nach Ofenpizza - komm vorbei und lass es dir schmecken!", "hashtags": ["#pizzarello", "#oberhausen"], "layout": "klassik", "bild_typ": "produkt", "bild_neu": false, "bild_headline": "FRISCH AUS DEM OFEN", "image_brief": "A single pizza on a brushed-metal surface, held by one hand, shot slightly from above", "preis_text": "", "archiv_foto_url": "" }' },
    position: [1680, 460]
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
        systemMessage: `Du bist der Social-Media-Creator fuer die Pizzeria Pizzarello in Oberhausen. Du erstellst EINEN fertigen Instagram/Facebook/Pinterest-Post pro Anfrage.

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
- Frage NUR, wenn es wirklich noetig ist. Bei kleinen Unklarheiten triff selbst eine sinnvolle, markengerechte Annahme statt zu fragen.
- Bei taeglichen Auto-Posts (kein direkter Wirt-Input) stellst du NIEMALS eine Rueckfrage - entscheide eigenstaendig und setze needs_clarification=false.
- Sobald alles klar ist (auch nach Erhalt einer Antwort auf deine Rueckfrage), setze needs_clarification=false und liefere den fertigen Post.

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
- bild_neu: true NUR wenn ein KOMPLETT ANDERES/neues Bild gewuenscht ist (z.B. der Wirt bittet ausdruecklich um ein anderes Foto oder Motiv). false, wenn das bisherige Bild beibehalten und nur angepasst werden soll. Bei einem ERSTEN Entwurf immer false.
- bild_headline: sehr kurzer Bild-Text (max 40 Zeichen), ASCII ohne Umlaute (ae/oe/ue/ss). Bei layout "pur" leer lassen.
- image_brief: EIN englischer Satz, der das appetitliche Foto-Motiv beschreibt (Gericht/Szene), im MODERNEN Studio-Look (cleaner neutraler Hintergrund, viel Negativraum), nicht rustikal.
- preis_text: NUR bei einem Angebot mit konkretem Preis den exakten Preis im deutschen Format wie "5,99 EUR" oder "5,99 Euro" (NIEMALS einen Preis erfinden - nur der vom Wirt genannte oder der Preis aus get_aktuelle_angebote/get_speisekarte). Sonst LEER. Dieser Preis wird spaeter als echter Badge aufs Bild gestempelt; im image_brief/bild_headline selbst KEINE Zahl/Preis nennen.
- archiv_foto_url: url eines passenden Archiv-Fotos aus get_bildarchiv, sonst leer.`
      }
    },
    subnodes: { model: gptModel, memory: dialogMemory, tools: [toolLearnings, toolAngebote, toolSpeisekarte, toolBildarchiv], outputParser: postParser },
    position: [1400, 200]
  },
  output: [{ output: { headline: 'Frisch aus dem Ofen', post_text: 'Heute Abend duftet es bei uns nach Ofenpizza.', hashtags: ['#pizzarello', '#oberhausen'], layout: 'klassik', bild_headline: 'FRISCH AUS DEM OFEN', image_brief: 'A rustic wood-fired margherita pizza on a bright marble table', archiv_foto_url: '' } }]
});

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
// Preis-Badge normalisieren: EUR/Euro -> €, ohne Ziffer verwerfen, € ergaenzen
let preis = post.preis_text.replace(/euro/ig, '€').replace(/EUR/g, '€').replace(/\\s+/g, ' ').trim();
if (!/[0-9]/.test(preis)) preis = '';
if (preis && preis.indexOf('€') === -1) preis = preis + ' €';
post.preis_text = preis.slice(0, 16);
if (post.archiv_foto_url.indexOf('http') !== 0) post.archiv_foto_url = '';
if (!post.headline || !post.post_text) throw new Error('Agent-Ausgabe unvollstaendig: ' + JSON.stringify(o).slice(0, 300));
const erlaubte = ['klassik', 'menue_karte', 'angebots_sticker', 'event_poster', 'pur', 'zitat'];
if (erlaubte.indexOf(post.layout) === -1) post.layout = 'klassik';
const bildTypen = ['produkt', 'event', 'angebot', 'saison', 'flyer', 'bts'];
if (bildTypen.indexOf(post.bild_typ) === -1) post.bild_typ = '';
if (post.layout === 'pur') post.bild_headline = '';
else if (!post.bild_headline) post.bild_headline = post.headline.split(' ').slice(0, 5).join(' ');
const norm = post.hashtags.map(function(t){ t = String(t).trim().replace(/ /g, ''); if (!t) return ''; return t.charAt(0) === '#' ? t : '#' + t; }).filter(function(t){ return t.length > 1; });
const setTags = cfg.hashtags[k.saeule] || [];
post.hashtags = setTags.concat(norm.filter(function(t){ return setTags.indexOf(t) === -1; })).slice(0, 12);
if (!post.image_brief) post.image_brief = 'Appetizing signature dish from ' + cfg.restaurant.name;
return [{ json: { post: post } }];` },
    position: [1620, 200]
  },
  output: [{ post: { headline: 'Frisch aus dem Ofen', post_text: '...', hashtags: ['#pizzarello'], layout: 'klassik', bild_headline: 'FRISCH AUS DEM OFEN', image_brief: 'A rustic wood-fired margherita pizza' } }]
});

// ===================== BILD =====================
const bildModus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild-Modus',
    parameters: { jsCode: `const k = $('Kontext').first().json;
const post = $('Post aufbereiten').first().json.post || {};
const bildTyp = String(post.bild_typ || '');
const bildNeu = !!post.bild_neu;
let prev_base_b64 = '';
try { const b = $('Bild extrahieren').first().json.image_b64; if (b) prev_base_b64 = b; } catch (e) {}
let archiv = '';
try { archiv = String(post.archiv_foto_url || ''); } catch (e) {}
const base_url = k.has_photo ? (k.photo_url || '') : archiv;
let mode;
if (bildTyp === 'flyer') mode = 'generate';
else if (!bildNeu && prev_base_b64) mode = 'edit_prev';
else if (base_url) mode = 'edit_url';
else mode = 'generate';
return [{ json: { mode: mode, prev_base_b64: prev_base_b64, base_url: base_url } }];` },
    position: [1840, 200]
  },
  output: [{ mode: 'generate', prev_base_b64: '', photo_url: '' }]
});

const bildGenerierenIf = ifElse({
  version: 2.2,
  config: {
    name: 'Bild: generieren?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.mode }}'), rightValue: 'generate', operator: { type: 'string', operation: 'equals' } }] } },
    position: [2020, 200]
  }
});

const fotoBasisIf = ifElse({
  version: 2.2,
  config: {
    name: 'Bild: Vorbild editieren?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.mode }}'), rightValue: 'edit_prev', operator: { type: 'string', operation: 'equals' } }] } },
    position: [2020, 380]
  }
});

const eingangsfotoLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Basisfoto laden',
    parameters: { url: expr('{{ $(\'Bild-Modus\').first().json.base_url }}'), options: { response: { response: { responseFormat: 'file' } } } },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [2060, 100]
  },
  output: [{}]
});

const kombiReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kombi-Request',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
let b64 = null, mime = 'image/jpeg';
const bin = $input.first().binary && $input.first().binary.data;
if (bin && bin.mimeType) mime = bin.mimeType;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); b64 = buf.toString('base64'); } catch (e) { if (bin && bin.data) b64 = bin.data; }
if (!b64) throw new Error('Eingangsfoto konnte nicht gelesen werden');
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
let prompt = 'Create a finished square 1:1 social media post image for an Italian restaurant from the provided photo. Keep the dish, composition and setting exactly as they are, do not replace or invent food items or people. ';
prompt += (g.grading || 'Enhance gently: natural realistic well-balanced lighting, do NOT overexpose, only gently lift the shadows, a little warmth and freshness, photorealistic.') + ' ';
prompt += 'IMPORTANT: Do NOT draw, paint or invent ANY logo, wordmark, brand name, emblem, badge, ribbon, sticker, seal or date/time stamp anywhere. Keep the TOP-RIGHT corner completely empty and clean (slightly darker) - a real logo is composited there afterwards. ';
prompt += 'Do NOT render any price, number, percentage or currency symbol anywhere - prices are added afterwards as a real badge. ';
if (String(post.preis_text || '') !== '') { prompt += 'Keep the LOWER-RIGHT area calm and clean for a round price badge added afterwards. '; }
prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
if (post.layout === 'pur' || !headline) { prompt += 'Render NO headline and no other text anywhere in the image. '; }
else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY, letter for letter, as: "' + headline + '". Perfect spelling is critical. Keep the headline clear of the top-right corner. Use a modern geometric sans-serif (Poppins, Medium or Regular weight), in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. No other text anywhere. '; }
prompt += (g.text_safety || '') + ' ' + (g.negativ || '') + ' No watermark, no border, tack-sharp, high-resolution, clean, no film grain or noise.';
const mimePng = mime.indexOf('png') !== -1 ? 'image/png' : 'image/jpeg';
const ext = mimePng === 'image/png' ? 'png' : 'jpg';
const binary = {};
binary.image0 = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'image0.' + ext, mimePng);
return [{ json: { prompt: prompt, layout: post.layout }, binary: binary }];` },
    position: [2280, 100]
  },
  output: [{ prompt: 'Create a finished square...', layout: 'klassik' }]
});

const kombiReqPrev = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kombi-Request (Vorher)',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const prevB64 = $('Bild-Modus').first().json.prev_base_b64;
if (!prevB64) throw new Error('Kein vorheriges Bild fuer die Anpassung gefunden');
let comment = '';
try { comment = String($('Grund auswerten').first().json.reason || ''); } catch (e) {}
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const headline = String(post.bild_headline || '').slice(0, 40);
let prompt = 'This is the CURRENT post image. Keep the composition, the dish, the background, the people, the colors, the lighting and the overall style essentially the SAME as in the provided image. Do NOT reinvent or replace the scene. ';
prompt += 'Apply ONLY the following requested change and nothing else: "' + (comment || 'small refinement') + '". ';
if (post.layout === 'pur' || !headline) { prompt += 'Keep the image completely free of headline text. '; }
else { prompt += (g.typo || '') + ' Set the in-image headline text to EXACTLY: "' + headline + '" - replace any previous headline, perfect spelling, in a modern geometric sans-serif (Poppins, Medium or Regular weight), clean cream-white ' + (f.akzent || '#F5E6C8') + ', within a generous safe margin never touching any edge, no serif and no default/system font. '; }
prompt += 'Keep the TOP-RIGHT corner completely empty for a logo added afterwards, and do NOT render any price, number or currency symbol (a real price badge is added afterwards); keep the lower-right area calm. ' + (g.text_safety || '') + ' ' + (g.negativ || '') + ' No watermark, no border, tack-sharp, clean, no film grain or noise.';
const binary = {};
binary.image0 = await this.helpers.prepareBinaryData(Buffer.from(prevB64, 'base64'), 'image0.png', 'image/png');
return [{ json: { prompt: prompt, layout: post.layout }, binary: binary }];` },
    position: [2280, 380]
  },
  output: [{ prompt: 'Keep the current image, only change the requested part', layout: 'klassik' }]
});

const gptEdits = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GPT Bild (edits)',
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/edits', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [{ name: 'model', value: 'gpt-image-1' }, { name: 'prompt', value: expr('{{ $json.prompt }}') }, { name: 'size', value: '1024x1024' }, { name: 'quality', value: 'high' }, { name: 'input_fidelity', value: 'high' }, { name: 'output_format', value: 'png' }, { parameterType: 'formBinaryData', name: 'image[]', inputDataFieldName: 'image0' }] }, options: { timeout: 180000 } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [2500, 100]
  },
  output: [{ data: [{ b64_json: 'xxxx' }] }]
});

const genReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gen-Request',
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
let prompt = 'Square 1:1 image. ' + post.image_brief + ' ' + (g.markenkern || '') + ' ' + modul + ' ';
prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
prompt += 'Do NOT draw, paint or invent ANY logo, wordmark, brand name, emblem, badge, ribbon, sticker, seal or date/time stamp anywhere in the image (a real logo is composited afterwards). Keep the TOP-RIGHT corner completely empty and clean, slightly darker. ';
prompt += 'Do NOT render any price, number, percentage or currency symbol anywhere in the image - prices are added afterwards as a real badge. ';
if (String(post.preis_text || '') !== '') { prompt += 'Keep the LOWER-RIGHT area calm and clean (no important detail there) for a round price badge added afterwards. '; }
if (post.layout === 'pur' || !headline) { prompt += 'Render NO headline and no text anywhere in the image. '; }
else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY, letter for letter, as: "' + headline + '". Perfect spelling is critical, no other words. Use ' + fontHint + ', in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. '; }
prompt += (g.text_safety || '') + ' ' + (g.negativ || '');
return [{ json: { openai_gen_body: { model: 'gpt-image-1', prompt: prompt, size: '1024x1024', quality: 'high', output_format: 'png', n: 1 } } }];` },
    position: [2280, 320]
  },
  output: [{ openai_gen_body: { model: 'gpt-image-1', prompt: '...', size: '1024x1024' } }]
});

const gptGen = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'GPT Bild (gen)',
    parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/generations', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.openai_gen_body) }}'), options: { timeout: 180000 } },
    credentials: { openAiApi: newCredential('OpenAI Pizzarello') },
    retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
    position: [2500, 320]
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
return [{ json: { image_b64: b64, layout: $('Post aufbereiten').first().json.post.layout } }];` },
    position: [2720, 200]
  },
  output: [{ image_b64: 'xxxx', layout: 'klassik' }]
});

// ===================== LOGO OVERLAY =====================
const logoSuchen = node({
  type: 'n8n-nodes-base.microsoftOneDrive',
  version: 1.1,
  config: {
    name: 'Logo suchen',
    parameters: { operation: 'search', query: expr('{{ $(\'Restaurant-Konfiguration\').first().json.logo_onedrive_pfad.split(\'/\').pop() }}') },
    credentials: { microsoftOneDriveOAuth2Api: newCredential('OneDrive Pizzarello') },
    position: [2940, 200]
  },
  output: [{ id: 'file123', name: 'pizzarello_transparent.png' }]
});

const logoId = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Logo-ID waehlen',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const pfad = String(cfg.logo_onedrive_pfad || '');
const dateiname = pfad.split('/').pop().toLowerCase();
const ordner = pfad.slice(0, pfad.lastIndexOf('/')).toLowerCase();
const items = $input.all().map(function(i){ return i.json; }).filter(function(f){ return f && f.id && f.name && String(f.name).toLowerCase() === dateiname; });
if (items.length === 0) throw new Error('Logo nicht gefunden in OneDrive fuer "' + dateiname + '".');
let best = items[0];
for (const f of items) { const p = ((f.parentReference && f.parentReference.path) || '').toLowerCase(); if (ordner && p.indexOf(ordner) !== -1) { best = f; break; } }
return [{ json: { logo_file_id: best.id, logo_name: best.name } }];` },
    position: [3160, 200]
  },
  output: [{ logo_file_id: 'file123', logo_name: 'pizzarello_transparent.png' }]
});

const logoDownload = node({
  type: 'n8n-nodes-base.microsoftOneDrive',
  version: 1.1,
  config: {
    name: 'Logo herunterladen',
    parameters: { operation: 'download', fileId: expr('{{ $json.logo_file_id }}') },
    credentials: { microsoftOneDriveOAuth2Api: newCredential('OneDrive Pizzarello') },
    position: [3380, 200]
  },
  output: [{}]
});

const logoConvert = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Logo konvertieren',
    parameters: { jsCode: `let logo_b64 = null, logo_mime = 'image/png';
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); logo_b64 = buf.toString('base64'); } catch (e) { const bin = $input.first().binary && $input.first().binary.data; if (bin && bin.data) logo_b64 = bin.data; }
const bin2 = $input.first().binary && $input.first().binary.data;
if (bin2 && bin2.mimeType) logo_mime = bin2.mimeType;
return [{ json: { logo_b64: logo_b64, logo_mime: logo_mime, logo_fehlt: !logo_b64 } }];` },
    position: [3600, 200]
  },
  output: [{ logo_b64: 'xxxx', logo_mime: 'image/png', logo_fehlt: false }]
});

const bundle = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild und Logo buendeln',
    parameters: { jsCode: `const b64 = $('Bild extrahieren').first().json.image_b64;
const logo_b64 = $('Logo konvertieren').first().json.logo_b64;
if (!b64) throw new Error('Kein Basisbild fuer das Logo-Overlay');
if (!logo_b64) throw new Error('Kein Logo fuer das Overlay');
const binary = {};
binary.data = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'post.png', 'image/png');
binary.logo = await this.helpers.prepareBinaryData(Buffer.from(logo_b64, 'base64'), 'logo.png', 'image/png');
return [{ json: { layout: $('Bild extrahieren').first().json.layout || '' }, binary: binary }];` },
    position: [3820, 200]
  },
  output: [{ layout: 'klassik' }]
});

const logoResize = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Logo skalieren',
    parameters: { operation: 'resize', dataPropertyName: 'logo', width: 155, height: 155, options: { destinationKey: 'logo', format: 'png', quality: 100 } },
    position: [4040, 200]
  },
  output: [{}]
});

const logoComposite = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Logo einfuegen',
    parameters: { operation: 'composite', dataPropertyNameComposite: 'logo', positionX: 850, positionY: 30, options: { destinationKey: 'data', format: 'png', quality: 100 } },
    position: [4260, 200]
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
if (!b64) throw new Error('Finales Bild nach dem Logo-Overlay konnte nicht gelesen werden');
return [{ json: { image_b64: b64 } }];` },
    position: [4480, 200]
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
    position: [4700, 200]
  },
  output: [{ data: { url: 'https://i.ibb.co/abc/post.png' } }]
});

const tgDaten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Telegram-Daten bauen',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const p = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const NL = String.fromCharCode(10);
const url = $json.data && $json.data.url;
if (!url) throw new Error('imgbb lieferte keine URL: ' + JSON.stringify($json).slice(0, 300));
const esc = function(s){ return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const emoji = { angebote: String.fromCodePoint(0x1F355), saisonal: String.fromCodePoint(0x1F33F), community: String.fromCodePoint(0x2764) };
const hinweis = k.source === 'telegram' ? 'Sofort-Entwurf zu deiner Eingabe' : ('Geplant: heute ' + cfg.posting_zeit + ' Uhr');
const caption = '<b>' + (emoji[k.saeule] || '') + ' ' + esc(p.headline) + '</b>' + NL + NL + esc(p.post_text) + NL + NL + esc(p.hashtags.join(' ')) + NL + NL + hinweis + ' | Saeule: ' + k.saeule + ' | Layout: ' + esc(p.layout);
const approval = 'Freigabe fuer den Post oben?' + NL + 'Freigabefenster: 2 Stunden, danach wird der Post automatisch verworfen.';
return [{ json: { post: p, saeule: k.saeule, datum: k.datum, image_url_public: url, tg_caption: caption.slice(0, 1024), tg_approval_text: approval } }];` },
    position: [4920, 200]
  },
  output: [{ post: { headline: 'x' }, saeule: 'angebote', datum: '2026-08-14', image_url_public: 'https://i.ibb.co/abc/post.png', tg_caption: 'x', tg_approval_text: 'x' }]
});

// ===================== FREIGABE-BENACHRICHTIGUNG (Push + Telegram-Link) -> Web-App-Freigabe =====================
// Draft parken (mit Resume-URL), Android-Push + Telegram-Link senden, dann auf Web-App-Entscheidung warten.
const pendReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Freigabe parken - Daten',
    parameters: { jsCode: `const d = $('Telegram-Daten bauen').first().json;
const k = $('Kontext').first().json;
const post_id = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
const webapp = 'https://n8n.srv964622.hstgr.cloud/webhook/pizzarello-app';
const NL = String.fromCharCode(10);
const caption = String(d.tg_caption || '') + NL + NL + 'Neuer Auto-Post wartet auf deine Freigabe.' + NL + 'Jetzt in der App freigeben: ' + webapp;
return [{ json: {
  post_id: post_id,
  image_url: d.image_url_public,
  headline: d.post.headline,
  post_text: d.post.post_text,
  hashtags: d.post.hashtags.join(' '),
  saeule: k.saeule,
  datum: k.datum,
  notify_caption: caption.slice(0, 1024)
} }];` },
    position: [5140, 200]
  },
  output: [{ post_id: '123-abc', image_url: 'https://i.ibb.co/abc/post.png' }]
});

const pendPark = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Entwurf parken',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'W42oYny5sSWn2BAN', cachedResultName: 'pizzarello_pending' }, columns: { mappingMode: 'defineBelow', value: { post_id: expr('{{ $json.post_id }}'), image_url: expr('{{ $json.image_url }}'), headline: expr('{{ $json.headline }}'), post_text: expr('{{ $json.post_text }}'), hashtags: expr('{{ $json.hashtags }}'), saeule: expr('{{ $json.saeule }}'), datum: expr('{{ $json.datum }}'), resume_url: expr('{{ $execution.resumeUrl }}'), status: 'OFFEN', created: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: [{ id: 'post_id', displayName: 'post_id', type: 'string', required: false, display: true, removed: false }, { id: 'image_url', displayName: 'image_url', type: 'string', required: false, display: true, removed: false }, { id: 'headline', displayName: 'headline', type: 'string', required: false, display: true, removed: false }, { id: 'post_text', displayName: 'post_text', type: 'string', required: false, display: true, removed: false }, { id: 'hashtags', displayName: 'hashtags', type: 'string', required: false, display: true, removed: false }, { id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false }, { id: 'datum', displayName: 'datum', type: 'string', required: false, display: true, removed: false }, { id: 'resume_url', displayName: 'resume_url', type: 'string', required: false, display: true, removed: false }, { id: 'status', displayName: 'status', type: 'string', required: false, display: true, removed: false }, { id: 'created', displayName: 'created', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    position: [5360, 200]
  },
  output: [{ post_id: '123-abc' }]
});

const pushSubsGet = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Push-Abos laden',
    parameters: { operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'o7HPXEM4bQI8M0mR', cachedResultName: 'pizzarello_push_subs' }, returnAll: true },
    alwaysOutputData: true,
    position: [5580, 200]
  },
  output: [{ endpoint: 'https://...' }]
});

const pushSend = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Web-Push senden',
    parameters: { jsCode: `const VAPID_PUBLIC = 'BOenp5zu51cjm0M99sZkfT6Vnb4ap1rnwjHLPjK7_LTrewCwy_J-HQK3fPjtRFCGXkdc57LsGmM39aIhGAhWGpg';
const JWK = { kty: 'EC', crv: 'P-256', x: '56ennO7nVyObQz32xmR9PpWdvhqnWufCMcs-Mrv8tOs', y: 'ewCwy_J-HQK3fPjtRFCGXkdc57LsGmM39aIhGAhWGpg', d: 'VNz84oJ6lvMQnxx37sFOeX-stG6ree8O-DXoN4ik70c', ext: true };
const subs = $input.all().map(function(i){ return i.json || {}; }).filter(function(s){ return s && s.endpoint; });
let sent = 0, failed = 0, err = '';
try {
  const key = await crypto.subtle.importKey('jwk', JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = function(obj){ return Buffer.from(JSON.stringify(obj)).toString('base64url'); };
  for (const s of subs) {
    try {
      const aud = new URL(s.endpoint).origin;
      const header = { typ: 'JWT', alg: 'ES256' };
      const payload = { aud: aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: 'mailto:info@pizzarello.net' };
      const signingInput = enc(header) + '.' + enc(payload);
      const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(signingInput));
      const jwt = signingInput + '.' + Buffer.from(new Uint8Array(sig)).toString('base64url');
      await this.helpers.httpRequest({ method: 'POST', url: s.endpoint, headers: { Authorization: 'vapid t=' + jwt + ', k=' + VAPID_PUBLIC, TTL: '86400' }, body: '' });
      sent++;
    } catch (e) { failed++; err = String((e && e.message) || e); }
  }
} catch (e) { err = 'crypto: ' + String((e && e.message) || e); }
return [{ json: { push_sent: sent, push_failed: failed, push_err: err } }];` },
    alwaysOutputData: true,
    position: [5800, 200]
  },
  output: [{ push_sent: 0, push_failed: 0 }]
});

const tgNotify = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Telegram-Hinweis senden',
    parameters: { operation: 'sendMessage', chatId: expr('{{ $(\'Restaurant-Konfiguration\').first().json.telegram_chat_id }}'), text: 'Neuer taeglicher Post wartet auf deine Freigabe. Tippe unten, um ihn in der App anzusehen und freizugeben.', replyMarkup: 'inlineKeyboard', inlineKeyboard: { rows: [{ row: { buttons: [{ text: 'In der App freigeben', additionalFields: { url: 'https://n8n.srv964622.hstgr.cloud/webhook/pizzarello-app' } }] } }] }, additionalFields: { appendAttribution: false, disable_web_page_preview: true } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [6020, 200]
  },
  output: [{ result: { message_id: 1 } }]
});

const waitFreigabe = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Auf Web-Freigabe warten',
    parameters: { resume: 'webhook', httpMethod: 'POST', incomingAuthentication: 'none', limitWaitTime: true, limitType: 'afterTimeInterval', resumeAmount: 47, resumeUnit: 'hours', options: {} },
    position: [6240, 200]
  },
  output: [{ body: { decision: 'approve', reason: '', post_id: '123-abc' } }]
});

const entscheidung = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Freigabe-Entscheidung',
    parameters: { jsCode: `const b = ($json && $json.body && typeof $json.body === 'object') ? $json.body : ($json || {});
const p = $('Freigabe parken - Daten').first().json;
let decision = String(b.decision || '').toLowerCase();
const reason = String(b.reason || '');
if (['approve', 'reject', 'discard'].indexOf(decision) === -1) decision = 'discard';
const neuer_status = decision === 'approve' ? 'FREIGEGEBEN' : (decision === 'reject' ? 'NEU' : 'VERWORFEN');
return [{ json: { decision: decision, reason: reason, post_id: p.post_id, neuer_status: neuer_status } }];` },
    position: [6460, 200]
  },
  output: [{ decision: 'approve', reason: '', post_id: '123-abc', neuer_status: 'FREIGEGEBEN' }]
});

const pendUpdate = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Pending aktualisieren',
    parameters: { operation: 'update', dataTableId: { __rl: true, mode: 'id', value: 'W42oYny5sSWn2BAN', cachedResultName: 'pizzarello_pending' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'post_id', condition: 'eq', keyValue: expr("{{ $('Freigabe-Entscheidung').first().json.post_id }}") }] }, columns: { mappingMode: 'defineBelow', value: { status: expr("{{ $('Freigabe-Entscheidung').first().json.neuer_status }}") }, matchingColumns: [], schema: [{ id: 'status', displayName: 'status', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    alwaysOutputData: true,
    position: [6680, 200]
  },
  output: [{ status: 'FREIGEGEBEN' }]
});

const entscheidungApproveIf = ifElse({
  version: 2.2,
  config: {
    name: 'Freigegeben?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Freigabe-Entscheidung').first().json.decision }}"), rightValue: 'approve', operator: { type: 'string', operation: 'equals' } }] } },
    position: [6900, 200]
  }
});

const entscheidungDiscardIf = ifElse({
  version: 2.2,
  config: {
    name: 'Verworfen?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Freigabe-Entscheidung').first().json.decision }}"), rightValue: 'discard', operator: { type: 'string', operation: 'equals' } }] } },
    position: [6900, 380]
  }
});

// ===================== FREIGEGEBEN -> BUFFER + LOG =====================
const bufferReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Buffer-Request bauen',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const d = $('Telegram-Daten bauen').first().json;
const q = 'mutation($input: CreatePostInput!){ createPost(input:$input){ __typename ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }';
const parts = (cfg.posting_zeit || '17:00').split(':');
let due = $now.setZone('Europe/Berlin').set({ hour: Number(parts[0]), minute: Number(parts[1] || 0), second: 0, millisecond: 0 });
if (due.diffNow('minutes').minutes < 15) due = due.plus({ days: 1 });
const dueAt = due.toUTC().toISO({ suppressMilliseconds: true });
const NL2 = String.fromCharCode(10) + String.fromCharCode(10);
const tagsFull = d.post.hashtags.join(' ');
const tagsMax5 = d.post.hashtags.slice(0, 5).join(' ');
function cap500(t) { if (t.length <= 500) return t; const s = t.slice(0, 499); const sp = s.lastIndexOf(' '); return sp > 300 ? s.slice(0, sp) : s; }
const meta = { facebook: { facebook: { type: 'post' } }, instagram: { instagram: { type: 'post', shouldShareToFeed: true } }, pinterest: { pinterest: { title: String(d.post.headline).slice(0, 100), url: cfg.buffer.pinterest_url, boardServiceId: cfg.buffer.pinterest_board_service_id } } };
const out = [];
if (cfg.buffer.nur_demo && cfg.buffer.demo_channel_id && String(cfg.buffer.demo_channel_id).indexOf('<') === -1) {
  const demoPf = String(cfg.buffer.demo_platform || 'instagram');
  const demoText = demoPf === 'instagram' ? (d.post.post_text + NL2 + tagsMax5) : (demoPf === 'pinterest' ? cap500(d.post.post_text + NL2 + tagsFull) : (d.post.post_text + NL2 + tagsFull));
  const demoInput = { text: demoText, channelId: cfg.buffer.demo_channel_id, schedulingType: 'automatic', mode: 'customScheduled', dueAt: dueAt, assets: [{ image: { url: d.image_url_public } }] };
  if (meta[demoPf]) demoInput.metadata = meta[demoPf];
  out.push({ json: { platform: 'pizzarello.demo (' + demoPf + ')', graphql: { query: q, variables: { input: demoInput } } } });
  return out;
}
const texts = { facebook: d.post.post_text + NL2 + tagsFull, instagram: d.post.post_text + NL2 + tagsMax5, pinterest: cap500(d.post.post_text + NL2 + tagsFull) };
for (const pf of ['facebook', 'instagram', 'pinterest']) {
  const chId = cfg.buffer.channels[pf];
  if (!chId || chId.indexOf('<') !== -1) continue;
  out.push({ json: { platform: pf, graphql: { query: q, variables: { input: { text: texts[pf], channelId: chId, schedulingType: 'automatic', mode: 'customScheduled', dueAt: dueAt, assets: [{ image: { url: d.image_url_public } }], metadata: meta[pf] } } } } });
}
if (out.length === 0) return [{ json: { platform: 'keine (Channel-IDs nicht konfiguriert)', graphql: { query: '{ __typename }' } } }];
return out;` },
    position: [5800, 80]
  },
  output: [{ platform: 'facebook', graphql: { query: 'mutation...' } }]
});

const bufferPost = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Buffer Post planen',
    parameters: { method: 'POST', url: 'https://api.buffer.com', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.graphql) }}'), options: { response: { response: { neverError: true } } } },
    credentials: { httpHeaderAuth: newCredential('Buffer') },
    position: [6020, 80]
  },
  output: [{ data: { createPost: { post: { id: 'p1', dueAt: '2026-08-14T15:00:00Z' } } } }]
});

const logZeile = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Log-Zeile geplant',
    parameters: { jsCode: `const d = $('Telegram-Daten bauen').first().json;
const NL = String.fromCharCode(10);
const OK = String.fromCodePoint(0x2705);
const FAIL = String.fromCodePoint(0x274C);
const esc = function(s){ return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const plattformen = $('Buffer-Request bauen').all().map(function(i){ return String(i.json.platform || 'unbekannt'); });
const items = $input.all();
const ids = [], zeilen = [];
let okCount = 0;
items.forEach(function(i, idx) {
  const pf = plattformen[idx] || 'unbekannt';
  if (pf.indexOf('keine') === 0) { ids.push('keine Channels konfiguriert'); zeilen.push(FAIL + ' Keine Buffer-Channel-IDs hinterlegt'); return; }
  const cp = i.json && i.json.data && i.json.data.createPost;
  if (cp && cp.post) { okCount++; ids.push(pf + ':' + cp.post.id); let zeit = ''; try { zeit = DateTime.fromISO(String(cp.post.dueAt)).setZone('Europe/Berlin').toFormat('dd.MM. HH:mm'); } catch (e) { zeit = ''; } zeilen.push(OK + ' ' + pf + (zeit ? ' - geplant fuer ' + zeit + ' Uhr' : ' - eingeplant')); }
  else { let msg = 'unbekannter Fehler'; if (cp && cp.message) msg = String(cp.message); else if (i.json && i.json.errors) msg = JSON.stringify(i.json.errors).slice(0, 120); ids.push(pf + ':ERROR ' + msg); zeilen.push(FAIL + ' ' + pf + ' - ' + msg); }
});
const kopf = okCount > 0 ? '<b>' + OK + ' Post ist bei Buffer eingeplant</b>' : '<b>' + FAIL + ' Uebergabe an Buffer fehlgeschlagen</b>';
const fuss = okCount > 0 ? 'Du musst nichts weiter tun.' : 'Bitte pruefe die Buffer-Verbindung im Workflow.';
const text = kopf + NL + NL + '<i>' + esc(d.post.headline) + '</i>' + NL + NL + zeilen.map(esc).join(NL) + NL + NL + 'Bild: ' + esc(d.image_url_public) + NL + fuss;
return [{ json: { datum: d.datum, saeule: d.saeule, headline: d.post.headline, post_text: d.post.post_text, hashtags: d.post.hashtags.join(' '), image_url: d.image_url_public, status: okCount > 0 ? 'GEPLANT' : 'FEHLER', buffer_ids: ids.join(' | '), tg_bestaetigung: text } }];` },
    position: [6240, 80]
  },
  output: [{ datum: '2026-08-14', saeule: 'angebote', headline: 'x', post_text: 'x', hashtags: '#x', image_url: 'https://i.ibb.co/abc/post.png', status: 'GEPLANT', buffer_ids: 'facebook:p1', tg_bestaetigung: 'x' }]
});

const logSchreiben = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log schreiben',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'HAaLrktmGAA8IddT', cachedResultName: 'pizzarello_post_log' }, columns: { mappingMode: 'defineBelow', value: { datum: expr('{{ $json.datum }}'), saeule: expr('{{ $json.saeule }}'), headline: expr('{{ $json.headline }}'), post_text: expr('{{ $json.post_text }}'), hashtags: expr('{{ $json.hashtags }}'), image_url: expr('{{ $json.image_url }}'), status: expr('{{ $json.status }}'), buffer_ids: expr('{{ $json.buffer_ids }}') }, matchingColumns: [], schema: [{ id: 'datum', displayName: 'datum', type: 'string', required: false, display: true, removed: false }, { id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false }, { id: 'headline', displayName: 'headline', type: 'string', required: false, display: true, removed: false }, { id: 'post_text', displayName: 'post_text', type: 'string', required: false, display: true, removed: false }, { id: 'hashtags', displayName: 'hashtags', type: 'string', required: false, display: true, removed: false }, { id: 'image_url', displayName: 'image_url', type: 'string', required: false, display: true, removed: false }, { id: 'status', displayName: 'status', type: 'string', required: false, display: true, removed: false }, { id: 'buffer_ids', displayName: 'buffer_ids', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    position: [6460, 80]
  },
  output: [{ datum: '2026-08-14' }]
});

// ===================== ABGELEHNT -> LERN-LOOP =====================
const grundAuswerten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Grund auswerten',
    parameters: { jsCode: `const raw = String($('Freigabe-Entscheidung').first().json.reason || '').trim();
const k = $('Kontext').first().json;
return [{ json: { reason: raw || '(kein Kommentar)', saeule: k.saeule, chat_id: k.chat_id, session_key: k.session_key, has_photo: k.has_photo, photo_url: k.photo_url } }];` },
    position: [6680, 240]
  },
  output: [{ reason: 'Das Bild ist zu dunkel', abort: false, saeule: 'angebote', chat_id: '7582948490' }]
});

const logVerworfen = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Log verworfen',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'HAaLrktmGAA8IddT', cachedResultName: 'pizzarello_post_log' }, columns: { mappingMode: 'defineBelow', value: { datum: expr('{{ $(\'Kontext\').first().json.datum }}'), saeule: expr('{{ $(\'Kontext\').first().json.saeule }}'), headline: expr('{{ $(\'Telegram-Daten bauen\').first().json.post.headline }}'), post_text: expr('{{ $(\'Telegram-Daten bauen\').first().json.post.post_text }}'), hashtags: expr('{{ $(\'Telegram-Daten bauen\').first().json.post.hashtags.join(\' \') }}'), image_url: expr('{{ $(\'Telegram-Daten bauen\').first().json.image_url_public }}'), status: 'VERWORFEN', buffer_ids: 'per Button verworfen' }, matchingColumns: [], schema: [{ id: 'datum', displayName: 'datum', type: 'string', required: false, display: true, removed: false }, { id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false }, { id: 'headline', displayName: 'headline', type: 'string', required: false, display: true, removed: false }, { id: 'post_text', displayName: 'post_text', type: 'string', required: false, display: true, removed: false }, { id: 'hashtags', displayName: 'hashtags', type: 'string', required: false, display: true, removed: false }, { id: 'image_url', displayName: 'image_url', type: 'string', required: false, display: true, removed: false }, { id: 'status', displayName: 'status', type: 'string', required: false, display: true, removed: false }, { id: 'buffer_ids', displayName: 'buffer_ids', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    position: [6460, 460]
  },
  output: [{ status: 'VERWORFEN' }]
});


const learningSpeichern = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Learning speichern',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'DfXfRBdmdGA5AwFs', cachedResultName: 'pizzarello_learnings' }, columns: { mappingMode: 'defineBelow', value: { saeule: expr('{{ $json.saeule }}'), kind: expr('{{ $json.kind }}'), reason: expr('{{ $json.reason }}'), learning: expr('{{ $json.regel }}'), aktiv: expr('{{ true }}') }, matchingColumns: [], schema: [{ id: 'saeule', displayName: 'saeule', type: 'string', required: false, display: true, removed: false }, { id: 'kind', displayName: 'kind', type: 'string', required: false, display: true, removed: false }, { id: 'reason', displayName: 'reason', type: 'string', required: false, display: true, removed: false }, { id: 'learning', displayName: 'learning', type: 'string', required: false, display: true, removed: false }, { id: 'aktiv', displayName: 'aktiv', type: 'boolean', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: false }, options: {} },
    position: [7780, 200]
  },
  output: [{ regel: 'Achte auf helle, gut ausgeleuchtete Bilder.' }]
});

const neuAnlauf = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Neu-Anlauf bauen',
    parameters: { jsCode: `const g = $('Grund auswerten').first().json;
const agent_input = 'WICHTIG: Der vorherige Post-Entwurf wurde vom Wirt ABGELEHNT. Begruendung: "' + g.reason + '". Entscheide: Wenn die Begruendung ein ANDERES oder neues Bild/Motiv verlangt (z.B. "nimm ein anderes Bild"), setze bild_neu=true und waehle ein passenderes Motiv - fuer Events/Strassenfeste bild_typ "flyer" (wird frisch generiert) oder ein ANDERES Archiv-Foto via get_bildarchiv. Wenn nur Text oder Details geaendert werden sollen, setze bild_neu=false, damit das bisherige Bild als Basis bleibt und nur angepasst wird. Erstelle einen verbesserten Post, der die Begruendung strikt beachtet. Rufe get_learnings erneut auf und verletze keine gespeicherten Regeln.';
return [{ json: { agent_input: agent_input, chat_id: g.chat_id, session_key: g.session_key } }];` },
    position: [7780, 420]
  },
  output: [{ agent_input: 'WICHTIG: ...', chat_id: '7582948490' }]
});

// ----- Learning-Destillation: nur dauerhafte Regeln speichern -----
const bewertungsAnfrage = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bewertungs-Anfrage',
    parameters: { jsCode: `const g = $('Grund auswerten').first().json;
const reason = String(g.reason || '');
const prompt = 'Ein Gastronom hat einen Social-Media-Post-Entwurf abgelehnt. Begruendung: "' + reason + '". Entscheide, ob daraus eine DAUERHAFTE, allgemein gueltige Regel fuer ALLE kuenftigen Posts wird, oder ob es nur eine EINMALIGE Korrektur fuer genau diesen einen Post ist (z.B. ein konkreter Titel, ein konkreter Preis oder ein bestimmtes Motiv fuer diesen Anlass). Einmalige Titel-, Text- oder Preiswuensche und Bezuege auf "diesen Post" sind NICHT dauerhaft. Formuliere eine dauerhafte Regel nur, wenn sie sinnvoll auf jeden kuenftigen Post anwendbar ist. Antworte NUR mit JSON: {"dauerhaft": true oder false, "kind": "bild|text|stil|allgemein", "regel": "eine knappe verallgemeinerte Regel in Du-Form, die immer gilt; leer wenn nicht dauerhaft"}.';
return [{ json: { openai_body: { model: 'gpt-5-mini', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } } } }];` },
    position: [6900, 320]
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
    position: [7120, 320]
  },
  output: [{ choices: [{ message: { content: '{"dauerhaft":false,"kind":"text","regel":""}' } }] }]
});

const learningParsen = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Learning parsen',
    parameters: { jsCode: `const g = $('Grund auswerten').first().json;
let dauerhaft = false, kind = 'allgemein', regel = '';
try {
  const content = $json.choices[0].message.content;
  const p = JSON.parse(content);
  dauerhaft = p.dauerhaft === true;
  kind = String(p.kind || 'allgemein');
  regel = String(p.regel || '').trim();
} catch (e) { dauerhaft = false; }
if (!regel) dauerhaft = false;
return [{ json: { dauerhaft: dauerhaft, kind: kind, regel: regel, reason: g.reason, saeule: g.saeule, chat_id: g.chat_id, session_key: g.session_key } }];` },
    position: [7340, 320]
  },
  output: [{ dauerhaft: false, kind: 'text', regel: '', reason: 'Anderer Titel', saeule: 'community', chat_id: '7582948490', session_key: '7582948490' }]
});

const dauerhaftIf = ifElse({
  version: 2.2,
  config: {
    name: 'Dauerhaft?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.dauerhaft }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [7560, 320]
  }
});

// ===================== RUECKFRAGE-SCHLEIFE =====================
const rueckfrageIf = ifElse({
  version: 2.2,
  config: {
    name: 'Rueckfrage noetig?',
    parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.output ? $json.output.needs_clarification === true : false }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } },
    position: [1620, 40]
  }
});

const rueckfrageSenden = node({
  type: 'n8n-nodes-base.telegram',
  version: 1.2,
  config: {
    name: 'Rueckfrage senden',
    parameters: { operation: 'sendAndWait', chatId: expr('{{ $(\'Restaurant-Konfiguration\').first().json.telegram_chat_id }}'), message: expr('{{ $(\'Post-Agent\').first().json.output.clarification_question }}'), responseType: 'freeText', options: { appendAttribution: false } },
    credentials: { telegramApi: newCredential('Telegram Pizzarello Bot') },
    position: [1620, -160]
  },
  output: [{ data: { text: 'Es geht um die Familienpizza fuer 12 Euro' } }]
});

const antwortEinarbeiten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Antwort einarbeiten',
    parameters: { jsCode: `const k = $('Kontext').first().json;
let frage = '';
try { frage = String($('Post-Agent').first().json.output.clarification_question || ''); } catch (e) {}
const antwort = String(($json.data && $json.data.text) || '').trim();
const agent_input = 'Antwort des Wirts auf deine Rueckfrage: "' + (antwort || '(keine Antwort)') + '". (Deine Rueckfrage war: "' + frage + '".) Beruecksichtige die urspruengliche Anfrage samt dieser Antwort und erstelle jetzt EINEN fertigen Social-Media-Post. Stelle nur dann noch eine weitere Rueckfrage, wenn es immer noch voellig unklar ist.';
return [{ json: { agent_input: agent_input, chat_id: k.chat_id, session_key: k.session_key } }];` },
    position: [1400, -160]
  },
  output: [{ agent_input: 'Antwort des Wirts ...', chat_id: '7582948490' }]
});

// ===================== PREIS-BADGE (echtes Overlay) =====================
const preisIf = ifElse({
  version: 2.2,
  config: { name: 'Preis-Badge?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }] } }, position: [4380, 380] }
});

const preisBadge = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Preis-Badge stempeln',
    parameters: {
      operation: 'multiStep',
      dataPropertyName: 'data',
      operations: { operations: [
        { operation: 'draw', primitive: 'circle', color: '#C8102E', startPositionX: 852, startPositionY: 852, endPositionX: 852, endPositionY: 704 },
        { operation: 'draw', primitive: 'circle', color: '#F5E6C8', startPositionX: 852, startPositionY: 852, endPositionX: 852, endPositionY: 716 },
        { operation: 'text', text: 'nur', fontSize: 34, fontColor: '#3a322a', positionX: 826, positionY: 815 },
        { operation: 'text', text: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), fontSize: 60, fontColor: '#C8102E', positionX: expr("{{ 852 - Math.round((($('Post aufbereiten').first().json.post.preis_text || '').length) * 15) }}"), positionY: 908 }
      ] },
      options: { destinationKey: 'data', format: 'png', quality: 100 }
    },
    position: [4480, 380]
  },
  output: [{}]
});

// ===================== COMPOSE =====================
const wf = workflow('pizzarello-marketing-agent-v2', 'Pizzarello Marketing Agent v2');

wf.add(schedTrig).to(schedKontext).to(config);

wf.add(tgTrig).to(hatFotoIf
  .onTrue(eingangsfotoLesen.to(imgbbEingang.to(tgKontextFoto.to(config))))
  .onFalse(tgKontextText.to(config)));

wf.add(config).to(websiteLaden).to(feiertageLaden).to(kontext).to(agent);

wf.add(agent).to(rueckfrageIf
  .onTrue(rueckfrageSenden.to(antwortEinarbeiten.to(agent)))
  .onFalse(postAufbereiten.to(bildModus).to(bildGenerierenIf
    .onTrue(genReq.to(gptGen.to(bildExtrahieren)))
    .onFalse(fotoBasisIf
      .onTrue(kombiReqPrev.to(gptEdits.to(bildExtrahieren)))
      .onFalse(eingangsfotoLaden.to(kombiReq.to(gptEdits.to(bildExtrahieren))))))));

wf.add(bildExtrahieren)
  .to(logoSuchen).to(logoId).to(logoDownload).to(logoConvert).to(bundle)
  .to(logoResize).to(logoComposite).to(preisIf
    .onTrue(preisBadge.to(finalExtract))
    .onFalse(finalExtract));

wf.add(finalExtract).to(imgbbUpload).to(tgDaten)
  .to(pendReq).to(pendPark).to(pushSubsGet).to(pushSend).to(tgNotify).to(waitFreigabe)
  .to(entscheidung).to(pendUpdate).to(entscheidungApproveIf
    .onTrue(bufferReq.to(bufferPost).to(logZeile).to(logSchreiben))
    .onFalse(entscheidungDiscardIf
      .onTrue(logVerworfen)
      .onFalse(grundAuswerten.to(bewertungsAnfrage).to(learningBewerten).to(learningParsen).to(dauerhaftIf
        .onTrue(learningSpeichern.to(neuAnlauf))
        .onFalse(neuAnlauf)))));

wf.add(neuAnlauf).to(agent);

export default wf;
