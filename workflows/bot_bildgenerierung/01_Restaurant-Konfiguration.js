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
      look: 'BRAND LOOK: a modern premium editorial campaign picture, lit like a studio set - the light is soft and directional and keeps every texture crisp: crust, char, cheese pull. The palette is muted, so the food carries the only real colour in the frame; one warm terracotta accent may appear as a single thin rule or one tiny detail. Photorealistic, calm, confident, with generous empty space.',
      motiv: 'SUBJECT STAGING: the dish sits on one calm single-tone ground - brushed warm-grey steel, matte anthracite or deep black - and is shot close and precise, slightly from above (60 to 75 degrees) or straight top-down. Craft is visible: at most one or two hands or forearms hold, cut or serve it. The ingredients are readable and deliberately placed (single mortadella rosettes, burrata drops, pistachio). The frame holds the dish and the bare ground, and nothing else.',
      grading: 'KEEP THE PHOTO: keep the dish, the composition, the people and the setting exactly as they are - replace nothing, add no food and no person. Only re-grade the picture towards the brand look: a neutral grey or brushed-metal mood, soft directional light, muted surroundings so the food carries the only colour, fully photorealistic.',
      module: {
        produkt: 'MOTIF: the finished pizza on the bare ground, held or presented by one pair of hands.',
        event: 'MOTIF: a dark calm ground with the atmosphere only hinted far behind (soft blurred shapes, hands, glasses), the food clearly staged in front of it.',
        angebot: 'MOTIF: a detail crop of the product, large and running out of the left or bottom edge, on a dark ground.',
        saison: 'MOTIF: the seasonal ingredient staged fresh and raw next to the finished dish, close and precise.',
        bts: 'MOTIF: an honest craft moment - hands shaping dough or sliding a pizza into the stone oven - framed cleanly against a dark studio-like ground.',
        flyer: 'MOTIF: a campaign ad on an almost black ground with one large food detail running out of the lower or side edge, and wide calm space above it for the headline.'
      },
      typo: 'TYPE: the lettering belongs to the photograph - evenly lit, part of the scene, never a pasted-on graphic. A single thin terracotta rule may sit directly under the headline.',
      stil: 'STYLE DISCIPLINE: the frame stays uncluttered and one clear subject leads it. People appear as hands and forearms, or as soft blurred shapes far in the background. The colour stays muted apart from the food. The picture is sharp and clean, with smooth surfaces and no film grain.',
      stil_foto: 'STYLE DISCIPLINE: keep the colour muted apart from the food, keep the picture sharp, clean and free of film grain, and calm down whatever is already around the dish rather than adding anything to it.',
      verbote: 'HARD RULES: draw no logo, wordmark, emblem or signature of any kind - the real Pizzarello logo is composited into the picture afterwards, so the picture you produce carries none. Render no price, no number, no percentage and no currency symbol, and no badge, sticker, seal, ribbon or date stamp. Every letter stays fully inside the frame with a margin of at least 12 percent from every edge; wrap a long headline onto two lines rather than letting it touch an edge.'
    }
  },
  layouts: {
    klassik: { name: 'Klassik', bild: 'HEADLINE ZONE: one calm line (two if needed) in the upper third, cream-white; the dish keeps to the lower two thirds, so text and food never touch.' },
    menue_karte: { name: 'Menue-Karte', bild: 'HEADLINE ZONE: top-left in the upper third, with one short ingredient line under it separated by dots ("Zutat - Zutat - Zutat"); the dish sits fully visible below it.' },
    angebots_sticker: { name: 'Angebots-Sticker', bild: 'HEADLINE ZONE: the upper third, the headline being the largest element with at most one short line under it at half the size; the dish is a detail crop along the left or bottom edge.' },
    event_poster: { name: 'Event-Poster', bild: 'HEADLINE ZONE: the upper third, bold and condensed, with generous empty space around it; nothing else competes with it.' },
    pur: { name: 'Pur', bild: 'NO TEXT: the picture carries no headline, no words and no captions at all.' },
    zitat: { name: 'Zitat', bild: 'HEADLINE ZONE: one short line in the upper third, set in calm empty space, cream-white, with no box and no band around it.' }
  },
  logo_url: 'https://i.ibb.co/23g2B67Z/Pizzarello-transp.png',
  bild_size: '1024x1536',
  logo_layout: { box_breite: 420, box_hoehe: 200, rand: 64 },
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
    kanaele: [
      { key: 'instagram', name: 'Instagram', channelId: '6a805d6bb2d9d57743816131', aktiv: true, format: 'master', tags: 'max5' },
      { key: 'facebook', name: 'Facebook', channelId: '', aktiv: false, format: 'master', tags: 'full' },
      { key: 'tiktok', name: 'TikTok', channelId: '', aktiv: false, format: 'vertical', tags: 'full' }
    ],
    pinterest_url: 'https://www.pizzarello.net'
  }
};
return [{ json: Object.assign({}, inp, cfg) }];
