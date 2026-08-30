const f = $('Freigabe vorbereiten').first().json;
const NL = String.fromCharCode(10);
const WARN = String.fromCodePoint(0x26A0);
const esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
const tags = Array.isArray(f.hashtags) ? f.hashtags.join(' ') : String(f.hashtags || '');
const body = '<b>' + esc(f.headline) + '</b>' + NL + NL + esc(f.post_text).slice(0, 2500) + NL + NL + esc(tags);
const text = '<b>' + WARN + ' Freigegeben - aber kein Kanal aktiv</b>' + NL + NL + body + NL + NL + 'Der Post konnte nirgends eingeplant werden, weil aktuell kein Social-Media-Kanal verbunden ist. Bitte die Buffer-Kanal-ID im Workflow eintragen.' + NL + NL + 'Bild: ' + esc(f.image_url);
return [{ json: { text: text.slice(0, 4000) } }];