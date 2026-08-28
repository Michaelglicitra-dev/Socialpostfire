# Pizzarello Social-Automation — Übergabe an neue Claude-Code-Session

> **Stand: 23.08.2026** · Dieses Dokument ersetzt `Pizzarello_status.md` (beschreibt eine ältere Architektur mit anderen Workflow-IDs — nur noch für historische Lektionen relevant).
> Voraussetzung für die Weiterarbeit: **n8n-MCP-Server** muss in der Environment verfügbar sein.

---

## 1. Was das Produkt ist

Modulare, klonbare **Social-Media-Automatisierung für Restaurants**, aktuell instanziiert für die **Pizzeria Pizzarello** (Oberhausen, https://www.pizzarello.net).

**Zielbild:** Der Gastronom bekommt täglich automatisch einen fertigen Social-Media-Post (Text + gebrandetes Bild) vorgeschlagen, gibt ihn mit einem Tipp frei, und der Post geht terminiert raus. Zusätzlich kann er jederzeit selbst einen Post anstoßen — per Chat-Beschreibung oder eigenem Foto.

**Grundsatzentscheidungen (gesetzt, nicht neu diskutieren):**
- Kommunikation mit dem Gastronomen: **komplett Deutsch**
- Einzige KI: **OpenAI** — `gpt-5-mini` für Text, `gpt-image-1` für Bilder
- Bild-Guideline **v2**: modern/editorial/premium, cleaner Studio-Look, viel Negativraum — *nicht* rustikale Trattoria-Optik
- Preis-Badge und Logo werden **real aufkomponiert** (n8n editImage), **nie** von der KI ins Bild gemalt — keine erfundenen Logos/Zahlen
- Freigabe erfolgt **immer in der Web-App** (nicht in Telegram)

---

## 2. Zugänge, IDs, Endpunkte

**n8n-Instanz:** `https://n8n.srv964622.hstgr.cloud` (self-hosted)

### Workflows (beide aktiv/published)
| Workflow | ID | Nodes | Zweck |
|---|---|---|---|
| **Pizzarello** (Hauptflow) | `tzRlOxsLZ8eyCdgT` | 68 | Täglicher Auto-Post + Telegram-Eingang + Freigabe-Warteschleife |
| **Pizzarello Web-App** | `pNFLlk3GPQO3lcjS` | 71 | Chat-UI (PWA) + JSON-API + Engine für manuelle Posts |

### Web-App-Endpunkte (Workflow B)
| Methode | Pfad | Zweck |
|---|---|---|
| GET | `/webhook/pizzarello-app` | Single-Page Chat-UI (HTML inline) |
| GET | `/webhook/pizzarello-sw` | Service Worker (Web Push) |
| GET | `/webhook/pizzarello-manifest` | PWA-Manifest |
| POST | `/webhook/pizzarello-api` | JSON-API (alle Aktionen) |

### Data Tables
| Tabelle | ID |
|---|---|
| `pizzarello_pending` | `W42oYny5sSWn2BAN` |
| `pizzarello_push_subs` | `o7HPXEM4bQI8M0mR` |
| `pizzarello_learnings` | `DfXfRBdmdGA5AwFs` |
| `pizzarello_angebote` | `dVJNivQbpA7YUwAm` |
| `pizzarello_speisekarte` | `8LOssi3MEAxKEXMd` |
| `pizzarello_fotos` | `x7QjV9d9CI0ZgrBz` |
| `pizzarello_post_log` | `HAaLrktmGAA8IddT` |

### Credentials (Namen in n8n)
`OpenAI Pizzarello` · `imgbb` · `Buffer` · `OneDrive Pizzarello` · `Telegram Pizzarello Bot`

### Geheimnisse (bewusst NICHT in diesem Repo)
- **Zugangscode der Web-App:** hartkodiert im Code-Node `Eingang` (Workflow B), Variable `cfg.access_token`.
  ⚠️ In `workflows/webapp.ts` steht dort der Platzhalter `<<<ZUGANGSCODE_AUS_N8N_EINSETZEN>>>`.
  **Vor jedem Deploy** den echten Wert aus n8n einsetzen — sonst sperrt sich der Gastronom aus.
- **VAPID-Privatschlüssel:** im Code-Node `Web-Push senden` (Workflow A); öffentlicher Schlüssel steht als `VAPID_PUBLIC` in `workflows/webapp.ts`
- Beides bei Bedarf direkt aus n8n auslesen.

---

## 3. Quellcode — wo er liegt

Beide Workflows werden **nicht** im n8n-UI gepflegt, sondern als **n8n Workflow SDK (TypeScript)** geschrieben und per MCP deployt.

```
workflows/hauptflow.ts   → Workflow tzRlOxsLZ8eyCdgT  (~1.200 Zeilen)
workflows/webapp.ts      → Workflow pNFLlk3GPQO3lcjS  (~1.100 Zeilen)
```

> ⚠️ **Nachtrag 28.08.2026:** Der heute aktive Workflow ist **`Pizzarello Bot` (`B7LuGXIaNnPC5ulk`)**,
> nicht mehr Hauptflow/Web-App. Seine Quelle liegt seit jetzt als `workflows/bot.ts` im Repo, die
> Bildgenerierungs-Nodes zusaetzlich einzeln unter `workflows/bot_bildgenerierung/`.
> `update_workflow` wirft weiterhin die Credentials aller HTTP-Nodes ab (erneut per Test bestätigt) und
> überträgt `maxTries`/`waitBetweenTries` nicht — Workflow-Settings (errorWorkflow, binaryMode) lassen
> sich dagegen über das dritte Argument von `workflow()` mitgeben und bleiben erhalten.

> ⚠️ Diese Dateien sind die **einzige** vollständige Quelle. `get_workflow_details` liefert nur Node-JSON, keinen SDK-Code. Vor jeder Änderung: Datei bearbeiten → `validate_workflow` → `update_workflow` → `publish_workflow`.

**Deploy-Zyklus:**
```
Datei editieren → mcp__n8n__validate_workflow (optional, update validiert auch)
                → mcp__n8n__update_workflow (workflowId + vollständiger Code)
                → mcp__n8n__publish_workflow (SONST läuft weiter die alte Version!)
                → Credentials nachziehen (siehe KRITISCH-1)
```

---

## 4. Architektur Hauptflow (`tzRlOxsLZ8eyCdgT`)

### 4.1 Eingänge
- **`Taeglich 09:30`** — Schedule-Trigger, Säulen-Rotation (angebote/saisonal/community) → `Schedule-Kontext`
- **`Telegram Eingang`** — Telegram-Trigger für spontane Eingaben → `Hat Foto?`
  - mit Foto: `Eingangsfoto lesen` → `imgbb Eingangsfoto` → `TG-Kontext (Foto)`
  - nur Text: `TG-Kontext (Text)`

### 4.2 Kontext & Content-Erzeugung
```
Restaurant-Konfiguration   (Code-Node: Marke, Farben, bild_guideline v2, layouts,
                            hashtags, posting_zeit 17:00, buffer-Config)
        ↓
Website laden → Feiertage laden → Kontext
        ↓
Post-Agent  (@n8n/n8n-nodes-langchain.agent v3.1)
   ├─ model:  OpenAI gpt-5-mini
   ├─ memory: Gespraechs-Memory (customKey, 12 Nachrichten)
   ├─ tools:  get_learnings, get_aktuelle_angebote,
   │          get_speisekarte, get_bildarchiv   (alle dataTableTool)
   └─ parser: Post-Schema (structured output)
        ↓
Rueckfrage noetig? ──true──→ Rueckfrage senden → Antwort einarbeiten (Schleife)
        ↓ false
Post aufbereiten  (Validierung, Preis-Normalisierung EUR→€, Hashtag-Merge,
                   Layout-Whitelist, bild_headline-Fallback)
```

**Agent-Output-Schema:** `needs_clarification`, `clarification_question`, `headline`, `post_text`, `hashtags[]`, `layout` (klassik|menue_karte|angebots_sticker|event_poster|pur|zitat), `bild_typ` (produkt|event|angebot|saison|flyer|bts), `bild_neu`, `bild_headline`, `image_brief`, `preis_text`, `archiv_foto_url`

### 4.3 Bild-Pipeline
```
Bild-Modus  (entscheidet: generate | edit_url | edit_prev)
   ├─ generate  → Gen-Request → GPT Bild (gen)      [images/generations]
   └─ edit      → Basisfoto laden → Kombi-Request → GPT Bild (edits)
        ↓
Bild extrahieren (b64)
        ↓
LOGO-OVERLAY:  Logo suchen (OneDrive) → Logo-ID waehlen → Logo herunterladen
             → Logo konvertieren → Bild und Logo buendeln
             → Logo skalieren (155×155) → Logo einfuegen (composite @ 850,30)
        ↓
Preis-Badge?  ──true──→ Preis-Badge stempeln  (editImage multiStep:
                         2 Kreise + "nur" + Preistext, unten rechts)
        ↓
Finalbild extrahieren → imgbb hochladen
```

### 4.4 Freigabe-Mechanik (Kernstück, Phase 3)
```
Telegram-Daten bauen
        ↓
Freigabe parken - Daten   (baut post_id, image_url, headline, post_text,
                           hashtags, saeule, datum)
        ↓
Entwurf parken            (dataTable INSERT in pizzarello_pending,
                           status='OFFEN', resume_url = {{ $execution.resumeUrl }})
        ↓                  ⚠ resumeUrl MUSS vor dem Wait-Node gelesen werden
Push-Abos laden → Web-Push senden   (VAPID/ECDSA via crypto.subtle, best-effort)
        ↓
Telegram-Hinweis senden   (sendMessage + Inline-Button "In der App freigeben"
                           → Link zur Web-App; KEIN Bild, KEIN Volltext)
        ↓
Auf Web-Freigabe warten   (Wait-Node, resume:'webhook', POST, limitWaitTime 47h)
        ↓
Freigabe-Entscheidung     (liest $json.body → decision/reason;
                           unbekannt = discard)
        ↓
Pending aktualisieren     (dataTable UPDATE status per post_id)
        ↓
Freigegeben? ──true──→ Buffer-Request bauen → Buffer Post planen
        │               → Log-Zeile geplant → Log schreiben
        └─false→ Verworfen? ──true──→ Log verworfen
                            └─false→ (= Ablehnung mit Grund)
                                     Grund auswerten → Bewertungs-Anfrage
                                     → Learning bewerten → Learning parsen
                                     → Dauerhaft? → Learning speichern
                                     → Neu-Anlauf bauen → zurück zum Post-Agent
```

**Der Clou:** Ein einziger Wait-Node. Sowohl der Telegram-Button (iOS) als auch die Push-Nachricht (Android) führen in die Web-App; die Web-App POSTet die Entscheidung an `resume_url` und setzt den Hauptflow fort.

---

## 5. Architektur Web-App (`pNFLlk3GPQO3lcjS`)

### 5.1 Auslieferung
`Web-UI (GET)` → `UI ausliefern` (komplettes HTML als String-Konstante `HTML_PAGE`, mit `Cache-Control: no-store`)
`Service Worker (GET)` → `SW ausliefern` · `Manifest (GET)` → `Manifest ausliefern`

### 5.2 API-Dispatch (Kette aus IF-Nodes)
```
Web-API (POST) → Eingang  (parst: action, brief, comment, session, token_ok,
                           draft, image_b64, sub_*, decision, reason,
                           resume_url, post_id, + _diag)
      ↓
Token ok? ──false──→ Antwort: Zugang  (aktuell MIT [DIAG …]-Text!)
      ↓ true
Aktion push_subscribe? ──true──→ Push-Abo speichern → Antwort: Push aktiv
      ↓
Aktion list_pending?   ──true──→ Offene Entwuerfe laden → Antwort: Offene Liste
      ↓
Aktion decide?         ──true──→ Entscheidung bauen → Link gueltig?
      │                          → Hauptflow fortsetzen (POST an resume_url)
      │                          → Antwort: Entscheidung
      ↓
Aktion approve?        ──true──→ Konfiguration Freigabe → Buffer-Request bauen
      │                          → Buffer senden? → Buffer Post planen
      │                          → Antwort: Freigegeben
      ↓
Aktion discard?        ──true──→ Antwort: Verworfen
      ↓ (sonst = generate / regenerate)
Eigenes Foto? ──true──→ Eingangsfoto hochladen (imgbb) → Foto-Upload pruefen
      │                 → Foto-Upload ok? ──false──→ Antwort: Foto-Fehler
      └─false→ Ohne Foto
      ↓ (beide münden in)
Restaurant-Konfiguration → Kontext → Post-Agent → …
   (ab hier identische Engine wie Hauptflow: Post aufbereiten → Bild-Modus →
    gen/edit → Logo → Preis-Badge → imgbb → Antwort: Entwurf)
      ↓
API-Antwort (respondToWebhook, JSON)
```

### 5.3 Client-Funktionen (im HTML)
- **Gate:** Zugangscode → `localStorage`
- **Chat:** `send()` / `renderDraft()` mit Buttons Freigeben / Neu generieren / Verwerfen
- **Foto-Upload:** 📷-Button → `FileReader` → `compressToLimit()` (Canvas-Downscale, aktuell bis 1280 px @ q 0.85, Abbruchgrenze 750 KB) → base64 → `image_b64` im Payload
- **Freigabe-Posteingang:** `loadPending()` beim Login → `renderPending()` → `decidePending()` POSTet an `resume_url`
- **Web Push:** `enablePush()` — Permission → SW registrieren → `pushManager.subscribe` → Abo an API

---

## 6. Was funktioniert / was ungetestet ist

| Bereich | Status |
|---|---|
| Täglicher Auto-Post inkl. Bild, Logo, Preis-Badge | ✅ vom Nutzer bestätigt |
| Telegram-Hinweis mit Button → Web-App | ✅ bestätigt |
| Freigabe in der Web-App → Buffer | ✅ bestätigt |
| Web-App Chat (Text-Post erzeugen) | ✅ läuft |
| **Foto-Upload über Web-App** | ⚠️ **gebaut, aber nie erfolgreich durchgelaufen** (Ursache: fehlende Credentials, siehe KRITISCH-1) |
| **Web Push (Android)** | ⚠️ **nie live getestet** — VAPID-Signierung via `crypto.subtle` in einem Code-Node ist unbestätigt |
| Web Push (iOS) | ❌ **unmöglich** — iOS verweigert auf den Geräten des Nutzers auf OS-Ebene (`default→denied` ohne Dialog), auch als installierte PWA. Bewiesen, nicht fixbar. Deshalb der Telegram-Umweg. |
| Learning-Schleife (Ablehnung → Regel) | ⚠️ gebaut, nicht end-to-end verifiziert |

---

## 7. Fallstricke des n8n-MCP/SDK (bitter erkauft)

1. **`update_workflow` wirft ALLE Credentials ab.** Bestätigt per Audit: nach jedem Deploy sind `httpRequest`-, `lmChatOpenAi`- und `microsoftOneDrive`-Nodes ohne Credential. Das ist DIE Hauptfehlerquelle. → siehe KRITISCH-1
2. **`update_workflow` ersetzt den kompletten Workflow** — immer den vollständigen Code senden, nie Fragmente.
3. **Draft ≠ Active.** Ohne `publish_workflow` läuft die Produktion weiter auf der alten Version.
4. **Nicht-ASCII im `jsCode` wird zerstört.** Deshalb ist der gesamte deutsche Text im Code ASCII-only geschrieben (`waehle`, `fuer`, `Aenderung`). Beibehalten!
5. **Die SDK-Sandbox kennt `encodeURIComponent` nicht** — solche Werte vorab als Literal berechnen (siehe `ICON`-Konstante).
6. **`$execution.resumeUrl` muss VOR dem Wait-Node** referenziert werden.
7. **Beschreibung max. 255 Zeichen** bei `update_workflow`.
8. `editImage`-Farben nur als **6-stelliges Hex**.
9. Resume-Payload kommt als **`$json.body`** an (mit Fallback auf `$json`).

---

## 8. KRITISCHE ÄNDERUNGEN — ausdetailliert

### 🔴 KRITISCH 1 — Credential-Verlust bei jedem Deploy

**Problem.** `update_workflow` löscht die Credential-Zuordnung an allen externen Nodes. Wirkung: Der Flow bricht **still** ab — der Webhook antwortet `200` mit leerem Body nach ~2 s, die App zeigt "kein JSON". Genau das hat den Foto-Upload über mehrere Iterationen blockiert; es war nie ein Code-Fehler.

**Betroffene Nodes (nach jedem Deploy prüfen):**

| Workflow | Node | Credential |
|---|---|---|
| Web-App | `OpenAI gpt-5-mini` | OpenAI Pizzarello |
| Web-App | `GPT Bild (gen)` | OpenAI Pizzarello |
| Web-App | `GPT Bild (edits)` | OpenAI Pizzarello |
| Web-App | `Eingangsfoto hochladen` | imgbb |
| Web-App | `imgbb hochladen` | imgbb |
| Web-App | `Logo suchen` | OneDrive Pizzarello |
| Web-App | `Logo herunterladen` | OneDrive Pizzarello |
| Web-App | `Buffer Post planen` | Buffer |
| Hauptflow | analog + `Telegram-Hinweis senden` (→ **Telegram Pizzarello Bot**, wurde einmal fälschlich "Telegram AiColorMe" zugewiesen!) | |
| — | `Basisfoto laden`, `Hauptflow fortsetzen` | **keine** (korrekt leer) |

**Umsetzung (dreistufig):**

*a) Sofort-Werkzeug — Credential-Audit nach jedem Deploy.* Nicht raten, sondern messen:
```python
# get_workflow_details → Ausgabe wird in Datei gespeichert; dann:
import json
d = json.load(open('<pfad-zur-ausgabe>'))
for n in d['workflow']['nodes']:
    t = n['type']
    if any(k in t for k in ('httpRequest','lmChatOpenAi','microsoftOneDrive','telegram')):
        print(('SET ' if n.get('credentials') else 'FEHLT'), n['name'])
```

*b) Deploy-Disziplin.* Änderungen **bündeln**, nicht einzeln deployen. Jeder Deploy = garantierter Credential-Reset = Ausfallrisiko. Vor jedem Deploy dem Nutzer ansagen: "Danach müssen die Credentials neu gesetzt werden."

*c) Dauerhafter Fix — Health-Check-Workflow.* Eigener kleiner Workflow, der täglich (z. B. 09:00, also **vor** dem 09:30-Post) je einen Minimal-Request gegen OpenAI, imgbb, OneDrive und Buffer absetzt und bei Fehler eine Telegram-Nachricht an den Betreiber schickt. Damit wird ein Credential-Verlust innerhalb von 24 h sichtbar, statt erst wenn der Gastronom sich wundert.

---

### 🔴 KRITISCH 2 — Stille Fehler ohne Rückkanal

**Problem.** Wirft irgendein Node eine Exception, endet der Webhook mit leerem `200`; beim Schedule-Lauf passiert schlicht **gar nichts**. Weder Gastronom noch Betreiber erfahren davon. Für ein Produkt mit dem Versprechen "läuft automatisch" ist das der größte Vertrauensbruch.

**Umsetzung:**

*a) n8n Error-Workflow (nativ, größter Hebel).* Neuen Workflow `Pizzarello Fehler-Melder` bauen: `errorTrigger` → Telegram-Nachricht an den Betreiber mit Workflow-Name, Node-Name, Fehlertext, Execution-Link. Dann in den **Settings beider Hauptworkflows** als `errorWorkflow` eintragen. Ab dann meldet sich jeder Absturz von selbst.

*b) Web-App: nie mit leerem Body enden.* Die riskanten HTTP-Nodes auf `neverError` + expliziten Prüf-Node setzen (für `Eingangsfoto hochladen` bereits umgesetzt: `Foto-Upload pruefen` → `Foto-Upload ok?` → `Antwort: Foto-Fehler`). Dasselbe Muster fehlt noch bei `GPT Bild (gen)`, `GPT Bild (edits)`, `Logo suchen`, `imgbb hochladen`.

*c) Heartbeat für den Auto-Post.* Ein Workflow, der z. B. um 11:00 prüft, ob heute eine Zeile in `pizzarello_pending` entstanden ist. Wenn nicht → Alarm an den Betreiber.

*d) Nutzerseitige Fehlertexte entschärfen.* Aktuell leaken Diagnose-Interna in die UI:
- `Antwort: Zugang` → `[DIAG v7 clen=… keys=… tlen=…]`
- `Antwort: Foto-Fehler` → `[imgbb: <roher JSON-Dump>]`
- Client `api()` → `Server-Antwort 200 nach 2s (kein JSON): …`

Diese müssen vor dem echten Rollout auf klare Laien-Sätze reduziert werden ("Der Zugangscode stimmt nicht." / "Dein Foto konnte nicht verarbeitet werden. Bitte versuch es erneut."). Die technische Detailtiefe gehört in den Error-Melder an den **Betreiber**, nicht in die Gastronomen-UI.

---

### 🔴 KRITISCH 3 — Zwei getrennte Benachrichtigungswege (iOS vs. Android)

**Problem.** iOS bekommt Telegram, Android bekommt Web Push. Zwei Journeys, zwei Fehlerquellen, doppelte Wartung — und der Android-Pfad (`Web-Push senden`, VAPID-Signatur mit `crypto.subtle` im Code-Node) ist **nie live getestet**. Für ein klonbares Produkt vervielfacht sich dieser Bruch mit jedem neuen Kunden.

**Empfehlung: auf Telegram als einzigen Kanal konsolidieren.**

Begründung: Telegram funktioniert nachweislich auf beiden Plattformen, der Button führt zuverlässig in die Web-App, die Freigabe ist ohnehin schon einheitlich in der App. Web Push bringt gegenüber Telegram keinen Mehrwert, kostet aber: Service Worker, Manifest, VAPID-Schlüsselverwaltung, `pizzarello_push_subs`-Tabelle, ungetestete Krypto und einen Opt-in-Dialog, der auf iOS grundsätzlich scheitert.

**Konkrete Schritte:**
1. Hauptflow: `Push-Abos laden` + `Web-Push senden` aus der Kette nehmen (Nodes entfernen; `Entwurf parken` → direkt `Telegram-Hinweis senden`).
2. Web-App: Glocken-Button, `enablePush()`, `urlB64ToUint8()`, `maybeIosHint()` und den `Aktion push_subscribe?`-Zweig entfernen.
3. Service Worker + Manifest **behalten** — die PWA-Installation ("Zum Home-Bildschirm") bleibt wertvoll für den App-Charakter, auch ohne Push.
4. `pizzarello_push_subs` kann bestehen bleiben (leer), falls Push später doch kommt.

**Gewinn:** ~10 Nodes weniger, eine Journey statt zwei, keine ungetestete Krypto im kritischen Pfad, und der verwirrende "Erinnerungen einschalten"-Button verschwindet aus der UI.

> *Falls der Nutzer Web Push behalten will:* dann muss `Web-Push senden` **zwingend** einmal live gegen ein Android-Gerät verifiziert werden, bevor man sich darauf verlässt.

---

### 🔴 KRITISCH 4 — Native Browser-Dialoge brechen die App-Illusion

**Problem.** Im Freigabe-Posteingang laufen echte System-Popups:
- `window.prompt('Was soll an dem Post anders oder besser sein? (optional)')` — Ablehnungsgrund
- `window.confirm('Diesen Post wirklich verwerfen?')` — Verwerfen-Bestätigung
- `window.alert(...)` in `say()` — Push-Meldungen

Auf dem iPhone wirken diese grauen Kästen wie ein Fehler oder eine Phishing-Meldung, mitten in einem sonst durchgestylten Interface. Zusätzlich ist `prompt()` in installierten PWAs teils unzuverlässig.

**Umsetzung.** Ein wiederverwendbares In-App-Sheet im Markendesign, das die drei Fälle abdeckt:

```
<div id="sheet" class="hidden">          <!-- Overlay, position:fixed, dunkler Backdrop -->
  <div class="sheet-card">                <!-- weiß, border-radius 16px, slide-up -->
    <div id="sheetTitle"></div>
    <textarea id="sheetInput"></textarea>  <!-- nur bei Grund-Abfrage sichtbar -->
    <div class="sheet-actions">
      <button class="btn ghost">Abbrechen</button>
      <button class="btn primary">Bestätigen</button>
    </div>
  </div>
</div>
```
API im Client: `openSheet({ title, withInput, confirmLabel, onConfirm })`.
Ersetzt: `prompt` → Sheet mit Textarea · `confirm` → Sheet ohne Input, roter Bestätigen-Button · `alert` → dezenter Toast (auto-ausblendend).

Da das gesamte HTML als String-Konstante `HTML_PAGE` in `webapp.ts` liegt, ist das eine reine Frontend-Änderung ohne Node-Umbau — **ein** Deploy.

---

## 9. Weitere Findings (nicht kritisch, aber wertsteigernd)

**Reihenfolge nach Aufwand/Nutzen:**

1. **Posting-Zeit vor der Freigabe anzeigen** — aktuell erfährt der Gastronom erst *nach* dem Tippen, wann der Post läuft. Bei Tagesangeboten heikel. (klein)
2. **Undo nach Freigabe** — 60 s Grace-Period mit "Rückgängig"-Toast, bevor der Buffer-Call rausgeht. (mittel)
3. **Fortschrittsanzeige statt tanzender Punkte** — die Kette Agent→Bild→Logo→Badge→Upload dauert 30–90 s; ohne Feedback wirkt das wie ein Hänger und provoziert Doppel-Sends. Stufentext ("Text wird geschrieben…", "Bild entsteht…", "Logo wird gesetzt…"). (klein–mittel)
4. **Schnellaktions-Chips statt reinem Freitext** — "Nur Text ändern" / "Neues Motiv" / "Anderer Preis" setzen `bild_neu` deterministisch, statt es der KI-Interpretation zu überlassen. (mittel)
5. **Post-Historie in der App** — `pizzarello_post_log` existiert bereits, wird aber nirgends angezeigt. (mittel)
6. **Learnings sichtbar & löschbar machen** — die KI merkt sich Regeln aus Ablehnungen; niemand kann sie einsehen oder zurücknehmen. Für Vertrauen in ein lernendes System Pflicht. (mittel)
7. **Config aus dem Code in eine Data Table** — Markenfarben, Ton, Hashtags, Adresse, Bild-Guideline stecken als großes Objekt im Node `Restaurant-Konfiguration`, **doppelt** (Hauptflow + Web-App!). Für "klonbar für andere Restaurants" ist das der größte strukturelle Hebel: eine `restaurant_config`-Tabelle macht neue Kunden ohne Code-Eingriff onboardbar — und beseitigt die Duplikation, die aktuell garantiert irgendwann auseinanderläuft. (groß, aber strategisch am wichtigsten)
8. **Echtes Login statt statischem Code** — aktuell ein hartkodiertes Passwort ohne Rate-Limiting/Reset. (mittel)
9. **Foto-Vorschau größer + Zuschnitt** — 44 px Thumbnail reicht nicht, um das richtige von mehreren ähnlichen Gerichtsfotos zu erkennen. (klein)
10. **Kanal-/Plattformwahl sichtbar machen** — alles läuft fest auf `nur_demo: true` mit einem Demo-Kanal; Instagram/Facebook/Pinterest sind vorbereitet, aber nicht wählbar. (mittel)
11. **Telegram-Eingang im Hauptflow** — existiert weiterhin (`Telegram Eingang`, `Hat Foto?`, `imgbb Eingangsfoto`). Der Nutzer will Fotos künftig über die Web-App einreichen ("Nicht mehr Telegram"). Klären, ob der Telegram-Eingang **abgeschaltet** werden soll oder als Zweitweg bleibt. (Entscheidung nötig)

---

## 10. Empfohlener Einstieg für die nächste Session

```
SCHRITT -1 Zugangscode in workflows/webapp.ts einsetzen (Platzhalter, siehe Abschnitt 2)
           — NUR lokal, nicht zurück ins Repo committen.

SCHRITT 0  Credentials in BEIDEN Workflows setzen und Foto-Upload verifizieren.
           → Erst wenn das grün ist, weiß man, ob der Foto-Code korrekt ist.
              (Er wurde nie erfolgreich ausgeführt.)

SCHRITT 1  Error-Melder-Workflow + errorWorkflow in beiden Flows eintragen.
           → Ab hier sieht man Fehler, statt sie zu erraten.

SCHRITT 2  EIN gebündelter Deploy mit:
             - Diagnose-Texte raus (DIAG/imgbb-Dump/Server-Antwort-Roh)
             - In-App-Sheet statt prompt/confirm/alert
             - Web Push entfernen (falls Konsolidierung auf Telegram gewünscht)
             - Posting-Zeit in der Freigabe-Antwort anzeigen
           → danach Credentials EINMAL neu setzen.

SCHRITT 3  Health-Check + Heartbeat.

SCHRITT 4  Config in Data Table auslagern (Vorbereitung Mandantenfähigkeit).
```

> **Vor dem ersten Deploy unbedingt** `mcp__n8n__get_sdk_reference` lesen und die Fallstricke aus Abschnitt 7 verinnerlichen — besonders ASCII-only im `jsCode` und der Credential-Reset.
