const f = $('Freigabe vorbereiten').first().json;
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
const tags = Array.isArray(f.hashtags) ? f.hashtags.join(' ') : String(f.hashtags || '');
const body = '<b>' + esc(f.headline) + '</b>' + NL + NL + esc(f.post_text).slice(0, 2500) + NL + NL + esc(tags);
const text = kopf + NL + NL + body + NL + NL + zeilen.map(esc).join(NL) + NL + NL + fuss;
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
} }];