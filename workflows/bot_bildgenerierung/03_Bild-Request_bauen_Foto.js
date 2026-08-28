const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const a = $('Auftrag').first().json;
const bm = $('Bild-Modus').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
const hatPreis = String(post.preis_text || '') !== '';
const anpassung = !!bm.anpassung;
const akzent = f.akzent || '#F5E6C8';
const fontHint = (post.bild_typ === 'flyer' || post.layout === 'event_poster') ? 'a bold condensed sans-serif in the spirit of Barlow Condensed' : 'a modern geometric sans-serif in the spirit of Poppins, medium or regular weight';
const p = [];

if (anpassung) {
  p.push('Image 1 is the current, already finished post. Keep it as it is: the same photo, composition, dish, people, colours, light, lettering and the Pizzarello logo that is already part of it.');
  p.push('Apply only this one change, requested by the restaurant owner in German: "' + String(a.reason || 'kleine Verbesserung') + '". Change nothing else.');
  p.push('Image 2 is the Pizzarello logo, attached for reference only - it is already part of image 1. Do not add a second one, do not move it and do not restyle it.');
  if (post.layout === 'pur' || !headline) {
    p.push('The picture carries no headline: leave it free of lettering.');
  } else {
    p.push('The headline must read exactly, letter for letter: "' + headline + '" - keep its existing position, font and size.');
  }
  p.push(hatPreis ? 'Image 1 already carries a round price badge in the bottom-right corner: leave it exactly where it is and exactly as large as it is, do not move, resize or re-draw it, and invent no further price, number or currency symbol.' : 'Add no price, no number and no currency symbol.');
  p.push('Every letter stays fully inside the frame with a margin of at least 12 percent from every edge.');
} else {
  p.push('Image 1 is a photo from the restaurant. Turn it into a finished vertical 2:3 social media post for an Italian pizzeria.');
  p.push(g.grading || '');
  p.push(g.look || '');
  const brief = String(post.image_brief || '').trim();
  if (brief) {
    p.push('SUBJECT (this is what image 1 already shows - do not re-invent it and add nothing to it): ' + ('.!?'.indexOf(brief.slice(-1)) === -1 ? brief + '.' : brief));
  }
  p.push('If image 1 has no calm empty area in the upper third, extend its ground upwards to open one up instead of cropping into the dish.');
  p.push('Image 2 is the Pizzarello logo.');
  p.push('ZONES (every element has its own area and they never overlap): the attached Pizzarello logo sits exactly once, small and quiet, in the BOTTOM-LEFT corner as a natural part of the picture; ' + (hatPreis ? 'the BOTTOM-RIGHT corner stays completely empty and calm, a real price badge is composited there later; ' : 'the bottom-right corner stays calm and quiet; ') + 'the headline keeps to the upper third; the dish sits between them and reaches into neither bottom corner.');
  if (post.layout === 'pur' || !headline) {
    p.push('NO TEXT: the picture carries no headline, no words and no captions at all.');
  } else {
    p.push(lay.bild || '');
    p.push('Render the headline spelled exactly, letter for letter: "' + headline + '". The wording is German, perfect spelling is critical, and it is the only lettering in the picture. Set it in ' + fontHint + ', in cream-white ' + akzent + '.');
    p.push(g.typo || '');
  }
  p.push(g.stil_foto || g.stil || '');
  p.push(g.verbote || '');
}

const prompt = p.filter(function (s) { return String(s || '').length > 0; }).join(' ');
const logoBin = $('Logo laden').first().binary || {};
const inBin = $input.first().binary || {};
const binary = {};
if (inBin.basis) binary.image0 = inBin.basis;
if (logoBin.logo) binary.logo = logoBin.logo;
if (!binary.image0) throw new Error('Basisfoto-Binary fehlt');
if (!binary.logo) throw new Error('Logo-Binary fehlt');
return [{ json: { prompt: prompt, size: String(cfg.bild_size || '1024x1536'), prompt_len: prompt.length }, binary: binary }];
