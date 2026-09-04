const inp = $input.first().json || {};
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
      look: 'BRAND LOOK: a modern premium campaign picture made to stop the scroll - the dish is the hero and must read as the main subject within one second. Rich, appetising colour on the food, strong contrast, and a deep colour-reduced ground (near-black, dark charcoal or one calm dark tone) or a real scene rendered softly out of focus - never a busy background that competes with the food. Directional light with defined highlights and rich deep shadows keeps every texture crisp: blistered leopard-spotted crust, char, cheese pull, fresh herbs, glistening oil. Shallow depth of field, so the product stays tack-sharp while everything behind it falls away. Never flat, never washed-out grey, never low in contrast, never an orange cast. Photorealistic photography - no illustration, no 3D render, no collage look.',
      motiv: 'SUBJECT STAGING: the dish sits on one calm dark ground - matte anthracite, deep black or dark brushed steel - and is staged large and close, slightly from above (60 to 75 degrees) or straight top-down. A bold detail crop that runs out of one edge is welcome and better than a small centred plate. Craft is visible: at most one or two hands or forearms hold, cut or serve it, never a recognisable face. The ingredients are readable and deliberately placed (single mortadella rosettes, burrata drops, pistachio). The food carries warm saturated colour while everything around it stays calm and dark.',
      grading: 'KEEP THE PHOTO: keep the dish, the composition, the people and the setting exactly as they are - replace nothing, add no food and no person. Only re-grade the picture towards the brand look: deepen the ground towards dark charcoal or near-black, raise the contrast and shape the light so crust, cheese and herb texture pop, warm and saturate the food itself while the surroundings stay calm and desaturated, keep the dish tack-sharp and let the background fall softly out of focus. Never flat, never washed-out grey, never an orange cast. Fully photorealistic.',
      module: {
        produkt: 'MOTIF: the finished pizza staged large and close on the bare dark ground, held or presented by one pair of hands.',
        event: 'MOTIF: a dark calm ground with the atmosphere only hinted far behind (soft blurred shapes, hands, glasses, warm lights), the food clearly staged in front of it.',
        angebot: 'MOTIF: a detail crop of the product, large and tempting, running out of the left or bottom edge on a dark ground.',
        saison: 'MOTIF: the seasonal ingredient staged fresh and raw next to the finished dish, close and precise, the colour of the season carried by the food itself.',
        bts: 'MOTIF: an honest craft moment - hands shaping dough or sliding a pizza into the stone oven, flour dust and oven flames visible - warm directional light against a dark kitchen.',
        flyer: 'MOTIF: a campaign announcement on an almost black ground - a real atmospheric scene or one large food detail running out of the lower or side edge, with wide calm space above it for the stacked text.'
      },
      stile: {
        promo: 'STYLE Promo Poster: a bold promotional poster. One large appetising hero dish dominates the lower two thirds and is generously cropped at one edge, while a deep near-black ground carries the text above it. Punchy typography with a clear hierarchy: one strong short headline plus at most one subline. A small thin-outlined circle carrying a short seasonal or local line may sit in the calm empty space, but ONLY if such a line is actually given. Confident, high-contrast, immediately appetising.',
        spotlight: 'STYLE Product Spotlight: a campaign picture built around one clear message and one call to action. A warm atmospheric food scene fills the frame and falls softly out of focus behind the message. The headline sits large and light in the upper area over the calmest part of the scene. A discreet rounded call-to-action block in the terracotta accent colour carries one short action line and sits in the calm middle area, clear of both bottom corners.',
        event: 'STYLE Event Poster: an atmospheric announcement with real depth. A genuine evening scene carries the picture - warm street or terrace atmosphere, string lights, a sunset sky, softly blurred guests far in the background, never a recognisable face - graded dark and rich so the text stays perfectly readable. A large bold condensed headline sits in the upper third with clearly smaller stacked text blocks beneath it. Festive and dynamic, but clean and never cluttered.'
      },
      typo: 'TYPE: a modern sans-serif system with a CLEAR SIZE HIERARCHY - the headline is by far the largest and strongest element, a subline is clearly smaller, an info or action line is smallest. The lettering belongs to the photograph: evenly lit, part of the scene, never a pasted-on graphic, never inside a box or band. Letters in clean white or warm cream, and at most one single word may take the terracotta accent. A single thin terracotta rule may sit directly under the headline.',
      stil: 'STYLE DISCIPLINE: the frame stays uncluttered and one clear subject leads it. People appear only as hands and forearms, or as soft blurred shapes far in the background. The colour stays muted apart from the food, which carries warm saturated colour. The picture is sharp and clean, with smooth surfaces and no film grain.',
      stil_foto: 'STYLE DISCIPLINE: keep the colour muted apart from the food, which may carry warm saturated colour; keep the picture sharp, clean and free of film grain, and calm down whatever is already around the dish rather than adding anything to it.',
      verbote: 'HARD RULES: draw no logo, wordmark, emblem or signature of any kind - the real Pizzarello logo is composited into the picture afterwards, so the picture you produce carries none. Render no price, no number, no percentage and no currency symbol, and no badge, sticker, seal, ribbon or date stamp. Render ONLY the text lines listed above and no other words anywhere. Every letter stays fully inside the frame with a margin of at least 12 percent from every edge; wrap a long headline onto two lines rather than letting it touch an edge. AVOID: rustic wooden-table trattoria kitsch, checkered tablecloths, cosy candle props, a loud red-green-white tricolore cliche, a generic stock-photo look, flat washed-out grey lighting and low contrast, a muddy or orange colour cast, serif or script typefaces, text pasted across the hero dish, a cluttered frame with many competing props, recognisable faces, distorted hands or fingers, and malformed or misspelled lettering.'
    }
  },
  layouts: {
    klassik: { name: 'Klassik', stil: 'promo', font: 'geometrisch', bild: 'HEADLINE ZONE: one calm line (two if needed) left-aligned in the upper third, cream-white, with an optional smaller subline directly under it; the dish keeps to the lower two thirds, so text and food never touch.' },
    promo_poster: { name: 'Promo-Poster', stil: 'promo', font: 'condensed', bild: 'HEADLINE ZONE: the text stacks left-aligned in the upper third - headline first, the subline under it, the small info line lowest; the hero dish fills the lower two thirds and is cropped at the right or bottom edge, leaving both bottom corners calm and empty.' },
    menue_karte: { name: 'Menue-Karte', stil: 'promo', font: 'geometrisch', bild: 'HEADLINE ZONE: top-left in the upper third, with one short ingredient line under it separated by dots ("Zutat - Zutat - Zutat"); the dish sits fully visible below it.' },
    angebots_sticker: { name: 'Angebots-Sticker', stil: 'promo', font: 'condensed', bild: 'HEADLINE ZONE: the upper third, the headline being the largest element with at most one short line under it at half the size; the dish is a detail crop along the left or bottom edge, and the bottom-right corner stays completely empty for the real price badge.' },
    produkt_spotlight: { name: 'Produkt-Spotlight', stil: 'spotlight', font: 'geometrisch', bild: 'HEADLINE ZONE: a large light headline in the upper third over the calmest part of the scene, wrapped onto two lines rather than run across the full width; the dish fills the middle of the frame and the action line sits in the calm area above the bottom corners.' },
    event_poster: { name: 'Event-Poster', stil: 'event', font: 'condensed', bild: 'HEADLINE ZONE: the upper third, bold and condensed, with generous empty space around it, one subline directly under it and one small info line for the day and the place below that; nothing else competes with it.' },
    pur: { name: 'Pur', stil: 'promo', font: 'geometrisch', bild: 'NO TEXT: the picture carries no headline, no words and no captions at all.' },
    zitat: { name: 'Zitat', stil: 'promo', font: 'geometrisch', bild: 'HEADLINE ZONE: one short line in the upper third, set in calm empty space, cream-white, with no box and no band around it.' }
  },
  logo_url: 'https://i.ibb.co/23g2B67Z/Pizzarello-transp.png',
  logo_layout: { box_breite: 420, box_hoehe: 200, rand: 64 },
  // Bildformate. "gen" ist die Groesse, die gpt-image-1 nativ liefert (nur 1024x1024,
  // 1024x1536 und 1536x1024 sind moeglich). "vertikal" markiert Formate, die nach der
  // Freigabe noch auf 9:16 erweitert werden.
  formate: {
    quadrat: { gen: '1024x1024', breite: 1024, hoehe: 1024, vertikal: false,
      hinweis: 'CANVAS: the picture is SQUARE (1:1). The text block keeps to the upper third and the dish fills the middle and lower area - there is less height than in a portrait picture, so keep the text to a headline and at most one short line under it.' },
    hoch: { gen: '1024x1536', breite: 1024, hoehe: 1536, vertikal: false,
      hinweis: 'CANVAS: the picture is TALL (2:3 portrait). There is generous height, so the text block sits comfortably in the upper third and the dish fills the lower two thirds.' },
    story: { gen: '1024x1536', breite: 1024, hoehe: 1536, vertikal: true,
      hinweis: 'CANVAS: the picture is TALL (2:3 portrait) and will later be placed on a 9:16 story canvas, so keep every important element - text, dish, both reserved corners - well inside the frame and away from the very top and bottom edges.' },
    quer: { gen: '1536x1024', breite: 1536, hoehe: 1024, vertikal: false,
      hinweis: 'CANVAS: the picture is WIDE (3:2 landscape). Set the text block in the left third and let the dish fill the right two thirds, cropped at the right edge.' }
  },
  // Eine Plattform je Post. Reihenfolge ueber die Woche, damit jedes Bild einzigartig
  // bleibt und immer im passenden Format erzeugt wird.
  plattformen: {
    instagram: { key: 'instagram', name: 'Instagram', channelId: '6a805d6bb2d9d57743816131', aktiv: true, bild_format: 'quadrat', tags: 'max5' },
    facebook: { key: 'facebook', name: 'Facebook', channelId: '', aktiv: false, bild_format: 'quadrat', tags: 'full' },
    tiktok: { key: 'tiktok', name: 'TikTok', channelId: '', aktiv: false, bild_format: 'story', tags: 'full' }
  },
  plattform_rotation: { '1': 'instagram', '2': 'facebook', '3': 'tiktok', '4': 'instagram', '5': 'facebook', '6': 'tiktok', '7': 'instagram' },
  saeulen_rotation: { '1': 'angebote', '2': 'saisonal', '3': 'community', '4': 'angebote', '5': 'saisonal', '6': 'community', '7': 'angebote' },
  hashtags: {
    angebote: ['#pizzarello', '#tagesangebot', '#pizzaderwoche', '#oberhausen', '#pizzaliebe', '#handmadepizza'],
    saisonal: ['#pizzarello', '#saisonal', '#frischezutaten', '#regional', '#oberhausen', '#italienischekueche', '#handmadepizza'],
    community: ['#pizzarello', '#stammgaeste', '#behindthescenes', '#oberhausen', '#supportlocal', '#lapizzaevita']
  },
  telegram_chat_id: '7582948490',
  buffer: {
    organizationId: '69f7afabd110cb66bf840334',
    posting_zeit: '17:00',
    pinterest_url: 'https://www.pizzarello.net'
  }
};

// ---- Plattform des Tages aufloesen -------------------------------------------------
// Ein Post geht an genau EINE Plattform. Der Wochentag entscheidet, welche. Ist die
// vorgesehene Plattform nicht scharf geschaltet (kein channelId), wird die naechste
// aktive genommen, damit der Tagespost nicht ins Leere laeuft.
const heute = $now.setZone('Europe/Berlin');
function istAktiv(p) { return p && p.aktiv && p.channelId && String(p.channelId).indexOf('<') === -1; }
const alle = cfg.plattformen || {};
const reihenfolge = ['instagram', 'facebook', 'tiktok'];
let plattform = alle[(cfg.plattform_rotation || {})[String(heute.weekday)] || 'instagram'];
if (!istAktiv(plattform)) {
  const start = reihenfolge.indexOf(plattform ? plattform.key : 'instagram');
  plattform = null;
  for (let i = 1; i <= reihenfolge.length && !plattform; i++) {
    const kand = alle[reihenfolge[(Math.max(start, 0) + i) % reihenfolge.length]];
    if (istAktiv(kand)) plattform = kand;
  }
}
const format = (cfg.formate || {})[(plattform && plattform.bild_format) || 'quadrat'] || cfg.formate.quadrat;

cfg.plattform = plattform || null;
cfg.bild_format = format;
cfg.bild_size = format.gen;
// Die nachgelagerten Nodes erwarten weiterhin eine Kanal-Liste - sie enthaelt jetzt
// genau die eine Plattform des Tages. "format: vertical" loest die vorhandene
// 9:16-Ableitung nach der Freigabe aus.
cfg.buffer.kanaele = plattform ? [{
  key: plattform.key,
  name: plattform.name,
  channelId: plattform.channelId,
  aktiv: true,
  format: format.vertikal ? 'vertical' : 'master',
  tags: plattform.tags
}] : [];

return [{ json: Object.assign({}, inp, cfg) }];
