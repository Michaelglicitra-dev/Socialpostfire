const cfg = $('Restaurant-Konfiguration').first().json;
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
  bild_subline: String(o.bild_subline || ''),
  bild_infozeile: String(o.bild_infozeile || ''),
  bild_cta: String(o.bild_cta || ''),
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
const erlaubte = ['klassik', 'promo_poster', 'menue_karte', 'angebots_sticker', 'produkt_spotlight', 'event_poster', 'pur', 'zitat'];
if (erlaubte.indexOf(post.layout) === -1) post.layout = 'klassik';
const bildTypen = ['produkt', 'event', 'angebot', 'saison', 'flyer', 'bts'];
if (bildTypen.indexOf(post.bild_typ) === -1) post.bild_typ = '';
if (post.layout === 'pur') { post.bild_headline = ''; post.bild_subline = ''; post.bild_infozeile = ''; post.bild_cta = ''; }
else if (!post.bild_headline) post.bild_headline = post.headline.split(' ').slice(0, 5).join(' ');
// Bild-Textzeilen haerten: nur druckbares ASCII, gekappt, keine Ziffern in der Infozeile
function bildText(v, max) { var s = String(v || ''); var out = ''; for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c >= 32 && c <= 126) out += s.charAt(i); } return out.replace(/ +/g, ' ').trim().slice(0, max); }
post.bild_headline = bildText(post.bild_headline, 40);
post.bild_subline = bildText(post.bild_subline, 60);
post.bild_infozeile = bildText(post.bild_infozeile, 40).toUpperCase();
post.bild_cta = bildText(post.bild_cta, 30);
if (/[0-9]/.test(post.bild_infozeile)) post.bild_infozeile = '';
if (post.layout !== 'produkt_spotlight' && post.layout !== 'event_poster') post.bild_cta = '';
const norm = post.hashtags.map(function (t) { t = String(t).trim().replace(/ /g, ''); if (!t) return ''; return t.charAt(0) === '#' ? t : '#' + t; }).filter(function (t) { return t.length > 1; });
const setTags = cfg.hashtags[k.saeule] || cfg.hashtags.angebote;
post.hashtags = setTags.concat(norm.filter(function (t) { return setTags.indexOf(t) === -1; })).slice(0, 12);
if (!post.image_brief) post.image_brief = 'Appetizing signature dish from ' + cfg.restaurant.name;
return [{ json: { post: post } }];
