const j = $json || {};
if (j.error || (!j.data && j.message)) {
  const roh = JSON.stringify(j).slice(0, 400);
  const t = roh.toLowerCase();
  if (t.indexOf('moderation') !== -1 || t.indexOf('content_policy') !== -1 || t.indexOf('safety') !== -1 || t.indexOf('rejected') !== -1) {
    throw new Error('Die Bild-KI hat das Motiv abgelehnt (Moderation) - bitte das Motiv anders beschreiben. Details: ' + roh);
  }
  throw new Error('Die Bild-KI hat keinen Bilddatensatz geliefert. Details: ' + roh);
}
const b64 = j.data && j.data[0] && j.data[0].b64_json;
if (!b64) throw new Error('OpenAI Bild fehlt: ' + JSON.stringify(j).slice(0, 300));
const binary = {};
binary.data = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'post.png', 'image/png');
return [{ json: { image_b64_len: b64.length }, binary: binary }];
