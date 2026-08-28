const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
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
const fontHint = (post.bild_typ === 'flyer' || post.layout === 'event_poster') ? 'a bold condensed sans-serif in the spirit of Barlow Condensed' : 'a modern geometric sans-serif in the spirit of Poppins, medium or regular weight';
const p = [];

p.push('Create a new vertical 2:3 social media image for an Italian pizzeria.');
const brief = String(post.image_brief || '').trim();
p.push('SUBJECT: ' + (brief && '.!?'.indexOf(brief.slice(-1)) === -1 ? brief + '.' : brief));
p.push(modul || '');
p.push(g.look || '');
if (!szene) p.push(g.motiv || '');
p.push('The attached image is the Pizzarello logo only - it is not the subject of the picture.');
p.push('ZONES (every element has its own area and they never overlap): the attached Pizzarello logo sits exactly once, small and quiet, in the BOTTOM-LEFT corner as a natural part of the picture; ' + (hatPreis ? 'the BOTTOM-RIGHT corner stays completely empty and calm, a real price badge is composited there later; ' : 'the bottom-right corner stays calm and quiet; ') + 'the headline keeps to the upper third; the subject sits between them and reaches into neither bottom corner.');
if (post.layout === 'pur' || !headline) {
  p.push('NO TEXT: the picture carries no headline, no words and no captions at all.');
} else {
  p.push(lay.bild || '');
  p.push('Render the headline spelled exactly, letter for letter: "' + headline + '". The wording is German, perfect spelling is critical, and it is the only lettering in the picture. Set it in ' + fontHint + ', in cream-white ' + akzent + '.');
  p.push(g.typo || '');
}
p.push(g.stil || '');
p.push(g.verbote || '');

const prompt = p.filter(function (s) { return String(s || '').length > 0; }).join(' ');
const logoBin = $('Logo laden').first().binary || {};
const binary = {};
if (logoBin.logo) binary.logo = logoBin.logo;
if (!binary.logo) throw new Error('Logo-Binary fehlt');
return [{ json: { prompt: prompt, size: String(cfg.bild_size || '1024x1536'), prompt_len: prompt.length }, binary: binary }];
