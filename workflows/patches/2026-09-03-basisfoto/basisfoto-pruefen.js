// Node: "Basisfoto pruefen"  (n8n-nodes-base.code, typeVersion 2, Run Once for All Items)
// Platz im Flow: NEU, direkt hinter "Basisfoto laden", vor "Basisfoto normalisieren".
//
// Warum: /v1/images/edits akzeptiert nur PNG, JPEG und WEBP. Kam hier etwas anderes
// an (HTML-Fehler- oder Vorschauseite statt Bild, HEIC vom iPhone, leere Antwort),
// hat OpenAI mit "Invalid image file or mode for image 1" geantwortet - und der Flow
// ist erst viel spaeter im Node "Bild extrahieren" mit der irrefuehrenden Meldung
// "Die Bild-KI hat keinen Bilddatensatz geliefert" abgebrochen.

const bm = $('Bild-Modus').first().json || {};
const quelle = String(bm.base_url || 'unbekannt');
const inBin = $input.first().binary || {};
if (!inBin.basis) throw new Error('Basisfoto-Binary fehlt (Node "Basisfoto laden" hat nichts geliefert). Quelle: ' + quelle);

let buf = null;
try { buf = await this.helpers.getBinaryDataBuffer(0, 'basis'); } catch (e) { buf = null; }
if (!buf || buf.length < 32) throw new Error('Das Basisfoto ist leer oder unlesbar (' + (buf ? buf.length : 0) + ' Byte). Quelle: ' + quelle);

const b = buf;
const asc = function (von, bis) { return buf.slice(von, bis).toString('latin1'); };
let typ = '';
if (b[0] === 0x89 && asc(1, 4) === 'PNG') typ = 'png';
else if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) typ = 'jpeg';
else if (asc(0, 4) === 'RIFF' && asc(8, 12) === 'WEBP') typ = 'webp';
else if (asc(0, 4) === 'GIF8') typ = 'gif';
else if (asc(0, 2) === 'BM') typ = 'bmp';
else if (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) typ = 'tiff';
else if (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a) typ = 'tiff';
else if (asc(4, 8) === 'ftyp') typ = 'heic';

if (typ === '') {
  const probe = asc(0, 80).replace(/[^ -~]/g, '.');
  throw new Error('Der Bild-Link liefert kein Bild, sondern etwas anderes (vermutlich eine Fehler- oder Vorschauseite). Bitte im Bildarchiv den direkten Bild-Link hinterlegen. Quelle: ' + quelle + ' | Dateianfang: ' + probe);
}
if (typ === 'heic') {
  throw new Error('Das Basisfoto ist ein HEIC/AVIF-Bild (iPhone-Format) - das kann die Bild-KI nicht lesen. Bitte das Foto als JPG oder PNG neu ins Archiv laden. Quelle: ' + quelle);
}
if (buf.length > 45 * 1024 * 1024) {
  throw new Error('Das Basisfoto ist mit ' + Math.round(buf.length / 1048576) + ' MB zu gross (Grenze der Bild-KI: 50 MB). Quelle: ' + quelle);
}

return [{ json: { basis_typ: typ, basis_bytes: buf.length, basis_quelle: quelle }, binary: inBin }];
