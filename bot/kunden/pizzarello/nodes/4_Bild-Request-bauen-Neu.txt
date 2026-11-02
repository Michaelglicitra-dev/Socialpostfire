const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '', stil: 'promo', font: 'geometrisch' };
const stil = (g.stile || {})[lay.stil || 'promo'] || '';
const headline = String(post.bild_headline || '').slice(0, 40);
const subline = String(post.bild_subline || '').slice(0, 60);
const info = String(post.bild_infozeile || '').slice(0, 40);
const cta = String(post.bild_cta || '').slice(0, 30);
const hatPreis = String(post.preis_text || '') !== '';
const akzent = f.akzent || '#F5E6C8';
function pickModul(saeule, layout) {
  if (layout === 'event_poster') return 'event';
  if (saeule === 'saisonal') return 'saison';
  if (saeule === 'angebote' || layout === 'angebots_sticker') return 'angebot';
  if (saeule === 'community') return 'bts';
  return 'produkt';
}
const modulKey = (g.module || {})[post.bild_typ] ? post.bild_typ : pickModul(k.saeule, post.layout);
const modul = (g.module || {})[modulKey] || '';
const szene = (modulKey === 'flyer' || modulKey === 'event');
const p = [];

const fmt = cfg.bild_format || { hinweis: '' };
p.push('Create a new social media image for an Italian pizzeria.');
p.push(fmt.hinweis || '');
const brief = String(post.image_brief || '').trim();
p.push('SUBJECT: ' + (brief && '.!?'.indexOf(brief.slice(-1)) === -1 ? brief + '.' : brief));
p.push(modul || '');
p.push(g.look || '');
p.push(stil || '');
if (!szene) p.push(g.motiv || '');
// Reservierte Flaechen exakt aus der Config rechnen statt sie "Ecke" zu nennen:
// die Logo-Box reicht bei 1024 Breite bis 47 Prozent hinein, ein "corner" wird
// vom Modell viel kleiner angenommen - genau daran ist der CTA im Logo gelandet.
const ll = cfg.logo_layout || { box_breite: 420, box_hoehe: 200, rand: 64 };
const bB = Number(fmt.breite || 1024);
const bH = Number(fmt.hoehe || 1024);
const logoQ = Math.round(((Number(ll.rand || 64) + Number(ll.box_breite || 420)) / bB) * 100);
const logoH = Math.round(((Number(ll.rand || 64) + Number(ll.box_hoehe || 200)) / bH) * 100);
const badgeQ = Math.round((320 / bB) * 100);
const badgeH = Math.round((320 / bH) * 100);
let zonen = 'RESERVED AREAS (hard constraint - nothing may enter them, they are not merely "corners"): ';
zonen += 'the LOGO AREA covers the bottom-left of the picture, reaching ' + logoQ + ' percent across from the left edge and ' + logoH + ' percent up from the bottom. Keep that whole rectangle empty, calm and slightly darker - the real Pizzarello logo is composited into it afterwards. No text, no call-to-action block, no plate, no hand and no food detail may sit inside it. ';
zonen += hatPreis
  ? 'the PRICE AREA covers the bottom-right, reaching ' + badgeQ + ' percent in from the right edge and ' + badgeH + ' percent up from the bottom - keep it just as empty, a real price badge is composited there later. '
  : 'the bottom-right area stays calm and quiet. ';
zonen += 'The text block keeps to the upper area as the canvas note above describes, the subject sits between them, and a reserved area beats every other placement instruction: move, shorten or re-crop whatever would otherwise reach into one.';
p.push(zonen);
if (post.layout === 'pur' || !headline) {
  p.push('NO TEXT: the picture carries no headline, no words and no captions at all.');
} else {
  p.push(lay.bild || '');
  const schriften = { condensed: 'a bold condensed sans-serif in the spirit of Barlow Condensed', geometrisch: 'a modern geometric sans-serif in the spirit of Poppins, medium or regular weight' };
  const fontHint = schriften[lay.font] || schriften.geometrisch;
  let t = 'TEXT: render the HEADLINE spelled exactly, letter for letter: "' + headline + '" - by far the largest element, set in ' + fontHint + ', in cream-white ' + akzent + '.';
  if (subline) { t += ' Under it, clearly smaller, the SUBLINE spelled exactly: "' + subline + '".'; }
  if (info) { t += ' Smallest of all, uppercase and letter-spaced, the INFO LINE spelled exactly: "' + info + '" - set in the calm empty space or inside a thin outlined circle.'; }
  if (cta) { t += ' An ACTION LINE spelled exactly: "' + cta + '" - small, inside a rounded rectangle in the terracotta accent colour about #C0563C, placed directly UNDER the headline block in the upper half of the picture, never in the lower third and never inside a reserved area.'; }
  t += ' The wording is German, perfect spelling is critical, and these are the only words in the picture.';
  p.push(t);
  p.push(g.typo || '');
}
p.push(g.stil || '');
p.push(g.verbote || '');

const prompt = p.filter(function (s) { return String(s || '').length > 0; }).join(' ');
const size = String(cfg.bild_size || '1024x1536');
return [{ json: { openai_gen_body: { model: 'gpt-image-1', prompt: prompt, size: size, quality: 'high', output_format: 'png', n: 1 }, size: size, prompt_len: prompt.length } }];
