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
p.push('ZONES (every element has its own area and they never overlap): the BOTTOM-LEFT corner stays empty and calm - the real Pizzarello logo is composited there afterwards; ' + (hatPreis ? 'the BOTTOM-RIGHT corner stays empty and calm as well, a real price badge is composited there later; ' : 'the bottom-right corner stays calm and quiet; ') + 'the text block keeps to the upper area as the canvas note above describes; the subject sits between them and reaches into neither bottom corner. A reserved corner beats any other placement: move, shorten or re-crop whatever would otherwise reach into it.');
if (post.layout === 'pur' || !headline) {
  p.push('NO TEXT: the picture carries no headline, no words and no captions at all.');
} else {
  p.push(lay.bild || '');
  const schriften = { condensed: 'a bold condensed sans-serif in the spirit of Barlow Condensed', geometrisch: 'a modern geometric sans-serif in the spirit of Poppins, medium or regular weight' };
  const fontHint = schriften[lay.font] || schriften.geometrisch;
  let t = 'TEXT: render the HEADLINE spelled exactly, letter for letter: "' + headline + '" - by far the largest element, set in ' + fontHint + ', in cream-white ' + akzent + '.';
  if (subline) { t += ' Under it, clearly smaller, the SUBLINE spelled exactly: "' + subline + '".'; }
  if (info) { t += ' Smallest of all, uppercase and letter-spaced, the INFO LINE spelled exactly: "' + info + '" - set in the calm empty space or inside a thin outlined circle.'; }
  if (cta) { t += ' An ACTION LINE spelled exactly: "' + cta + '" - small, inside a rounded rectangle in the terracotta accent colour about #C0563C, in the calm middle area and clear of both bottom corners.'; }
  t += ' The wording is German, perfect spelling is critical, and these are the only words in the picture.';
  p.push(t);
  p.push(g.typo || '');
}
p.push(g.stil || '');
p.push(g.verbote || '');

const prompt = p.filter(function (s) { return String(s || '').length > 0; }).join(' ');
const size = String(cfg.bild_size || '1024x1536');
return [{ json: { openai_gen_body: { model: 'gpt-image-1', prompt: prompt, size: size, quality: 'high', output_format: 'png', n: 1 }, size: size, prompt_len: prompt.length } }];
