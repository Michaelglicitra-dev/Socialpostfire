// Node: "Bild-Request bauen (Foto)"  (n8n-nodes-base.code, typeVersion 2)
// KOMPLETTER Ersatz fuer den bisherigen Code des Nodes.
// Bild-Guideline v3: Textzeilen (Subline/Infozeile/CTA), Schrift je Layout,
// Vorrang der reservierten Ecken. Der Multipart-Block unten ist unveraendert.

const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const a = $('Auftrag').first().json;
const bm = $('Bild-Modus').first().json;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '', stil: 'promo', font: 'geometrisch' };
const headline = String(post.bild_headline || '').slice(0, 40);
const subline = String(post.bild_subline || '').slice(0, 60);
const info = String(post.bild_infozeile || '').slice(0, 40);
const cta = String(post.bild_cta || '').slice(0, 30);
const hatPreis = String(post.preis_text || '') !== '';
const anpassung = !!bm.anpassung;
const akzent = f.akzent || '#F5E6C8';
const schriften = { condensed: 'a bold condensed sans-serif in the spirit of Barlow Condensed', geometrisch: 'a modern geometric sans-serif in the spirit of Poppins, medium or regular weight' };
const fontHint = schriften[lay.font] || schriften.geometrisch;
const p = [];

if (anpassung) {
  p.push('Image 1 is the current, already finished post.');
  p.push('The restaurant owner asked for this change, in German: "' + String(a.reason || 'kleine Verbesserung') + '". It may contain several parts - carry out ALL of them.');
  p.push('THE CHANGE REQUEST WINS over every other instruction in this prompt: whatever it asks for must actually be different in the new picture, even when that means replacing the dish, the scene or the people in the foreground. Do not merely add the requested element behind or beside what is already there - if the request says to show something INSTEAD of something else, the old subject is gone.');
  p.push('Everything the request does NOT mention stays exactly as it is: the same framing, the same background, the same colours, the same light, the same lettering and the Pizzarello logo that is already part of image 1.');
  p.push('Image 1 already carries the Pizzarello logo in its bottom-left corner: leave it exactly where and as large as it is, and draw no further logo anywhere.');
  if (post.layout === 'pur' || !headline) {
    p.push('The picture carries no headline: leave it free of lettering.');
  } else {
    let th = 'The headline must read exactly, letter for letter: "' + headline + '" - keep its existing position, font and size.';
    if (subline) { th += ' The smaller subline under it must read exactly: "' + subline + '".'; }
    if (info) { th += ' The smallest info line must read exactly: "' + info + '".'; }
    if (cta) { th += ' The action line must read exactly: "' + cta + '".'; }
    th += ' Keep every other piece of lettering unchanged, unless the change request above asks otherwise.';
    p.push(th);
  }
  p.push(hatPreis ? 'Image 1 already carries a round price badge in the bottom-right corner: leave it exactly where it is and exactly as large as it is, do not move, resize or re-draw it, and invent no further price, number or currency symbol.' : 'Add no price, no number and no currency symbol.');
  p.push('Every letter stays fully inside the frame with a margin of at least 12 percent from every edge.');
} else {
  const fmt = cfg.bild_format || { hinweis: '' };
  p.push('Image 1 is a photo from the restaurant. Turn it into a finished social media post for an Italian pizzeria.');
  p.push(fmt.hinweis || '');
  p.push(g.grading || '');
  p.push(g.look || '');
  const brief = String(post.image_brief || '').trim();
  if (brief) {
    p.push('SUBJECT (this is what image 1 already shows - do not re-invent it and add nothing to it): ' + ('.!?'.indexOf(brief.slice(-1)) === -1 ? brief + '.' : brief));
  }
  p.push('If image 1 has no calm empty area in the upper third, extend its ground upwards to open one up instead of cropping into the dish.');
  p.push('ZONES (every element has its own area and they never overlap): the BOTTOM-LEFT corner stays empty and calm - the real Pizzarello logo is composited there afterwards; ' + (hatPreis ? 'the BOTTOM-RIGHT corner stays empty and calm as well, a real price badge is composited there later; ' : 'the bottom-right corner stays calm and quiet; ') + 'the text block keeps to the upper area as the canvas note above describes; the dish sits between them and reaches into neither bottom corner. A reserved corner beats any other placement: if the photo already fills one, gently extend and darken its ground there rather than cropping into the dish.');
  if (post.layout === 'pur' || !headline) {
    p.push('NO TEXT: the picture carries no headline, no words and no captions at all.');
  } else {
    p.push('TEXT PLACEMENT - take only the text placement from the following and ignore anything in it that would re-crop or re-stage the photo, because image 1 stays as it is: ' + (lay.bild || ''));
    let t = 'TEXT: render the HEADLINE spelled exactly, letter for letter: "' + headline + '" - by far the largest element, set in ' + fontHint + ', in cream-white ' + akzent + '.';
    if (subline) { t += ' Under it, clearly smaller, the SUBLINE spelled exactly: "' + subline + '".'; }
    if (info) { t += ' Smallest of all, uppercase and letter-spaced, the INFO LINE spelled exactly: "' + info + '".'; }
    if (cta) { t += ' An ACTION LINE spelled exactly: "' + cta + '" - small, inside a rounded rectangle in the terracotta accent colour about #C0563C, in the calm middle area and clear of both bottom corners.'; }
    t += ' The wording is German, perfect spelling is critical, and these are the only words in the picture.';
    p.push(t);
    p.push(g.typo || '');
  }
  p.push(g.stil_foto || g.stil || '');
  p.push(g.verbote || '');
}

const prompt = p.filter(function (s) { return String(s || '').length > 0; }).join(' ');

// ---- Basisfoto fuer das Multipart-Feld image[] ----
// Das Feld image[] muss mit einem Dateinamen samt gueltiger Endung und dem passenden
// Content-Type hochgeladen werden. Fehlt beides (z. B. weil "Basisfoto laden" keinen
// Dateinamen aus der URL ableiten konnte), lehnt OpenAI die Datei mit
// "Invalid image file or mode for image 1" ab. Darum hier die Datei selbst pruefen
// und Dateiname/MIME-Typ explizit setzen.
const inBin = $input.first().binary || {};
const basis = inBin.basis;
if (!basis) throw new Error('Basisfoto-Binary fehlt');

const buf = await this.helpers.getBinaryDataBuffer(0, 'basis');
if (!buf || buf.length < 32) throw new Error('Das Basisfoto ist leer (' + (buf ? buf.length : 0) + ' Byte) - Node "Basisfoto normalisieren" pruefen.');
const asc = function (von, bis) { return buf.slice(von, bis).toString('latin1'); };
let endung = '';
let mime = '';
if (buf[0] === 0x89 && asc(1, 4) === 'PNG') { endung = 'png'; mime = 'image/png'; }
else if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) { endung = 'jpg'; mime = 'image/jpeg'; }
else if (asc(0, 4) === 'RIFF' && asc(8, 12) === 'WEBP') { endung = 'webp'; mime = 'image/webp'; }
else throw new Error('Das Basisfoto ist nach der Normalisierung kein PNG/JPEG/WEBP - Node "Basisfoto normalisieren" pruefen. Quelle: ' + String(bm.base_url || 'unbekannt'));
if (buf.length > 45 * 1024 * 1024) throw new Error('Das Basisfoto ist mit ' + Math.round(buf.length / 1048576) + ' MB zu gross (Grenze der Bild-KI: 50 MB).');

const binary = {
  image0: Object.assign({}, basis, {
    fileName: 'basisfoto.' + endung,
    fileExtension: endung,
    mimeType: mime
  })
};
return [{ json: { prompt: prompt, size: String(cfg.bild_size || '1024x1536'), prompt_len: prompt.length, basis_mime: mime, basis_bytes: buf.length }, binary: binary }];
