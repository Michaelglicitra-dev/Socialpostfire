// Node: "Bild extrahieren"  (n8n-nodes-base.code, typeVersion 2)
// KOMPLETTER Ersatz fuer den bisherigen Code des Nodes.
//
// Warum: Der Node hat jeden Fehler der Bild-KI in denselben Satz gepackt
// ("Die Bild-KI hat keinen Bilddatensatz geliefert") und die eigentliche Ursache
// als rohes JSON angehaengt. Der Fehler vom 03.09.2026 war in Wahrheit ein
// abgelehntes Basisfoto ("Invalid image file or mode for image 1") - das war aus
// der Meldung nicht zu erkennen. Jetzt wird der Fehlertyp erkannt und im Klartext
// gemeldet, inklusive der Bildquelle, die das Problem ausgeloest hat.

const j = $json || {};

if (j.error || (!j.data && j.message)) {
  const roh = JSON.stringify(j).slice(0, 400);
  const err = j.error || {};
  const msg = String(err.description || err.message || j.message || '');
  const t = (msg + ' ' + roh).toLowerCase();

  let quelle = '';
  try { quelle = String(($('Bild-Modus').first().json || {}).base_url || ''); } catch (e) { quelle = ''; }

  if (t.indexOf('moderation') !== -1 || t.indexOf('content_policy') !== -1 || t.indexOf('safety') !== -1 || t.indexOf('rejected') !== -1) {
    throw new Error('Die Bild-KI hat das Motiv abgelehnt (Moderation) - bitte das Motiv anders beschreiben. Details: ' + roh);
  }
  if (t.indexOf('invalid image file') !== -1 || t.indexOf('image file or mode') !== -1 || t.indexOf('invalid_image') !== -1 || t.indexOf('unsupported image') !== -1) {
    throw new Error('Die Bild-KI konnte das Basisfoto nicht lesen (erlaubt sind nur PNG, JPEG und WEBP bis 50 MB). Basisfoto: ' + (quelle || 'unbekannt') + ' | Details: ' + roh);
  }
  if (t.indexOf('rate limit') !== -1 || t.indexOf('rate_limit') !== -1 || t.indexOf('429') !== -1) {
    throw new Error('Die Bild-KI ist gerade ueberlastet (Rate-Limit) - in ein paar Minuten nochmal versuchen. Details: ' + roh);
  }
  if (t.indexOf('timeout') !== -1 || t.indexOf('etimedout') !== -1) {
    throw new Error('Die Bild-KI hat zu lange gebraucht (Timeout) - bitte nochmal versuchen. Details: ' + roh);
  }
  throw new Error('Die Bild-KI hat keinen Bilddatensatz geliefert. Details: ' + roh);
}

const b64 = j.data && j.data[0] && j.data[0].b64_json;
if (!b64) throw new Error('OpenAI Bild fehlt: ' + JSON.stringify(j).slice(0, 300));
const binary = {};
binary.data = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'post.png', 'image/png');
return [{ json: { image_b64_len: b64.length }, binary: binary }];
