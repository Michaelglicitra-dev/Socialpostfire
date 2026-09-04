const e = $('Eingang').first().json;
const cfg = $('Restaurant-Konfiguration').first().json;
const row = $input.first().json || {};
const hatZeile = !!(row && row.chat_id);
// BUSY-Notbremse. Bleibt ein Lauf haengen - etwa weil ein externer Dienst
// ausfaellt und kein Fehler-Workflow greift - blockierte der Bot bisher
// dauerhaft mit "Ich bin beschaeftigt", bis der Status von Hand in der
// Data Table zurueckgesetzt wurde. Ein BUSY, das aelter als BUSY_MAX_MIN
// Minuten ist, gilt jetzt als abgelaufen und wird wie IDLE behandelt.
// Ein Bildlauf braucht selten mehr als zwei Minuten.
const BUSY_MAX_MIN = 10;
let state = hatZeile ? String(row.state || 'IDLE') : 'IDLE';
let busy_abgelaufen = false;
if (state === 'BUSY') {
  const t = Date.parse(String(row.updated || ''));
  // Ohne lesbaren Zeitstempel bleibt BUSY stehen - alle Schreiber setzen
  // "updated", ein fehlender Wert waere also ein Sonderfall, und ein
  // faelschlich freigegebener Kanal wuerde doppelt posten.
  if (!isNaN(t) && (Date.now() - t) / 60000 > BUSY_MAX_MIN) {
    state = 'IDLE';
    busy_abgelaufen = true;
  }
}
const erlaubt = String(cfg.telegram_chat_id);
const parts = String(e.callback_data || '').split(':');
const aktion = parts[0] || '';
const cb_post_id = parts.slice(1).join(':');
const gueltig = (state === 'DRAFT_OPEN') && cb_post_id !== '' && String(row.post_id || '') === cb_post_id;
let hinweis = 'Dieser Entwurf ist nicht mehr aktuell.';
if (gueltig) {
  if (aktion === 'ok') hinweis = 'Alles klar - ich plane den Post ein.';
  else if (aktion === 'neu') hinweis = 'Ich baue dir eine andere Variante.';
  else if (aktion === 'weg') hinweis = 'Verworfen.';
  else hinweis = 'Unbekannte Aktion.';
}
let route = 5;
if (e.quelle === 'telegram' && String(e.chat_id) !== erlaubt) route = 5;
else if (e.typ === 'callback') route = 0;
else if (state === 'BUSY') route = (e.quelle === 'schedule') ? 5 : 1;
else if (e.typ === 'foto') route = 2;
else if (e.typ === 'text') route = 3;
else if (e.typ === 'schedule') route = 4;
else route = 5;
return [{ json: {
  route: route,
  state: state,
  aktion: aktion,
  cb_post_id: cb_post_id,
  gueltig: gueltig && (aktion === 'ok' || aktion === 'neu' || aktion === 'weg'),
  callback_hinweis: hinweis.slice(0, 190),
  sess_post_id: String(row.post_id || ''),
  sess_draft_json: String(row.draft_json || ''),
  sess_photo_url: String(row.photo_url || ''),
  sess_last_message_id: String(row.last_message_id || ''),
  busy_abgelaufen: busy_abgelaufen
} }];
