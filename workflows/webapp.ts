import { workflow, node, trigger, languageModel, memory, tool, outputParser, ifElse, newCredential, expr } from '@n8n/workflow-sdk';

// ============================================================
// Pizzarello Web-App (V2) - n8n liefert Chat-UI + JSON-API mit echter Engine
// GET  /webhook/pizzarello-app  -> Single-Page-Chat
// POST /webhook/pizzarello-api  -> generate / regenerate / approve / discard
// ============================================================

// Web-Push VAPID public key (privater Schluessel steckt im Hauptflow als Sender)
const VAPID_PUBLIC = 'BOenp5zu51cjm0M99sZkfT6Vnb4ap1rnwjHLPjK7_LTrewCwy_J-HQK3fPjtRFCGXkdc57LsGmM39aIhGAhWGpg';
const ICON = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22512%22%20height%3D%22512%22%3E%3Crect%20width%3D%22512%22%20height%3D%22512%22%20rx%3D%2296%22%20fill%3D%22%23C8102E%22%2F%3E%3Ctext%20x%3D%2250%25%22%20y%3D%2253%25%22%20font-family%3D%22Arial%2CHelvetica%2Csans-serif%22%20font-size%3D%22320%22%20font-weight%3D%22700%22%20fill%3D%22%23F5E6C8%22%20text-anchor%3D%22middle%22%20dominant-baseline%3D%22central%22%3EP%3C%2Ftext%3E%3C%2Fsvg%3E';

const HTML_PAGE = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Pizzarello Social Studio</title>
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<meta name="apple-mobile-web-app-title" content="Pizzarello" />
<meta name="theme-color" content="#1e1a17" />
<link rel="manifest" href="pizzarello-manifest" />
<link rel="apple-touch-icon" href="${ICON}" />
<style>
  :root { --rot:#C8102E; --gruen:#2E7D32; --creme:#F5E6C8; --dunkel:#1e1a17; --bg:#faf6ef; }
  * { box-sizing:border-box; }
  html, body { height:100%; margin:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; background:var(--bg); color:#241f1b; display:flex; flex-direction:column; }
  header { flex:0 0 auto; background:var(--dunkel); color:var(--creme); padding:13px 18px; display:flex; align-items:center; gap:8px; }
  header b { font-size:17px; letter-spacing:.3px; }
  header span { color:var(--rot); }
  .btn { border:0; border-radius:10px; padding:10px 15px; font-size:15px; font-weight:600; cursor:pointer; }
  .btn.primary { background:var(--rot); color:#fff; }
  .btn.ok { background:var(--gruen); color:#fff; }
  .btn.ghost { background:#efe7d8; color:#3a322a; }
  .btn:disabled { opacity:.5; cursor:default; }
  #gateWrap { flex:1 1 auto; display:flex; align-items:flex-start; justify-content:center; padding:24px 16px; }
  .card { background:#fff; border:1px solid #eadfce; border-radius:14px; padding:16px; width:100%; max-width:420px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  input#token { width:100%; border:1px solid #d9ccb6; border-radius:10px; padding:11px 12px; font-size:15px; background:#fffdf9; }
  label { font-size:13px; font-weight:600; display:block; margin-bottom:6px; color:#5c5348; }
  .muted { color:#8a7f6f; font-size:13px; }
  #app { flex:1 1 auto; display:flex; flex-direction:column; min-height:0; width:100%; max-width:760px; margin:0 auto; }
  #thread { flex:1 1 auto; overflow-y:auto; padding:16px 14px 8px; }
  .msg { max-width:88%; margin:8px 0; padding:10px 13px; border-radius:15px; font-size:15px; line-height:1.45; white-space:pre-wrap; word-wrap:break-word; }
  .msg.user { margin-left:auto; background:var(--rot); color:#fff; border-bottom-right-radius:4px; }
  .msg.bot { margin-right:auto; background:#fff; border:1px solid #eadfce; border-bottom-left-radius:4px; }
  .msg.typing { display:flex; gap:5px; align-items:center; }
  .dot { width:7px; height:7px; border-radius:50%; background:#c9bda6; animation:blink 1.2s infinite; }
  .dot:nth-child(2){ animation-delay:.2s; } .dot:nth-child(3){ animation-delay:.4s; }
  @keyframes blink { 0%,80%,100%{opacity:.3;} 40%{opacity:1;} }
  .post-img { width:100%; border-radius:10px; display:block; margin-bottom:8px; background:#eee; }
  .d-head { font-size:17px; font-weight:700; margin-bottom:4px; }
  .d-text { white-space:pre-wrap; }
  .d-tags { color:var(--rot); font-size:13px; margin-top:6px; }
  .d-meta { font-size:11px; color:#9a8f7c; margin-top:6px; }
  .d-actions { display:flex; gap:8px; margin-top:11px; flex-wrap:wrap; }
  #attachRow { flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:8px 12px 0; background:#fff; }
  #attachThumb { width:44px; height:44px; border-radius:8px; object-fit:cover; border:1px solid #d9ccb6; background:#eee; }
  #bar { flex:0 0 auto; display:flex; gap:8px; align-items:flex-end; padding:10px 12px; border-top:1px solid #e5dcc9; background:#fff; }
  #input { flex:1 1 auto; border:1px solid #d9ccb6; border-radius:12px; padding:11px 12px; font-size:15px; font-family:inherit; background:#fffdf9; resize:none; max-height:120px; }
  .hidden { display:none; }
</style>
</head>
<body>
<header>
  <b>Pizzarello <span>Social Studio</span></b>
  <span style="font-size:10px;opacity:.5;margin-left:6px">v7</span>
  <button id="pushBtn" class="btn ghost hidden" style="margin-left:auto;padding:7px 11px;font-size:13px" onclick="enablePush()">&#128276; Erinnerungen einschalten</button>
</header>

<div id="gateWrap">
  <div id="gate" class="card">
    <label>Zugangscode</label>
    <input id="token" type="password" placeholder="Zugangscode eingeben" />
    <div style="height:10px"></div>
    <button class="btn primary" onclick="unlock()">Anmelden</button>
    <div id="gateStatus" class="muted" style="margin-top:8px"></div>
  </div>
</div>

<div id="app" class="hidden">
  <div id="thread"></div>
  <div id="attachRow" class="hidden">
    <img id="attachThumb" alt="Vorschau" />
    <span class="muted" style="flex:1 1 auto">Foto angehaengt &ndash; wird als Bildgrundlage genutzt.</span>
    <button class="btn ghost" style="padding:6px 10px;font-size:13px" onclick="clearPhoto()">Entfernen</button>
  </div>
  <div id="bar">
    <input id="fileInput" type="file" accept="image/*" class="hidden" onchange="onFile(event)" />
    <button id="attachBtn" class="btn ghost" style="padding:11px 13px;font-size:18px;line-height:1" onclick="pickPhoto()" title="Foto anhaengen">&#128247;</button>
    <textarea id="input" rows="1" placeholder="Beschreibe deinen Post ..." onkeydown="onKey(event)"></textarea>
    <button id="sendBtn" class="btn primary" onclick="send()">Senden</button>
  </div>
</div>

<script>
  function lsGet(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function lsSet(k,v){ try { localStorage.setItem(k,v); } catch(e){} }
  var API = location.pathname.replace('pizzarello-app','pizzarello-api');
  var token = '';
  var session = lsGet('pz_session') || ('web-' + Math.random().toString(36).slice(2));
  lsSet('pz_session', session);
  var current = null;
  var sending = false;

  function el(id){ return document.getElementById(id); }

  function unlock(){
    token = el('token').value.trim();
    if(!token){ el('gateStatus').textContent = 'Bitte Code eingeben.'; return; }
    lsSet('pz_token', token);
    el('gateWrap').classList.add('hidden');
    el('app').classList.remove('hidden');
    if(!el('thread').hasChildNodes()){
      botText('Ciao! Beschreibe kurz, was du posten moechtest - z.B. "Pizza des Tages Diavola, heute Abend frisch aus dem Ofen". Ich baue dir Text und Bild. Danach kannst du einfach schreiben, was anders sein soll.');
    }
    el('pushBtn').classList.remove('hidden');
    updatePushBtn();
    maybeIosHint();
    loadPending();
    el('input').focus();
  }

  function scrollDown(){ var t = el('thread'); t.scrollTop = t.scrollHeight; }

  function bubble(cls){
    var d = document.createElement('div');
    d.className = 'msg ' + cls;
    el('thread').appendChild(d);
    scrollDown();
    return d;
  }
  function userText(txt){ var b = bubble('user'); b.textContent = txt; return b; }
  function userPhoto(durl, txt){
    var b = bubble('user');
    b.innerHTML = '<img src="' + durl + '" style="width:100%;max-width:220px;border-radius:10px;display:block" alt="Foto" />';
    if(txt){ var s = document.createElement('div'); s.style.marginTop = '6px'; s.textContent = txt; b.appendChild(s); }
    scrollDown();
    return b;
  }
  function botText(txt){ var b = bubble('bot'); b.textContent = txt; return b; }
  function typing(){ var b = bubble('bot typing'); b.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>'; return b; }

  function api(payload, cb){
    payload.token = token; payload.session = session;
    var t0 = Date.now();
    fetch(API, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) })
      .then(function(r){
        var secs = Math.round((Date.now() - t0) / 1000);
        return r.text().then(function(txt){
          var data;
          try { data = JSON.parse(txt); }
          catch(e){ data = { error: 'Server-Antwort ' + r.status + ' nach ' + secs + 's (kein JSON): ' + String(txt || '').replace(/<[^>]*>/g, ' ').replace(/\\s+/g, ' ').slice(0, 140) }; }
          cb(null, data);
        });
      })
      .catch(function(e){
        var secs = Math.round((Date.now() - t0) / 1000);
        cb({ secs: secs, msg: (e && e.message) ? e.message : String(e) }, null);
      });
  }

  function setPlaceholder(){ el('input').placeholder = current ? 'Was soll am Entwurf anders sein? (Titel, Bild, Ton ...)' : 'Beschreibe deinen Post ...'; }

  function renderDraft(d){
    current = d;
    var b = bubble('bot');
    var html = '';
    if(d.image_url){ html += '<img class="post-img" src="' + d.image_url + '" alt="Post-Bild" />'; }
    html += '<div class="d-head"></div><div class="d-text"></div><div class="d-tags"></div><div class="d-meta"></div>';
    html += '<div class="d-actions"><button class="btn ok">Freigeben</button><button class="btn ghost regen">Neu generieren</button><button class="btn ghost discard">Verwerfen</button></div>';
    b.innerHTML = html;
    b.querySelector('.d-head').textContent = d.headline || '';
    b.querySelector('.d-text').textContent = d.post_text || '';
    b.querySelector('.d-tags').textContent = (d.hashtags || []).join(' ');
    b.querySelector('.d-meta').textContent = 'Layout: ' + (d.layout || '-') + '  |  Bild: ' + (d.bild_typ || '-');
    b.querySelector('.ok').onclick = function(){ approve(); };
    b.querySelector('.regen').onclick = function(){ regen(); };
    b.querySelector('.discard').onclick = function(){ discard(); };
    scrollDown();
    setPlaceholder();
  }

  function lock(on){ sending = on; el('sendBtn').disabled = on; el('input').disabled = on; var a = el('attachBtn'); if(a){ a.disabled = on; } }

  // ---------- Foto anhaengen (eigene Bildgrundlage) ----------
  var pendingPhoto = null; // { b64, durl }
  function pickPhoto(){ if(sending) return; el('fileInput').click(); }
  function clearPhoto(){ pendingPhoto = null; el('attachRow').classList.add('hidden'); el('attachThumb').removeAttribute('src'); }
  function drawScaled(img, dim, q){
    var w = img.width, h = img.height;
    if(w >= h && w > dim){ h = Math.round(h * dim / w); w = dim; }
    else if(h > w && h > dim){ w = Math.round(w * dim / h); h = dim; }
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', q);
  }
  function compressToLimit(img, cb){
    // Ziel: base64 sicher unter dem Webhook-Body-Limit halten (grosse Handy-Fotos passen sonst nicht durch)
    try {
      var dim = 1280, q = 0.85, tries = 0;
      var durl = drawScaled(img, dim, q);
      while(durl.length > 750000 && tries < 9){
        tries++;
        if(q > 0.5){ q -= 0.08; } else { dim = Math.round(dim * 0.85); }
        durl = drawScaled(img, dim, q);
      }
      cb(durl.split(',')[1], durl);
    } catch(e){ cb(null, null); }
  }
  function fileToB64(file, cb){
    var reader = new FileReader();
    reader.onload = function(){
      var img = new Image();
      img.onload = function(){ compressToLimit(img, cb); };
      img.onerror = function(){ cb(null, null); };
      img.src = reader.result;
    };
    reader.onerror = function(){ cb(null, null); };
    reader.readAsDataURL(file);
  }
  function onFile(ev){
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if(!f) return;
    if(!/^image\\//.test(f.type || '')){ botText('Bitte ein Bild auswaehlen.'); return; }
    fileToB64(f, function(b64, durl){
      if(!b64){ botText('Das Foto konnte nicht gelesen werden. Bitte ein anderes Bild versuchen.'); return; }
      pendingPhoto = { b64: b64, durl: durl };
      el('attachThumb').src = durl;
      el('attachRow').classList.remove('hidden');
      el('input').focus();
    });
  }

  function send(){
    if(sending) return;
    var txt = el('input').value.trim();
    if(!txt && !pendingPhoto) return;
    el('input').value = '';
    var payload;
    if(pendingPhoto){
      current = null;
      userPhoto(pendingPhoto.durl, txt);
      payload = { action:'generate', brief: txt || 'Mach aus diesem Foto einen fertigen Post.', image_b64: pendingPhoto.b64 };
      clearPhoto();
    } else {
      userText(txt);
      payload = current ? { action:'regenerate', comment: txt, draft: current } : { action:'generate', brief: txt };
    }
    lock(true);
    var t = typing();
    api(payload, function(err, d){
      if(t.parentNode){ t.parentNode.removeChild(t); }
      lock(false);
      el('input').focus();
      if(err){ botText('Netzwerk/Timeout nach ' + (err.secs != null ? err.secs + 's' : '?') + ': ' + (err.msg || 'unbekannt') + '. Bitte nochmal senden.'); return; }
      if(d && d.error){ botText('Fehler: ' + d.error); return; }
      if(d && d.needs_clarification){ current = null; setPlaceholder(); botText(d.clarification_question || 'Kannst du das bitte praezisieren?'); return; }
      if(d){ renderDraft(d); }
    });
  }

  function approve(){
    if(!current || sending) return;
    lock(true);
    var t = typing();
    api({ action:'approve', draft: current }, function(err, d){
      if(t.parentNode){ t.parentNode.removeChild(t); }
      lock(false);
      if(err){ botText('Netzwerkfehler.'); return; }
      if(d && d.error){ botText('Fehler: ' + d.error); return; }
      botText(d && d.message ? d.message : 'Post eingeplant.');
      current = null; setPlaceholder();
    });
  }

  function regen(){
    if(!current || sending) return;
    userText('Neu generieren, bitte.');
    lock(true);
    var t = typing();
    api({ action:'regenerate', comment:'Erstelle eine ANDERE Variante mit anderem Motiv und frischer Headline, gleiches Thema und dieselben Fakten.', draft: current }, function(err, d){
      if(t.parentNode){ t.parentNode.removeChild(t); }
      lock(false);
      el('input').focus();
      if(err){ botText('Netzwerkfehler oder Zeitueberschreitung. Bitte nochmal.'); return; }
      if(d && d.error){ botText('Fehler: ' + d.error); return; }
      if(d && d.needs_clarification){ current = null; setPlaceholder(); botText(d.clarification_question || 'Kannst du das bitte praezisieren?'); return; }
      if(d){ renderDraft(d); }
    });
  }

  function discard(){
    current = null; setPlaceholder();
    botText('Entwurf verworfen. Beschreibe gern einen neuen Post.');
  }

  // ---------- Freigabe-Posteingang (offene Auto-Entwuerfe) ----------
  function renderPending(item){
    var b = bubble('bot');
    b.style.borderColor = 'var(--rot)';
    b.style.borderWidth = '2px';
    var html = '<div style="font-weight:700;color:var(--rot);margin-bottom:6px">Neuer Auto-Post wartet auf Freigabe</div>';
    if(item.image_url){ html += '<img class="post-img" src="' + item.image_url + '" alt="Post-Bild" />'; }
    html += '<div class="d-head"></div><div class="d-text"></div><div class="d-tags"></div><div class="d-meta"></div>';
    html += '<div class="d-actions"><button class="btn ok pa">Freigeben</button><button class="btn ghost pr">Neu generieren</button><button class="btn ghost pd">Verwerfen</button></div>';
    b.innerHTML = html;
    b.querySelector('.d-head').textContent = item.headline || '';
    b.querySelector('.d-text').textContent = item.post_text || '';
    b.querySelector('.d-tags').textContent = (item.hashtags || []).join(' ');
    b.querySelector('.d-meta').textContent = 'Saeule: ' + (item.saeule || '-') + '  |  ' + (item.datum || '');
    b.querySelector('.pa').onclick = function(){ decidePending('approve', item, b, ''); };
    b.querySelector('.pr').onclick = function(){ var r = window.prompt('Was soll an dem Post anders oder besser sein? (optional)') || ''; decidePending('reject', item, b, r); };
    b.querySelector('.pd').onclick = function(){ if(window.confirm('Diesen Post wirklich verwerfen?')){ decidePending('discard', item, b, ''); } };
    scrollDown();
  }
  function decidePending(kind, item, b, reason){
    var btns = b.querySelectorAll('button'); for(var i=0;i<btns.length;i++){ btns[i].disabled = true; }
    api({ action:'decide', decision: kind, reason: reason, resume_url: item.resume_url, post_id: item.post_id }, function(err, d){
      if(err){ botText('Netzwerkfehler. Bitte erneut versuchen.'); for(var i=0;i<btns.length;i++){ btns[i].disabled = false; } return; }
      if(d && d.error){ botText('Fehler: ' + d.error); for(var i=0;i<btns.length;i++){ btns[i].disabled = false; } return; }
      var act = b.querySelector('.d-actions'); if(act){ act.innerHTML = '<span class="muted">' + (d && d.message ? d.message : 'Erledigt.') + '</span>'; }
    });
  }
  function loadPending(){
    api({ action:'list_pending' }, function(err, d){
      if(err || !d || !d.pending || !d.pending.length) return;
      for(var i=0;i<d.pending.length;i++){ renderPending(d.pending[i]); }
    });
  }

  function onKey(ev){ if(ev.key === 'Enter' && !ev.shiftKey){ ev.preventDefault(); send(); } }

  // ---------- Web Push (Freigabe-Erinnerungen) ----------
  var VAPID_PUBLIC = '${VAPID_PUBLIC}';
  function isIos(){ return /iphone|ipad|ipod/i.test(navigator.userAgent || ''); }
  function isStandalone(){ return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true; }
  function pushSupported(){ return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window); }
  function updatePushBtn(){
    var b = el('pushBtn'); if(!b) return;
    if(!pushSupported()){ b.textContent = '\\uD83D\\uDD14 nicht verfuegbar'; b.disabled = true; return; }
    if(Notification.permission === 'granted' && lsGet('pz_push') === '1'){ b.textContent = '\\uD83D\\uDD14 Erinnerungen an'; b.classList.remove('ghost'); b.classList.add('ok'); }
    else { b.textContent = '\\uD83D\\uDD14 Erinnerungen einschalten'; b.classList.add('ghost'); b.classList.remove('ok'); }
  }
  var iosHintShown = false;
  function maybeIosHint(){
    if(isIos() && !isStandalone() && !iosHintShown){
      iosHintShown = true;
      botText('Tipp fuer iPhone: Damit dich Freigabe-Erinnerungen auch bei geschlossener App erreichen, tippe unten im Browser auf das Teilen-Symbol und waehle "Zum Home-Bildschirm". Oeffne die App dann ueber das neue Symbol und tippe oben auf die Glocke.');
    }
  }
  function urlB64ToUint8(base64){ var pad = '='.repeat((4 - base64.length % 4) % 4); var b = (base64 + pad).replace(/-/g,'+').replace(/_/g,'/'); var raw = atob(b); var arr = new Uint8Array(raw.length); for(var i=0;i<raw.length;i++){ arr[i] = raw.charCodeAt(i); } return arr; }
  function say(msg){ botText(msg); try { window.alert(msg); } catch(e){} }
  function enablePush(){
    if(!pushSupported()){
      say('DIAG: Push nicht verfuegbar. standalone=' + isStandalone() + ' | SW=' + ('serviceWorker' in navigator) + ' | PushManager=' + ('PushManager' in window) + ' | Notification=' + ('Notification' in window));
      return;
    }
    // WICHTIG (iOS): requestPermission MUSS direkt im Tipp-Gesture laufen - zuerst, vor allem anderen.
    var before = (typeof Notification !== 'undefined' && Notification.permission) ? Notification.permission : 'unbekannt';
    var permPromise;
    try { permPromise = Notification.requestPermission(); } catch(e){ permPromise = new Promise(function(res){ Notification.requestPermission(res); }); }
    Promise.resolve(permPromise).then(function(perm){
      if(perm !== 'granted'){ say('DIAG: keine Freigabe. vorher=' + before + ' | jetzt=' + perm + ' | standalone=' + isStandalone()); return; }
      var swUrl = location.pathname.replace('pizzarello-app','pizzarello-sw');
      navigator.serviceWorker.register(swUrl)
        .then(function(reg){ return navigator.serviceWorker.ready.then(function(){ return reg; }); })
        .then(function(reg){
          return reg.pushManager.getSubscription().then(function(existing){
            return existing || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(VAPID_PUBLIC) });
          });
        })
        .then(function(sub){
          if(!sub){ say('Konnte kein Push-Abo anlegen. Bitte App schliessen und erneut oeffnen.'); return; }
          var j = sub.toJSON();
          api({ action:'push_subscribe', sub:{ endpoint: j.endpoint, p256dh: (j.keys||{}).p256dh, auth: (j.keys||{}).auth }, label: (navigator.userAgent || '').slice(0,90) }, function(err, d){
            if(err || (d && d.error)){ say('Anmeldung fehlgeschlagen: ' + (err ? 'Netzwerk' : (d && d.error)) + '. Bitte erneut versuchen.'); return; }
            lsSet('pz_push','1'); updatePushBtn();
            say('Erledigt! Erinnerungen sind aktiv. Du bekommst eine Mitteilung, sobald ein neuer Post auf deine Freigabe wartet.');
          });
        })
        .catch(function(e){ say('Fehler beim Aktivieren: ' + (e && e.message ? e.message : e)); });
    }).catch(function(e){ say('Fehler bei der Berechtigung: ' + (e && e.message ? e.message : e)); });
  }

  var saved = lsGet('pz_token');
  if(saved){ el('token').value = saved; }
</script>
</body>
</html>`;

// ===================== Service Worker + Manifest =====================
const SW_JS = `self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(event){
  var body = 'Ein neuer Post-Entwurf wartet auf deine Freigabe.';
  try { if (event.data) { var p = event.data.json(); if (p && p.body) body = p.body; } } catch (e) {}
  var appUrl = new URL('pizzarello-app', self.registration.scope).href;
  event.waitUntil(self.registration.showNotification('Pizzarello Social Studio', {
    body: body, tag: 'pizzarello-pending', renotify: true, requireInteraction: true, data: { url: appUrl }
  }));
});
self.addEventListener('notificationclick', function(event){
  event.notification.close();
  var appUrl = (event.notification.data && event.notification.data.url) || new URL('pizzarello-app', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(list){
    for (var i = 0; i < list.length; i++){ if (list[i].url.indexOf('pizzarello-app') !== -1 && 'focus' in list[i]) return list[i].focus(); }
    if (self.clients.openWindow) return self.clients.openWindow(appUrl);
  }));
});`;

const MANIFEST_JSON = JSON.stringify({
  name: 'Pizzarello Social Studio',
  short_name: 'Pizzarello',
  start_url: 'pizzarello-app',
  scope: './',
  display: 'standalone',
  background_color: '#1e1a17',
  theme_color: '#1e1a17',
  icons: [
    { src: ICON, sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
    { src: ICON, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' }
  ]
});

// ===================== UI (GET) =====================
const uiWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Web-UI (GET)', parameters: { httpMethod: 'GET', path: 'pizzarello-app', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, position: [-1200, -400] },
  output: [{}]
});

const respondUi = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'UI ausliefern', parameters: { respondWith: 'text', responseBody: HTML_PAGE, options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }, { name: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' }, { name: 'Content-Security-Policy', value: "default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; img-src * data: blob:;" }] } } }, position: [-980, -400] }
});

// ---- Service Worker (GET /pizzarello-sw) ----
const swWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Service Worker (GET)', parameters: { httpMethod: 'GET', path: 'pizzarello-sw', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, position: [-1200, -640] },
  output: [{}]
});

const respondSw = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'SW ausliefern', parameters: { respondWith: 'text', responseBody: SW_JS, options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/javascript; charset=utf-8' }, { name: 'Service-Worker-Allowed', value: '/' }, { name: 'Cache-Control', value: 'no-cache' }] } } }, position: [-980, -640] }
});

// ---- Web-App-Manifest (GET /pizzarello-manifest) ----
const manifestWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Manifest (GET)', parameters: { httpMethod: 'GET', path: 'pizzarello-manifest', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, position: [-1200, -840] },
  output: [{}]
});

const respondManifest = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'Manifest ausliefern', parameters: { respondWith: 'text', responseBody: MANIFEST_JSON, options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/manifest+json; charset=utf-8' }] } } }, position: [-980, -840] }
});

// ===================== API (POST) =====================
const apiWebhook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: { name: 'Web-API (POST)', parameters: { httpMethod: 'POST', path: 'pizzarello-api', responseMode: 'responseNode', options: { allowedOrigins: '*' } }, position: [-1200, 120] },
  output: [{ body: { action: 'generate', token: 'xxx', session: 'web-1', brief: 'Strassenfest am 30.08.' } }]
});

const eingang = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Eingang',
    parameters: { jsCode: `// ACHTUNG: Zugangscode ist im Repo REDIGIERT. Vor jedem Deploy den echten Wert
// aus n8n (Workflow pNFLlk3GPQO3lcjS, Node "Eingang") einsetzen, sonst sperrt sich die App aus.
const cfg = { access_token: '<<<ZUGANGSCODE_AUS_N8N_EINSETZEN>>>' };
const b = ($json.body) || {};
const draft = b.draft || {};
const sub = b.sub || {};
const hdr = ($json.headers) || {};
const clen = hdr['content-length'] || hdr['Content-Length'] || '';
const diag = { clen: String(clen), bkeys: Object.keys(b).join(','), blen: JSON.stringify(b || {}).length, act: String(b.action || ''), tlen: String(b.token || '').length, ilen: String(b.image_b64 || '').length };
return [{ json: {
  _diag: diag,
  action: String(b.action || ''),
  brief: String(b.brief || ''),
  comment: String(b.comment || ''),
  session: String(b.session || 'web-anon'),
  token_ok: (b.token === cfg.access_token),
  draft: draft,
  image_url_in: String((draft && draft.image_url) || ''),
  sub_endpoint: String(sub.endpoint || ''),
  sub_p256dh: String(sub.p256dh || ''),
  sub_auth: String(sub.auth || ''),
  push_label: String(b.label || ''),
  decision: String(b.decision || ''),
  reason: String(b.reason || ''),
  resume_url: String(b.resume_url || ''),
  post_id: String(b.post_id || ''),
  image_b64: String(b.image_b64 || '')
} }];` },
    position: [-980, 120]
  },
  output: [{ action: 'generate', brief: 'x', token_ok: true, session: 'web-1' }]
});

const tokenIf = ifElse({
  version: 2.2,
  config: { name: 'Token ok?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.token_ok }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, position: [-760, 120] }
});

const tokenErr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Zugang', parameters: { jsCode: `const d = ($('Eingang').first().json._diag) || {};
return [{ json: { body_text: JSON.stringify({ error: 'Falscher Zugangscode. [DIAG v5 clen=' + d.clen + ' keys=' + d.bkeys + ' blen=' + d.blen + ' act=' + d.act + ' tlen=' + d.tlen + ' ilen=' + d.ilen + ']' }) } }];` }, position: [-540, -60] },
  output: [{ body_text: '{}' }]
});

const approveIf = ifElse({
  version: 2.2,
  config: { name: 'Aktion approve?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'approve', operator: { type: 'string', operation: 'equals' } }] } }, position: [-540, 220] }
});

const discardIf = ifElse({
  version: 2.2,
  config: { name: 'Aktion discard?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'discard', operator: { type: 'string', operation: 'equals' } }] } }, position: [-320, 340] }
});

const discardAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Verworfen', parameters: { jsCode: `return [{ json: { body_text: JSON.stringify({ message: 'Verworfen.' }) } }];` }, position: [-100, 260] },
  output: [{ body_text: '{}' }]
});

// ===================== PUSH: Abo speichern =====================
const pushSubIf = ifElse({
  version: 2.2,
  config: { name: 'Aktion push_subscribe?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'push_subscribe', operator: { type: 'string', operation: 'equals' } }] } }, position: [-540, 700] }
});

const pushStore = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Push-Abo speichern',
    parameters: { operation: 'insert', dataTableId: { __rl: true, mode: 'id', value: 'o7HPXEM4bQI8M0mR', cachedResultName: 'pizzarello_push_subs' }, columns: { mappingMode: 'defineBelow', value: { endpoint: expr("{{ $('Eingang').first().json.sub_endpoint }}"), p256dh: expr("{{ $('Eingang').first().json.sub_p256dh }}"), auth: expr("{{ $('Eingang').first().json.sub_auth }}"), label: expr("{{ $('Eingang').first().json.push_label }}"), created: expr('{{ $now.toISO() }}') }, matchingColumns: [], schema: [{ id: 'endpoint', displayName: 'endpoint', type: 'string', required: false, display: true, removed: false }, { id: 'p256dh', displayName: 'p256dh', type: 'string', required: false, display: true, removed: false }, { id: 'auth', displayName: 'auth', type: 'string', required: false, display: true, removed: false }, { id: 'label', displayName: 'label', type: 'string', required: false, display: true, removed: false }, { id: 'created', displayName: 'created', type: 'string', required: false, display: true, removed: false }], attemptToConvertTypes: false, convertFieldsToString: true }, options: {} },
    position: [-320, 700]
  },
  output: [{ endpoint: 'https://...' }]
});

const pushSubAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Push aktiv', parameters: { jsCode: `return [{ json: { body_text: JSON.stringify({ ok: true }) } }];` }, position: [-100, 700] },
  output: [{ body_text: '{}' }]
});

// ===================== FREIGABE-POSTEINGANG (offene Auto-Entwuerfe) =====================
const listPendingIf = ifElse({
  version: 2.2,
  config: { name: 'Aktion list_pending?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'list_pending', operator: { type: 'string', operation: 'equals' } }] } }, position: [-540, 860] }
});

const pendGet = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Offene Entwuerfe laden',
    parameters: { operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'W42oYny5sSWn2BAN', cachedResultName: 'pizzarello_pending' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'OFFEN' }] }, returnAll: true, orderBy: true, orderByColumn: 'createdAt', orderByDirection: 'DESC' },
    alwaysOutputData: true,
    position: [-320, 860]
  },
  output: [{ post_id: 'p1', headline: 'x' }]
});

const pendList = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Offene Liste', parameters: { jsCode: `const rows = $input.all().map(function(i){ return i.json || {}; });
const items = rows.filter(function(r){ return r && r.post_id; }).map(function(r){
  let tags = [];
  try { tags = String(r.hashtags || '').split(' ').filter(function(t){ return t; }); } catch (e) {}
  return { post_id: String(r.post_id || ''), headline: String(r.headline || ''), post_text: String(r.post_text || ''), hashtags: tags, image_url: String(r.image_url || ''), saeule: String(r.saeule || ''), datum: String(r.datum || ''), resume_url: String(r.resume_url || '') };
});
return [{ json: { body_text: JSON.stringify({ pending: items }) } }];` }, position: [-100, 860] },
  output: [{ body_text: '{}' }]
});

// ===================== FREIGABE-ENTSCHEIDUNG -> Hauptflow fortsetzen =====================
const decideIf = ifElse({
  version: 2.2,
  config: { name: 'Aktion decide?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.action }}'), rightValue: 'decide', operator: { type: 'string', operation: 'equals' } }] } }, position: [-540, 1020] }
});

const decideReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Entscheidung bauen', parameters: { jsCode: `const e = $('Eingang').first().json;
const url = String(e.resume_url || '');
if (url.indexOf('http') !== 0) { return [{ json: { ok: false, body_text: JSON.stringify({ error: 'Kein gueltiger Freigabe-Link. Bitte Seite neu laden.' }) } }]; }
const dec = String(e.decision || 'approve');
const payload = { decision: dec, reason: String(e.reason || ''), post_id: String(e.post_id || '') };
return [{ json: { ok: true, resume_url: url, payload: payload } }];` }, position: [-320, 1020] },
  output: [{ ok: true, resume_url: 'https://...', payload: {} }]
});

const decideOkIf = ifElse({
  version: 2.2,
  config: { name: 'Link gueltig?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.ok === true }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, position: [-100, 1020] }
});

const decideSend = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Hauptflow fortsetzen', parameters: { method: 'POST', url: expr('{{ $json.resume_url }}'), sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.payload) }}'), options: { response: { response: { neverError: true } }, timeout: 20000 } }, position: [120, 1080] },
  output: [{}]
});

const decideAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Entscheidung', parameters: { jsCode: `const dec = String($('Entscheidung bauen').first().json.payload.decision || 'approve');
const msg = dec === 'approve' ? 'Freigegeben - der Post wird eingeplant.' : (dec === 'discard' ? 'Post verworfen.' : 'Alles klar, ich generiere eine neue Variante. Du bekommst gleich eine neue Erinnerung.');
return [{ json: { body_text: JSON.stringify({ ok: true, message: msg }) } }];` }, position: [340, 1080] },
  output: [{ body_text: '{}' }]
});

const decideErrAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Link ungueltig', parameters: { jsCode: `return [{ json: { body_text: $json.body_text || JSON.stringify({ error: 'Ungueltig.' }) } }];` }, position: [120, 940] },
  output: [{ body_text: '{}' }]
});

// ===================== ENGINE: Konfiguration + Kontext =====================
const config = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Restaurant-Konfiguration',
    parameters: { jsCode: `const inp = $input.first().json || {};
const cfg = {
  restaurant: {
    name: 'Pizzarello',
    kueche: 'Pizzeria in Oberhausen - handgemachte, hauchduenn-knusprige Pizza zum Abholen und Bestellen',
    standort: 'Friedrich-Karl-Strasse 19, 46045 Oberhausen',
    telefon: '0208 / 888 802',
    website: 'https://www.pizzarello.net',
    ton: 'familiaer-italienisch, herzlich, ein bisschen verspielt, Du-Ansprache',
    brand_farben: { primaer: '#C8102E', sekundaer: '#2E7D32', akzent: '#F5E6C8' },
    bild_guideline: {
      markenkern: 'BRAND CORE (always apply): Pizzarello - a MODERN, premium, editorial food-brand look, like a high-end campaign, NOT a cosy trattoria and NOT a menu card. Reduced, confident, almost a lifestyle-product feel. BACKGROUND: a calm single-colour or very subtly textured surface - brushed warm-grey stainless steel/metal, deep black, or anthracite; a studio-like setup, never a rustic wooden table and never cosy warmth props. NEGATIVE SPACE: deliberately a lot of empty room (usually the upper third) as a clear zone for the headline; text and food stay clearly separated, never overlapping; the composition breathes, never crowded; optionally one thin fine terracotta 1px accent rule as a graphic divider between the text zone and the image zone. TYPOGRAPHY: a clean geometric/humanist sans-serif (in the spirit of Poppins / Circular / General Sans) - rounded, friendly yet high-end; NO serif, NO heavy block lettering; letters in white or cream on the dark/neutral ground; regular to medium weight, light and elegant, quietly confident rather than loud. COLOUR: a reduced palette - neutral grey/black or brushed metal as the base plus ONE warm accent (terracotta / rust red) used only as a thin line or a tiny detail; the pizza/food itself is the only real colour in the frame, everything else stays muted and calm; no tricolore red-green-white cliche. FOOD PHOTOGRAPHY: precise and close to the product, shot slightly from above (about 60-75 degrees) or straight top-down (90 degrees); visible craft - one or two hands holding or serving the pizza (never a face), high-quality ingredients clearly readable and deliberately styled (single mortadella rosettes, burrata drops, pistachio); light soft but contrasty enough to bring out texture (crust, cheese pull), never flat diffuse light and never hard flash. GRAPHIC ELEMENTS: use extras VERY sparingly - a small fine circular badge ONLY when a concrete date, period or location is actually part of the content, otherwise none; never invent a brand logo, wordmark or emblem (a real logo is added afterwards).',
      grading: 'BRAND GRADE (apply as a gentle modern look, but keep the existing dish, composition and setting): move it towards a clean editorial premium campaign feel - a neutral grey/anthracite or brushed-metal mood, soft but contrasty light that keeps texture crisp, muted surroundings so the food is the only real colour; no cosy warm candlelight, no orange cast, photorealistic.',
      module: {
        produkt: 'CONTENT Product/Menu (clean studio look): the pizza on a neutral brushed-metal or warm-grey surface, shot slightly from above, one or two hands holding/presenting it (craft, no face); a calm headline in the upper area plus one ingredient line separated by dots (e.g. "Zutat - Zutat - Zutat"), with generous empty space between the text and the pizza.',
        event: 'CONTENT Event (modern editorial ad): a dark, calm background with only a hinted atmosphere (softly blurred people far in the background, hands, glasses - never clear recognisable faces), the food still clearly staged; a clean light headline with plenty of negative space, inviting but premium, never a busy cosy scene.',
        angebot: 'CONTENT Offer/Special (minimal look): a dark or neutral background, a clear headline hierarchy in the upper area (size = importance); keep the LOWER-RIGHT area calm and completely free for a real round price badge that is composited afterwards - do NOT draw any price, number or badge yourself; the product shown large but cropped at the left or bottom edge (a detail crop, not the whole pizza centred), optionally a few small side elements (antipasti or dessert miniatures) at the edge.',
        saison: 'CONTENT Season (clean studio look): the seasonal ingredient staged prominently, fresh or raw, on a neutral brushed-metal or grey surface next to the finished dish, precise and close, with lots of negative space; modern editorial rather than a rustic harvest scene.',
        bts: 'CONTENT Behind the scenes (clean documentary): an authentic craft moment - hands shaping dough or sliding a pizza into the stone oven - framed cleanly and modern against a dark/neutral studio-like background, honest and human, never a clear recognisable face, never a cluttered rustic kitchen.',
        flyer: 'CONTENT Campaign/Ad (dark editorial vertical ad, NOT a printed flyer): an almost black or very dark background, a large food detail (a cut pizza or snack in close-up) along the lower or side edge, a headline in clean light sans-serif at the top, and a discreet CTA area (a rounded rectangle in the terracotta accent colour) with a short action line; it reads like a high-end social-ad campaign, calm and text-light.'
      },
      typo: 'TEXT STYLE: render in-image text in a MODERN sans-serif type system - main headlines in Poppins (Medium or Regular weight); a bold CONDENSED ad-style headline in Barlow Condensed or Archivo Narrow; any subline or body text in Inter or General Sans. Cream-white or white letters, clean and contemporary, NEVER a serif and NEVER a generic default/system font. Set the text in its own calm negative-space zone with a GENEROUS clear margin from every edge (never touching the top or side edges); clearly separated from the food, not pasted over it; optionally one thin fine terracotta rule as a divider; keep any subline to a single short line separated by dots; the lettering must look like part of one cohesive photograph, not a pasted-on graphic.',
      negativ: 'AVOID: rustic wooden-table look, trattoria kitsch, cosy candle or warmth props, serif typefaces, heavy block-lettering headlines, overloaded composition, several props at once (wine, napkin, herbs together), loud oversaturated red-green-white tricolore cliche, hard camera flash, orange colour cast, generic stock-photo look, recognisable faces of real people, distorted hands or fingers, logo distortions, any invented brand logo/wordmark/emblem, any badge, ribbon, sticker, seal or date/time stamp that was not explicitly part of the request, any price, number, percentage or currency symbol rendered into the image (prices are added afterwards as a real badge), and any text beyond a headline plus at most one short subline per image.',
      text_safety: 'TEXT SAFE AREA (critical): every piece of text, lettering, price, badge or ribbon MUST sit completely inside the image within a safe margin of at least 12 percent from every edge, with EXTRA clearance at the TOP so the first headline line never touches or runs off the top edge; never let any letter, word, badge or ribbon touch, overlap or run off any image border; if a headline is long, scale it DOWN and/or wrap it onto two lines so the whole headline fits fully within the frame with margin to spare; no text may be cut off or cropped at any edge.'
    }
  },
  layouts: {
    klassik: { name: 'Klassik', bild: 'Modern editorial look: place the headline in the calm upper-third negative-space zone in clean light sans-serif, cream-white, optionally with a thin 1px terracotta rule directly under it; keep the food in the lower two-thirds with clear empty space between text and food.' },
    menue_karte: { name: 'Menue-Karte', bild: 'Clean product look: the headline sits top-centre or top-left in a light humanist sans-serif, with one ingredient subline separated by dots ("Zutat - Zutat - Zutat") just beneath it, lots of negative space, and the food fully visible below.' },
    angebots_sticker: { name: 'Angebots-Sticker', bild: 'Minimal special look: a clear headline hierarchy in the upper area, plenty of calm negative space, and the LOWER-RIGHT area kept completely free for a real round price badge added afterwards; do NOT draw any price, number or badge yourself.' },
    event_poster: { name: 'Event-Poster', bild: 'Dark editorial ad look: the headline in clean light sans-serif in the upper area with generous negative space, the food as a large detail along a lower or side edge, and a discreet rounded-rectangle CTA area in the terracotta accent colour near the bottom.' },
    pur: { name: 'Pur', bild: 'No text at all in the image. Only the clean food photo. Absolutely no headline, no words, no badges and no captions inside the image.' },
    zitat: { name: 'Zitat', bild: 'Editorial quote look: one short clean sans-serif line set in calm negative space, cream-white, no band and no box, clearly separated from the food.' }
  },
  logo_onedrive_pfad: '/Pizzarello/assets/pizzarello_transparent.png',
  hashtags: {
    angebote: ['#pizzarello', '#tagesangebot', '#pizzaderwoche', '#oberhausen', '#pizzaliebe', '#handmadepizza'],
    saisonal: ['#pizzarello', '#saisonal', '#frischezutaten', '#regional', '#oberhausen', '#italienischekueche', '#handmadepizza'],
    community: ['#pizzarello', '#stammgaeste', '#behindthescenes', '#oberhausen', '#supportlocal', '#lapizzaevita']
  },
  posting_zeit: '17:00',
  buffer: {
    nur_demo: true,
    demo_channel_id: '6a805d6bb2d9d57743816131',
    demo_platform: 'instagram',
    channels: { facebook: '<FB_CHANNEL_ID>', instagram: '<IG_CHANNEL_ID>', pinterest: '<PIN_CHANNEL_ID>' },
    pinterest_board_service_id: '<PIN_BOARD_SERVICE_ID>',
    pinterest_url: 'https://www.pizzarello.net'
  }
};
return [{ json: Object.assign({}, inp, cfg) }];` },
    position: [-320, 40]
  },
  output: [{ restaurant: { name: 'Pizzarello' } }]
});

// Eigene Konfiguration fuer den Freigabe-Zweig, damit sich generate und approve nicht kreuzen
const configFreigabe = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Konfiguration Freigabe',
    parameters: { jsCode: `return [{ json: {
  posting_zeit: '17:00',
  buffer: {
    nur_demo: true,
    demo_channel_id: '6a805d6bb2d9d57743816131',
    demo_platform: 'instagram',
    pinterest_board_service_id: '<PIN_BOARD_SERVICE_ID>',
    pinterest_url: 'https://www.pizzarello.net'
  }
} }];` },
    position: [-320, 500]
  },
  output: [{ buffer: { demo_channel_id: 'x' } }]
});

// ---- Eigenes Foto vom Wirt? -> zu imgbb hochladen, dient als Bildgrundlage ----
const webFotoIf = ifElse({
  version: 2.2,
  config: { name: 'Eigenes Foto?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Eingang').first().json.image_b64 }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }] } }, position: [-320, -140] }
});

const webImgbb = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Eingangsfoto hochladen', parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr("{{ $('Eingang').first().json.image_b64 }}") }] }, options: { response: { response: { neverError: true } } } }, credentials: { httpCustomAuth: newCredential('imgbb') }, retryOnFail: true, maxTries: 2, waitBetweenTries: 3000, position: [-100, -220] },
  output: [{ data: { url: 'https://i.ibb.co/abc/foto.jpg' } }]
});

const webFotoParse = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Foto-Upload pruefen', parameters: { jsCode: `const r = $json || {};
const url = (r && r.data && r.data.url) ? String(r.data.url) : '';
const ok = url.indexOf('http') === 0;
return [{ json: { foto_ok: ok, has_photo: ok, photo_url: url, imgbb_raw: JSON.stringify(r).slice(0, 240) } }];` }, position: [120, -220] },
  output: [{ foto_ok: true, has_photo: true, photo_url: 'https://...' }]
});

const webFotoOkIf = ifElse({
  version: 2.2,
  config: { name: 'Foto-Upload ok?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.foto_ok }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, position: [320, -220] }
});

const webFotoErr = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Foto-Fehler', parameters: { jsCode: `return [{ json: { body_text: JSON.stringify({ error: 'Dein Foto konnte nicht hochgeladen werden. [imgbb: ' + String($json.imgbb_raw || 'leer') + ']' }) } }];` }, position: [320, -400] },
  output: [{ body_text: '{}' }]
});

const webFotoNein = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Ohne Foto', parameters: { jsCode: `return [{ json: { has_photo: false, photo_url: '' } }];` }, position: [-100, -60] },
  output: [{ has_photo: false, photo_url: '' }]
});

const kontext = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kontext',
    parameters: { jsCode: `const e = $('Eingang').first().json;
const inp = $input.first().json || {};
const hasPhoto = inp.has_photo === true;
const photoUrl = String(inp.photo_url || '');
const action = e.action;
const brief = e.brief;
const comment = e.comment;
const draft = e.draft || {};
let agent_input;
if (action === 'regenerate') {
  agent_input = 'Der Wirt hat den vorherigen Entwurf (Headline: "' + (draft.headline || '') + '") noch nicht freigegeben und wuenscht Aenderungen: "' + comment + '". Erstelle einen VERBESSERTEN Post, der diesen Wunsch strikt umsetzt. WICHTIG: Aendere NUR das, worum gebeten wird. Setze bild_neu=true NUR wenn ausdruecklich ein komplett anderes Bild/Motiv gewuenscht ist; bei reinen Text-/Titel-/Ton-Aenderungen bild_neu=false lassen, damit das bestehende Bild nur minimal angepasst wird. Nutze deine Werkzeuge fuer korrekte Fakten.';
} else if (hasPhoto) {
  agent_input = 'Der Wirt hat ueber die Web-App ein EIGENES Foto mitgeschickt - dieses Foto ist die Bildgrundlage und wird direkt verwendet. Waehle KEIN Archiv-Foto und lass archiv_foto_url LEER. Setze bild_neu=false. Notiz des Wirts zum Foto: "' + brief + '". Nutze get_speisekarte und get_aktuelle_angebote fuer korrekte Fakten/Preise (nichts erfinden). Erstelle EINEN fertigen Social-Media-Post (Headline, Text, Hashtags, Layout, kurze Bild-Headline); die Bild-Headline wird spaeter sauber auf das Foto gesetzt.';
} else {
  agent_input = 'Neue Eingabe vom Wirt ueber die Web-App: "' + brief + '". Es wurde KEIN eigenes Foto geschickt - waehle mit get_bildarchiv ein passendes Archiv-Foto als Bildgrundlage, oder lass archiv_foto_url leer wenn ein Bild frisch erzeugt werden soll (z.B. bei bild_typ flyer). Nutze get_speisekarte und get_aktuelle_angebote fuer korrekte Fakten. Erstelle EINEN fertigen Social-Media-Post.';
}
return [{ json: { source: 'web', has_photo: hasPhoto, photo_url: photoUrl, saeule: 'angebote', datum: $now.setZone('Europe/Berlin').toISODate(), agent_input: agent_input, session_key: e.session } }];` },
    position: [-100, 40]
  },
  output: [{ agent_input: 'x', session_key: 'web-1', saeule: 'angebote' }]
});

// ===================== AGENT + SUBNODES =====================
const gptModel = languageModel({
  type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  version: 1.3,
  config: { name: 'OpenAI gpt-5-mini', parameters: { model: { __rl: true, mode: 'list', value: 'gpt-5-mini', cachedResultName: 'gpt-5-mini' } }, credentials: { openAiApi: newCredential('OpenAI Pizzarello') }, position: [120, 300] }
});

const dialogMemory = memory({
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  version: 1.3,
  config: { name: 'Gespraechs-Memory', parameters: { sessionIdType: 'customKey', sessionKey: expr('{{ $json.session_key }}'), contextWindowLength: 12 }, position: [260, 300] }
});

const toolLearnings = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: { name: 'get_learnings', parameters: { descriptionType: 'manual', toolDescription: 'Liefert die gespeicherten Lern-Regeln aus abgelehnten Posts. IMMER zuerst aufrufen und jede aktive Regel strikt befolgen.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'DfXfRBdmdGA5AwFs', cachedResultName: 'pizzarello_learnings' }, returnAll: true }, position: [400, 300] }
});

const toolAngebote = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: { name: 'get_aktuelle_angebote', parameters: { descriptionType: 'manual', toolDescription: 'Liefert die hinterlegten Angebote (typ, titel, beschreibung, preis, gueltig_von, gueltig_bis, aktiv). Nur aktive und aktuell gueltige Angebote verwenden, keine Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'dVJNivQbpA7YUwAm', cachedResultName: 'pizzarello_angebote' }, returnAll: true }, position: [540, 300] }
});

const toolSpeisekarte = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: { name: 'get_speisekarte', parameters: { descriptionType: 'manual', toolDescription: 'Liefert die komplette Speisekarte des Restaurants (kategorie, name, beschreibung, preis, aktiv). Nutze sie fuer korrekte Gericht-Namen, Zutaten und Preise. Keine Gerichte oder Preise erfinden.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: '8LOssi3MEAxKEXMd', cachedResultName: 'pizzarello_speisekarte' }, returnAll: true }, position: [680, 440] }
});

const toolBildarchiv = tool({
  type: 'n8n-nodes-base.dataTableTool',
  version: 1.1,
  config: { name: 'get_bildarchiv', parameters: { descriptionType: 'manual', toolDescription: 'Liefert das Foto-Archiv des Restaurants (url, kategorie, beschreibung, aktiv). Wenn KEIN eigenes Foto mitgeschickt wurde, waehle hier das thematisch am besten passende aktive Foto und gib dessen url im Feld archiv_foto_url zurueck.', resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'x7QjV9d9CI0ZgrBz', cachedResultName: 'pizzarello_fotos' }, returnAll: true }, position: [820, 440] }
});

const postParser = outputParser({
  type: '@n8n/n8n-nodes-langchain.outputParserStructured',
  version: 1.3,
  config: { name: 'Post-Schema', parameters: { schemaType: 'fromJson', jsonSchemaExample: '{ "needs_clarification": false, "clarification_question": "", "headline": "Frisch aus dem Ofen", "post_text": "Heute Abend duftet es bei uns nach Ofenpizza - komm vorbei und lass es dir schmecken!", "hashtags": ["#pizzarello", "#oberhausen"], "layout": "klassik", "bild_typ": "produkt", "bild_neu": false, "bild_headline": "FRISCH AUS DEM OFEN", "image_brief": "A single pizza on a brushed-metal surface, held by one hand, shot slightly from above", "preis_text": "", "archiv_foto_url": "" }' }, position: [700, 300] }
});

const agent = node({
  type: '@n8n/n8n-nodes-langchain.agent',
  version: 3.1,
  config: {
    name: 'Post-Agent',
    parameters: {
      promptType: 'define',
      text: expr('{{ $json.agent_input }}'),
      hasOutputParser: true,
      options: {
        maxIterations: 12,
        systemMessage: `Du bist der Social-Media-Creator fuer die Pizzeria Pizzarello in Oberhausen. Du erstellst EINEN fertigen Instagram/Facebook/Pinterest-Post pro Anfrage.

WERKZEUGE (rufe jedes NUR EINMAL und nur bei Bedarf auf, eine leere Antwort ist normal):
- get_learnings: dauerhafte Stil-Praeferenzen des Wirts. IMMER zuerst aufrufen und sinngemaess beruecksichtigen. Uebernimm NIEMALS Titel/Text/Motiv woertlich aus einem Learning.
- get_aktuelle_angebote: aktuelle Angebote/Preise. Nur diese verwenden, nichts erfinden.
- get_speisekarte: echte Gerichte, Zutaten und Preise.
- get_bildarchiv: vorhandene Restaurant-Fotos (url, kategorie, beschreibung).

BILDGRUNDLAGE:
- Waehle mit get_bildarchiv das thematisch am besten passende aktive Foto und gib dessen exakte url im Feld archiv_foto_url zurueck. Variiere die Motive.
- Findest du kein passendes Archiv-Foto (oder das Archiv ist leer), lass archiv_foto_url leer - dann wird frisch generiert.
- Bei bild_typ "flyer" wird IMMER frisch als Plakat generiert: lass archiv_foto_url leer und beschreibe in image_brief die Event-Szene/Location, NICHT ein einzelnes Gericht.

AENDERUNGEN: Wenn der Wirt einen bestehenden Entwurf anpassen will, aendere NUR das Gewuenschte. Setze bild_neu=true ausschliesslich, wenn ausdruecklich ein KOMPLETT anderes Bild/Motiv verlangt wird; bei Titel-, Text- oder Ton-Aenderungen bild_neu=false.

RUECKFRAGEN: Nur wenn die Eingabe wirklich unklar/widerspruechlich ist, stelle GENAU EINE kurze Rueckfrage auf Deutsch (needs_clarification=true, Frage in clarification_question, andere Felder leer). Sonst needs_clarification=false und liefere sofort den fertigen Post.

MARKE & TON: familiaer-italienisch, herzlich, verspielt, Du-Ansprache. Beginne NIE mit "Mamma mia". Erfinde fuer JEDEN Post eine NEUE eigenstaendige Headline; wiederhole keinen frueheren Titel. Kein Clickbait, keine erfundenen Fakten. Der Bild-Look ist MODERN/editorial/premium (cleaner Studio-Hintergrund, viel Negativraum), nicht rustikal.

FELDER:
- needs_clarification (bool), clarification_question (string).
- headline: kurze Ueberschrift.
- post_text: 2-5 Saetze, warm, konkret, dezenter Call-to-Action, Emojis sparsam.
- hashtags: 3-6 Tags (Basis-Tags werden ergaenzt).
- layout: einer von klassik, menue_karte, angebots_sticker, event_poster, pur, zitat.
- bild_typ: einer von produkt, event, angebot, saison, flyer, bts (passend zum Inhalt; fuer flyer layout event_poster).
- bild_neu: true nur wenn ein KOMPLETT anderes Bild gewuenscht ist, sonst false.
- bild_headline: sehr kurzer Bild-Text (max 40 Zeichen), ASCII ohne Umlaute. Bei layout "pur" leer.
- image_brief: EIN englischer Satz zum Foto-Motiv (Gericht/Szene), im modernen Studio-Look.
- preis_text: NUR bei einem Angebot mit konkretem Preis den exakten Preis im deutschen Format wie "5,99 EUR" oder "5,99 Euro" (NIEMALS einen Preis erfinden - nur der vom Wirt genannte oder der Preis aus get_aktuelle_angebote/get_speisekarte). Sonst LEER. Dieser Preis wird spaeter als echter Badge aufs Bild gestempelt; im image_brief/bild_headline selbst KEINE Zahl/Preis nennen.
- archiv_foto_url: url eines passenden Archiv-Fotos, sonst leer.`
      }
    },
    subnodes: { model: gptModel, memory: dialogMemory, tools: [toolLearnings, toolAngebote, toolSpeisekarte, toolBildarchiv], outputParser: postParser },
    position: [420, 40]
  },
  output: [{ output: { headline: 'Frisch aus dem Ofen', post_text: '...', hashtags: ['#pizzarello'], layout: 'klassik', bild_typ: 'produkt', bild_neu: false, bild_headline: 'FRISCH', image_brief: 'A pizza', archiv_foto_url: '' } }]
});

// Rueckfrage? -> direkt antworten, sonst weiter
const rueckfrageIf = ifElse({
  version: 2.2,
  config: { name: 'Rueckfrage noetig?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.output ? $json.output.needs_clarification === true : false }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, position: [640, 40] }
});

const rueckfrageAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Rueckfrage', parameters: { jsCode: `const o = $('Post-Agent').first().json.output || {};
return [{ json: { body_text: JSON.stringify({ needs_clarification: true, clarification_question: String(o.clarification_question || 'Kannst du das bitte praezisieren?') }) } }];` }, position: [640, -140] },
  output: [{ body_text: '{}' }]
});

const postAufbereiten = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Post aufbereiten',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
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
  image_brief: String(o.image_brief || ''),
  preis_text: String(o.preis_text || '').trim(),
  archiv_foto_url: String(o.archiv_foto_url || '').trim()
};
// Preis-Badge normalisieren: EUR/Euro -> €, ohne Ziffer verwerfen, € ergaenzen
let preis = post.preis_text.replace(/euro/ig, '€').replace(/EUR/g, '€').replace(/\\s+/g, ' ').trim();
if (!/[0-9]/.test(preis)) preis = '';
if (preis && preis.indexOf('€') === -1) preis = preis + ' €';
post.preis_text = preis.slice(0, 16);
if (post.archiv_foto_url.indexOf('http') !== 0) post.archiv_foto_url = '';
if (!post.headline || !post.post_text) throw new Error('Agent-Ausgabe unvollstaendig');
const erlaubte = ['klassik', 'menue_karte', 'angebots_sticker', 'event_poster', 'pur', 'zitat'];
if (erlaubte.indexOf(post.layout) === -1) post.layout = 'klassik';
const bildTypen = ['produkt', 'event', 'angebot', 'saison', 'flyer', 'bts'];
if (bildTypen.indexOf(post.bild_typ) === -1) post.bild_typ = '';
if (post.layout === 'pur') post.bild_headline = '';
else if (!post.bild_headline) post.bild_headline = post.headline.split(' ').slice(0, 5).join(' ');
const norm = post.hashtags.map(function(t){ t = String(t).trim().replace(/ /g, ''); if (!t) return ''; return t.charAt(0) === '#' ? t : '#' + t; }).filter(function(t){ return t.length > 1; });
const setTags = cfg.hashtags[k.saeule] || [];
post.hashtags = setTags.concat(norm.filter(function(t){ return setTags.indexOf(t) === -1; })).slice(0, 12);
if (!post.image_brief) post.image_brief = 'Appetizing signature dish from ' + cfg.restaurant.name;
return [{ json: { post: post } }];` },
    position: [860, 40]
  },
  output: [{ post: { headline: 'x', layout: 'klassik' } }]
});

// ===================== BILD =====================
const bildModus = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Bild-Modus',
    parameters: { jsCode: `const post = $('Post aufbereiten').first().json.post || {};
const e = $('Eingang').first().json;
const k = $('Kontext').first().json;
const action = String(e.action || '');
const prevUrl = String((e.draft && e.draft.image_url) || '');
const bildTyp = String(post.bild_typ || '');
const archiv = String(post.archiv_foto_url || '');
const hasPhoto = k.has_photo === true;
const photoUrl = String(k.photo_url || '');
let mode = 'generate';
let base_url = '';
if (action === 'regenerate' && !post.bild_neu && prevUrl.indexOf('http') === 0) {
  mode = 'edit_prev';
  base_url = prevUrl;
} else if (hasPhoto && photoUrl.indexOf('http') === 0) {
  mode = 'edit_url';
  base_url = photoUrl;
} else if (bildTyp === 'flyer') {
  mode = 'generate';
} else if (archiv) {
  mode = 'edit_url';
  base_url = archiv;
}
return [{ json: { mode: mode, base_url: base_url } }];` },
    position: [1080, 40]
  },
  output: [{ mode: 'generate', base_url: '' }]
});

const bildGenerierenIf = ifElse({
  version: 2.2,
  config: { name: 'Bild: generieren?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.mode }}'), rightValue: 'generate', operator: { type: 'string', operation: 'equals' } }] } }, position: [1280, 40] }
});

const genReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Gen-Request',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
const modul = (g.module || {})[post.bild_typ] || (g.module || {}).produkt || '';
const fontHint = (post.bild_typ === 'flyer') ? 'a bold CONDENSED modern sans-serif (Barlow Condensed or Archivo Narrow)' : 'a modern geometric sans-serif (Poppins, Medium or Regular weight)';
let prompt = 'Square 1:1 image. ' + post.image_brief + ' ' + (g.markenkern || '') + ' ' + modul + ' ';
prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
prompt += 'Do NOT draw, paint or invent ANY logo, wordmark, brand name, emblem, badge, ribbon, sticker, seal or date/time stamp anywhere in the image (a real logo is composited afterwards). Keep the TOP-RIGHT corner completely empty and clean, slightly darker. ';
prompt += 'Do NOT render any price, number, percentage or currency symbol anywhere in the image - prices are added afterwards as a real badge. ';
if (String(post.preis_text || '') !== '') { prompt += 'Keep the LOWER-RIGHT area calm and clean (no important detail there) for a round price badge added afterwards. '; }
if (post.layout === 'pur' || !headline) { prompt += 'Render NO headline and no text anywhere in the image. '; }
else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY, letter for letter, as: "' + headline + '". Perfect spelling is critical, no other words. Use ' + fontHint + ', in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. '; }
prompt += (g.text_safety || '') + ' ' + (g.negativ || '');
return [{ json: { openai_gen_body: { model: 'gpt-image-1', prompt: prompt, size: '1024x1024', quality: 'high', output_format: 'png', n: 1 } } }];` },
    position: [1500, -80]
  },
  output: [{ openai_gen_body: { model: 'gpt-image-1' } }]
});

const gptGen = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'GPT Bild (gen)', parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/generations', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.openai_gen_body) }}'), options: { timeout: 180000 } }, credentials: { openAiApi: newCredential('OpenAI Pizzarello') }, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, position: [1720, -80] },
  output: [{ data: [{ b64_json: 'xxxx' }] }]
});

const basisfotoLaden = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Basisfoto laden', parameters: { url: expr('{{ $(\'Bild-Modus\').first().json.base_url }}'), options: { response: { response: { responseFormat: 'file' } } } }, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, position: [1500, 160] },
  output: [{}]
});

const kombiReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Kombi-Request',
    parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const post = $('Post aufbereiten').first().json.post;
const bm = $('Bild-Modus').first().json;
const e = $('Eingang').first().json;
const isEditPrev = bm.mode === 'edit_prev';
const comment = String(e.comment || '');
let b64 = null, mime = 'image/jpeg';
const bin = $input.first().binary && $input.first().binary.data;
if (bin && bin.mimeType) mime = bin.mimeType;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); b64 = buf.toString('base64'); } catch (er) { if (bin && bin.data) b64 = bin.data; }
if (!b64) throw new Error('Basisfoto konnte nicht gelesen werden');
const g = cfg.restaurant.bild_guideline || {};
const f = cfg.restaurant.brand_farben || {};
const lay = (cfg.layouts || {})[post.layout] || { bild: '' };
const headline = String(post.bild_headline || '').slice(0, 40);
let prompt;
if (isEditPrev) {
  prompt = 'This is an ALREADY FINISHED square social media post image. Keep the ENTIRE image pixel-identical - exactly the same photo, composition, background, lighting, colours and any existing logo - and change ONLY what the user asks: "' + comment + '". ';
  if (post.layout === 'pur' || !headline) { prompt += 'Do not add or change any text. '; }
  else { prompt += 'If the change concerns the title/headline, replace the existing in-image headline so it reads EXACTLY: "' + headline + '" in the same font style, colour and position, within a generous safe margin and never touching any edge; otherwise keep all existing text unchanged. '; }
  prompt += 'Do NOT add, invent, move or restyle any logo, wordmark, badge, ribbon, seal or date/time stamp, and do not re-grade or restyle the rest of the image. ' + (g.text_safety || '');
} else {
  prompt = 'Create a finished square 1:1 social media post image for an Italian restaurant from the provided photo. Keep the dish, composition and setting exactly as they are, do not replace or invent food items or people. ';
  prompt += (g.grading || '') + ' ';
  prompt += 'IMPORTANT: Do NOT draw, paint or invent ANY logo, wordmark, brand name, emblem, badge, ribbon, sticker, seal or date/time stamp anywhere. Keep the TOP-RIGHT corner completely empty and clean (slightly darker) - a real logo is composited there afterwards. ';
  prompt += 'Do NOT render any price, number, percentage or currency symbol anywhere - prices are added afterwards as a real badge. ';
  if (String(post.preis_text || '') !== '') { prompt += 'Keep the LOWER-RIGHT area calm and clean for a round price badge added afterwards. '; }
  prompt += 'TEXT PLACEMENT: ' + (lay.bild || '') + ' ';
  if (post.layout === 'pur' || !headline) { prompt += 'Render NO headline and no other text anywhere. '; }
  else { prompt += (g.typo || '') + ' Render the headline spelled EXACTLY as: "' + headline + '". Perfect spelling. Keep it clear of the top-right corner. Use a modern geometric sans-serif (Poppins, Medium or Regular weight), in clean cream-white ' + (f.akzent || '#F5E6C8') + ', placed in its own calm upper negative-space zone with a GENEROUS clear margin so no letter touches the top or side edges (wrap onto two lines if long), optionally underlined by ONE thin fine terracotta rule (about #C0563C). Absolutely no serif and no default/system font. '; }
  prompt += (g.text_safety || '') + ' ' + (g.negativ || '') + ' No watermark, no border, tack-sharp, clean.';
}
const mimePng = mime.indexOf('png') !== -1 ? 'image/png' : 'image/jpeg';
const ext = mimePng === 'image/png' ? 'png' : 'jpg';
const binary = {};
binary.image0 = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'image0.' + ext, mimePng);
return [{ json: { prompt: prompt }, binary: binary }];` },
    position: [1720, 160]
  },
  output: [{ prompt: 'x' }]
});

const gptEdits = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'GPT Bild (edits)', parameters: { method: 'POST', url: 'https://api.openai.com/v1/images/edits', authentication: 'predefinedCredentialType', nodeCredentialType: 'openAiApi', sendBody: true, contentType: 'multipart-form-data', bodyParameters: { parameters: [{ name: 'model', value: 'gpt-image-1' }, { name: 'prompt', value: expr('{{ $json.prompt }}') }, { name: 'size', value: '1024x1024' }, { name: 'quality', value: 'high' }, { name: 'input_fidelity', value: 'high' }, { name: 'output_format', value: 'png' }, { parameterType: 'formBinaryData', name: 'image[]', inputDataFieldName: 'image0' }] }, options: { timeout: 180000 } }, credentials: { openAiApi: newCredential('OpenAI Pizzarello') }, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000, position: [1940, 160] },
  output: [{ data: [{ b64_json: 'xxxx' }] }]
});

const bildExtrahieren = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Bild extrahieren', parameters: { jsCode: `const b64 = $json.data && $json.data[0] && $json.data[0].b64_json;
if (!b64) throw new Error('OpenAI Bild fehlt: ' + JSON.stringify($json).slice(0, 300));
return [{ json: { image_b64: b64 } }];` }, position: [2160, 40] },
  output: [{ image_b64: 'xxxx' }]
});

// ===================== LOGO OVERLAY =====================
const logoSuchen = node({
  type: 'n8n-nodes-base.microsoftOneDrive',
  version: 1.1,
  config: { name: 'Logo suchen', parameters: { operation: 'search', query: expr('{{ $(\'Restaurant-Konfiguration\').first().json.logo_onedrive_pfad.split(\'/\').pop() }}') }, credentials: { microsoftOneDriveOAuth2Api: newCredential('OneDrive Pizzarello') }, position: [2380, 40] },
  output: [{ id: 'file123', name: 'pizzarello_transparent.png' }]
});

const logoId = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Logo-ID waehlen', parameters: { jsCode: `const cfg = $('Restaurant-Konfiguration').first().json;
const pfad = String(cfg.logo_onedrive_pfad || '');
const dateiname = pfad.split('/').pop().toLowerCase();
const items = $input.all().map(function(i){ return i.json; }).filter(function(f){ return f && f.id && f.name && String(f.name).toLowerCase() === dateiname; });
if (items.length === 0) throw new Error('Logo nicht gefunden in OneDrive fuer "' + dateiname + '".');
return [{ json: { logo_file_id: items[0].id } }];` }, position: [2600, 40] },
  output: [{ logo_file_id: 'file123' }]
});

const logoDownload = node({
  type: 'n8n-nodes-base.microsoftOneDrive',
  version: 1.1,
  config: { name: 'Logo herunterladen', parameters: { operation: 'download', fileId: expr('{{ $json.logo_file_id }}') }, credentials: { microsoftOneDriveOAuth2Api: newCredential('OneDrive Pizzarello') }, position: [2820, 40] },
  output: [{}]
});

const logoConvert = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Logo konvertieren', parameters: { jsCode: `let logo_b64 = null;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); logo_b64 = buf.toString('base64'); } catch (e) { const bin = $input.first().binary && $input.first().binary.data; if (bin && bin.data) logo_b64 = bin.data; }
return [{ json: { logo_b64: logo_b64 } }];` }, position: [3040, 40] },
  output: [{ logo_b64: 'xxxx' }]
});

const bundle = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Bild und Logo buendeln', parameters: { jsCode: `const b64 = $('Bild extrahieren').first().json.image_b64;
const logo_b64 = $('Logo konvertieren').first().json.logo_b64;
if (!b64) throw new Error('Kein Basisbild fuer das Logo-Overlay');
if (!logo_b64) throw new Error('Kein Logo fuer das Overlay');
const binary = {};
binary.data = await this.helpers.prepareBinaryData(Buffer.from(b64, 'base64'), 'post.png', 'image/png');
binary.logo = await this.helpers.prepareBinaryData(Buffer.from(logo_b64, 'base64'), 'logo.png', 'image/png');
return [{ json: {}, binary: binary }];` }, position: [3260, 40] },
  output: [{}]
});

const logoResize = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: { name: 'Logo skalieren', parameters: { operation: 'resize', dataPropertyName: 'logo', width: 155, height: 155, options: { destinationKey: 'logo', format: 'png', quality: 100 } }, position: [3480, 40] },
  output: [{}]
});

const logoComposite = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: { name: 'Logo einfuegen', parameters: { operation: 'composite', dataPropertyNameComposite: 'logo', positionX: 850, positionY: 30, options: { destinationKey: 'data', format: 'png', quality: 100 } }, position: [3700, 40] },
  output: [{}]
});

const finalExtract = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Finalbild extrahieren', parameters: { jsCode: `let b64 = null;
try { const buf = await this.helpers.getBinaryDataBuffer(0, 'data'); if (buf && buf.length > 0) b64 = buf.toString('base64'); } catch (e) {}
if (!b64) throw new Error('Finales Bild konnte nicht gelesen werden');
return [{ json: { image_b64: b64 } }];` }, position: [3920, 40] },
  output: [{ image_b64: 'xxxx' }]
});

// ===================== PREIS-BADGE (echtes Overlay) =====================
const preisIf = ifElse({
  version: 2.2,
  config: { name: 'Preis-Badge?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }] } }, position: [3700, 240] }
});

const preisBadge = node({
  type: 'n8n-nodes-base.editImage',
  version: 1,
  config: {
    name: 'Preis-Badge stempeln',
    parameters: {
      operation: 'multiStep',
      dataPropertyName: 'data',
      operations: { operations: [
        { operation: 'draw', primitive: 'circle', color: '#C8102E', startPositionX: 852, startPositionY: 852, endPositionX: 852, endPositionY: 704 },
        { operation: 'draw', primitive: 'circle', color: '#F5E6C8', startPositionX: 852, startPositionY: 852, endPositionX: 852, endPositionY: 716 },
        { operation: 'text', text: 'nur', fontSize: 34, fontColor: '#3a322a', positionX: 826, positionY: 815 },
        { operation: 'text', text: expr("{{ $('Post aufbereiten').first().json.post.preis_text }}"), fontSize: 60, fontColor: '#C8102E', positionX: expr("{{ 852 - Math.round((($('Post aufbereiten').first().json.post.preis_text || '').length) * 15) }}"), positionY: 908 }
      ] },
      options: { destinationKey: 'data', format: 'png', quality: 100 }
    },
    position: [3920, 240]
  },
  output: [{}]
});

const imgbbUpload = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'imgbb hochladen', parameters: { method: 'POST', url: 'https://api.imgbb.com/1/upload', authentication: 'genericCredentialType', genericAuthType: 'httpCustomAuth', sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'image', value: expr('{{ $json.image_b64 }}') }] }, options: {} }, credentials: { httpCustomAuth: newCredential('imgbb') }, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000, position: [4140, 40] },
  output: [{ data: { url: 'https://i.ibb.co/abc/post.png' } }]
});

const genAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Entwurf', parameters: { jsCode: `const p = $('Post aufbereiten').first().json.post;
const k = $('Kontext').first().json;
const url = $json.data && $json.data.url;
if (!url) throw new Error('imgbb lieferte keine URL');
return [{ json: { body_text: JSON.stringify({
  headline: p.headline,
  post_text: p.post_text,
  hashtags: p.hashtags,
  layout: p.layout,
  bild_typ: p.bild_typ,
  saeule: k.saeule,
  image_url: url
}) } }];` }, position: [4360, 40] },
  output: [{ body_text: '{}' }]
});

// ===================== APPROVE -> BUFFER =====================
const bufferReq = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Buffer-Request bauen',
    parameters: { jsCode: `const cfg = $('Konfiguration Freigabe').first().json;
const e = $('Eingang').first().json;
const d = e.draft || {};
if (!d.image_url || !d.post_text) return [{ json: { body_text: JSON.stringify({ error: 'Kein gueltiger Entwurf zum Freigeben.' }) , skip: true } }];
const q = 'mutation($input: CreatePostInput!){ createPost(input:$input){ __typename ... on PostActionSuccess { post { id dueAt status } } ... on MutationError { message } } }';
const parts = (cfg.posting_zeit || '17:00').split(':');
let due = $now.setZone('Europe/Berlin').set({ hour: Number(parts[0]), minute: Number(parts[1] || 0), second: 0, millisecond: 0 });
if (due.diffNow('minutes').minutes < 15) due = due.plus({ days: 1 });
const dueAt = due.toUTC().toISO({ suppressMilliseconds: true });
const NL2 = String.fromCharCode(10) + String.fromCharCode(10);
const tags = Array.isArray(d.hashtags) ? d.hashtags : [];
const tagsMax5 = tags.slice(0, 5).join(' ');
const tagsFull = tags.join(' ');
const meta = { facebook: { facebook: { type: 'post' } }, instagram: { instagram: { type: 'post', shouldShareToFeed: true } }, pinterest: { pinterest: { title: String(d.headline || '').slice(0, 100), url: cfg.buffer.pinterest_url, boardServiceId: cfg.buffer.pinterest_board_service_id } } };
const demoPf = String(cfg.buffer.demo_platform || 'instagram');
const demoText = demoPf === 'instagram' ? (d.post_text + NL2 + tagsMax5) : (d.post_text + NL2 + tagsFull);
const input = { text: demoText, channelId: cfg.buffer.demo_channel_id, schedulingType: 'automatic', mode: 'customScheduled', dueAt: dueAt, assets: [{ image: { url: d.image_url } }] };
if (meta[demoPf]) input.metadata = meta[demoPf];
return [{ json: { platform: 'pizzarello.demo (' + demoPf + ')', graphql: { query: q, variables: { input: input } }, skip: false } }];` },
    position: [-100, 500]
  },
  output: [{ graphql: { query: 'mutation...' }, skip: false }]
});

const bufferSkipIf = ifElse({
  version: 2.2,
  config: { name: 'Buffer senden?', parameters: { conditions: { combinator: 'and', options: { caseSensitive: true, typeValidation: 'loose', version: 2 }, conditions: [{ leftValue: expr('{{ $json.skip === true }}'), rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }] } }, position: [120, 500] }
});

const bufferSkipAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Kein Entwurf', parameters: { jsCode: `return [{ json: { body_text: $json.body_text || JSON.stringify({ error: 'Kein gueltiger Entwurf.' }) } }];` }, position: [340, 380] },
  output: [{ body_text: '{}' }]
});

const bufferPost = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: { name: 'Buffer Post planen', parameters: { method: 'POST', url: 'https://api.buffer.com', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.graphql) }}'), options: { response: { response: { neverError: true } } } }, credentials: { httpHeaderAuth: newCredential('Buffer') }, position: [340, 560] },
  output: [{ data: { createPost: { post: { id: 'p1', dueAt: '2026-08-14T15:00:00Z' } } } }]
});

const approveAntwort = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: { name: 'Antwort: Freigegeben', parameters: { jsCode: `const cp = $json.data && $json.data.createPost;
if (cp && cp.post) {
  let zeit = '';
  try { zeit = DateTime.fromISO(String(cp.post.dueAt)).setZone('Europe/Berlin').toFormat('dd.MM. HH:mm'); } catch (e) {}
  return [{ json: { body_text: JSON.stringify({ message: 'Post ist bei Buffer eingeplant' + (zeit ? ' fuer ' + zeit + ' Uhr.' : '.') }) } }];
}
let msg = 'unbekannter Fehler';
if (cp && cp.message) msg = String(cp.message);
else if ($json.errors) msg = JSON.stringify($json.errors).slice(0, 160);
return [{ json: { body_text: JSON.stringify({ error: 'Buffer-Fehler: ' + msg }) } }];` }, position: [560, 560] },
  output: [{ body_text: '{}' }]
});

const respondApi = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: { name: 'API-Antwort', parameters: { respondWith: 'text', responseBody: expr('{{ $json.body_text }}'), options: { responseCode: 200, responseHeaders: { entries: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }] } } }, position: [800, 200] }
});

// ===================== COMPOSE =====================
const wf = workflow('pizzarello-webapp', 'Pizzarello Web-App');

wf.add(uiWebhook).to(respondUi);
wf.add(swWebhook).to(respondSw);
wf.add(manifestWebhook).to(respondManifest);

wf.add(apiWebhook).to(eingang).to(tokenIf
  .onFalse(tokenErr.to(respondApi))
  .onTrue(pushSubIf
    .onTrue(pushStore.to(pushSubAntwort.to(respondApi)))
    .onFalse(listPendingIf
      .onTrue(pendGet.to(pendList.to(respondApi)))
      .onFalse(decideIf
        .onTrue(decideReq.to(decideOkIf
          .onTrue(decideSend.to(decideAntwort.to(respondApi)))
          .onFalse(decideErrAntwort.to(respondApi))))
        .onFalse(approveIf
          .onTrue(configFreigabe.to(bufferReq).to(bufferSkipIf
            .onTrue(bufferSkipAntwort.to(respondApi))
            .onFalse(bufferPost.to(approveAntwort).to(respondApi))))
          .onFalse(discardIf
            .onTrue(discardAntwort.to(respondApi))
            .onFalse(webFotoIf
              .onTrue(webImgbb.to(webFotoParse).to(webFotoOkIf
                .onTrue(config)
                .onFalse(webFotoErr.to(respondApi))))
              .onFalse(webFotoNein.to(config)))))))));

wf.add(config).to(kontext).to(agent).to(rueckfrageIf
  .onTrue(rueckfrageAntwort.to(respondApi))
  .onFalse(postAufbereiten.to(bildModus).to(bildGenerierenIf
    .onTrue(genReq.to(gptGen.to(bildExtrahieren)))
    .onFalse(basisfotoLaden.to(kombiReq.to(gptEdits.to(bildExtrahieren)))))));

wf.add(bildExtrahieren)
  .to(logoSuchen).to(logoId).to(logoDownload).to(logoConvert).to(bundle)
  .to(logoResize).to(logoComposite).to(preisIf
    .onTrue(preisBadge.to(finalExtract))
    .onFalse(finalExtract));

wf.add(finalExtract).to(imgbbUpload).to(genAntwort).to(respondApi);

export default wf;
