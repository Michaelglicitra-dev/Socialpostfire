const a = $('Auftrag').first().json;
const post = $('Post aufbereiten').first().json.post || {};
let base_url = '';
let anpassung = false;
if (post.bild_typ === 'flyer') base_url = '';
else if (a.modus === 'aenderung' && !post.bild_neu && a.prev_image_url) { base_url = a.prev_image_url; anpassung = true; }
else if (a.photo_url) base_url = a.photo_url;
else if (post.archiv_foto_url) base_url = post.archiv_foto_url;
const mode = base_url ? 'edit_url' : 'generate';
return [{ json: { mode: mode, base_url: base_url, hat_basisfoto: mode === 'edit_url', anpassung: anpassung, logo_drin: anpassung } }];
