# Bau-Auftrag: Pizzarello Telegram-Bot (Neuaufbau, ereignisgesteuert)

> **Verwendung:** Diesen Text als Einstiegs-Prompt in eine frische Claude-Code-Session geben.
> Voraussetzung: n8n-MCP-Server verfügbar. Repo enthält `Pizzarello_Handover.md` (Architektur des
> Altstands) und `workflows/hauptflow.ts` + `workflows/webapp.ts` (SDK-Quellcode zum Ausschlachten).

---

## Auftrag

Baue die Restaurant-Social-Automation für **Pizzeria Pizzarello** als **einen einzigen, rein
Telegram-basierten Workflow** neu auf. Die bisherige Zweiteilung (n8n-Web-App + Telegram als
Benachrichtigungskanal) wird aufgegeben.

Der Gastronom soll in Telegram:
1. **frei mit dem KI-Agenten chatten** — der Agent stellt Rückfragen als normale Nachrichten,
   der Nutzer antwortet mit normalen Nachrichten,
2. **Entscheidungen per Inline-Buttons** treffen (Freigeben / Andere Variante / Verwerfen),
3. **Fotos direkt in Telegram** schicken, die als Bildgrundlage dienen,
4. **täglich automatisch** einen fertigen Post-Vorschlag bekommen.

---

## 🔑 Die zentrale Architektur-Entscheidung (bitte genau lesen)

Der Altbau nutzt `sendAndWait` (Telegram) und einen `Wait`-Node mit Resume-Webhook. Beides ist
**verboten** im Neubau:

| Verboten | Warum |
|---|---|
| `sendAndWait` (Telegram, `responseType: freeText`) | Erzeugt ein **n8n-gehostetes Formular**, kein Chat. Genau das, was der Nutzer nicht will. |
| `Wait`-Node mit Resume-Webhook für die Freigabe | Blockiert eine Execution über Stunden, überlebt Neustarts schlecht, und Freitext-Antworten kommen dort gar nicht an. |

**Stattdessen: ereignisgesteuerter Zustandsautomat.**

Jede eingehende Telegram-Nachricht und jeder Button-Tap startet eine **eigene, kurze Execution**.
Der Gesprächszustand liegt **nicht** in einer laufenden Execution, sondern in einer Data Table.
Der Agent erinnert sich über den `memoryBufferWindow`-Node, der auf die `chat_id` gekeyt ist.

```
Nachricht/Button  →  Execution startet  →  Zustand laden  →  handeln  →  antworten
                  →  Zustand speichern  →  Execution ENDET
```

Das ist der ganze Trick. Dadurch entsteht ein echter Chat, der beliebig lange pausieren kann,
n8n-Neustarts überlebt und in dem Buttons und Freitext gleichberechtigt funktionieren.

---

## Zielverhalten (konkrete Dialoge, an denen du dich messen lassen musst)

**A) Freier Auftrag mit Rückfrage**
```
Nutzer:  Mach mal was für nächsten Freitag
Bot:     Klar! Geht's um ein Angebot, ein Event oder einfach ein Gericht,
         das du zeigen willst?                                   ← normale Nachricht
Nutzer:  Ein Event, wir haben Live-Musik ab 19 Uhr
Bot:     [Foto] Live-Musik am Freitag
         Bei uns klingt der Freitag... 
         #pizzarello #oberhausen
         [✅ Freigeben] [🔄 Andere Variante] [🗑 Verwerfen]
```

**B) Änderungswunsch als Freitext, während ein Entwurf offen ist**
```
Nutzer:  Der Titel ist zu lang
Bot:     [Foto mit neuem Titel] + Buttons
```
→ Der Nutzer muss **nicht** auf einen Button tippen, um etwas zu ändern. Freitext bei offenem
Entwurf = Änderungswunsch.

**C) Foto-Eingang**
```
Nutzer:  [Foto] Neue Pizza mit Pistazie
Bot:     [veredeltes Foto + Text] + Buttons
```

**D) Automatischer Tagespost**
```
09:30    Bot: [Foto] ... + Buttons        (unaufgefordert)
14:12    Nutzer tippt [✅ Freigeben]
Bot:     Freigegeben — geht heute um 17:00 Uhr raus.
```
→ Zwischen Vorschlag und Entscheidung dürfen Stunden liegen, **ohne** laufende Execution.

---

## Zustandsautomat

Data Table **`pizzarello_sessions`** (neu anlegen), Schlüssel `chat_id`:

| Spalte | Typ | Zweck |
|---|---|---|
| `chat_id` | string | Telegram-Chat des Gastronomen |
| `state` | string | `IDLE` \| `AWAITING_ANSWER` \| `DRAFT_OPEN` \| `BUSY` |
| `post_id` | string | ID des aktuellen Entwurfs |
| `draft_json` | string | kompletter Entwurf (headline, post_text, hashtags, layout, bild_typ, image_url, preis_text) |
| `photo_url` | string | zuletzt hochgeladenes Eingangsfoto (imgbb-URL) |
| `last_message_id` | string | Telegram-message_id des Entwurfs — zum Entfernen der Buttons |
| `updated` | string | ISO-Zeitstempel |

**Routing-Logik** (im Node `Router`, direkt nach dem Zustand-Laden):

| Eingang | Zustand | Aktion |
|---|---|---|
| Button-Tap (`callback_query`) | beliebig | Entscheidung ausführen |
| Text | `IDLE` | neuer Auftrag → Agent |
| Text | `AWAITING_ANSWER` | Antwort auf Rückfrage → Agent (Memory hat Kontext) |
| Text | `DRAFT_OPEN` | Änderungswunsch → Agent mit `regenerate`-Semantik |
| Foto | beliebig | Foto speichern → Agent mit Foto als Bildgrundlage |
| irgendwas | `BUSY` | freundlich abwimmeln („Bin noch am Bauen, einen Moment…") |

`BUSY` ist der Schutz gegen Doppel-Auslösung, während eine 60-Sekunden-Bildgenerierung läuft.
**Wichtig:** `BUSY` immer auch im Fehlerfall zurücksetzen, sonst hängt der Chat dauerhaft fest.

---

## Bauplan

### Workflow: `Pizzarello Bot` (neu anlegen, NICHT den Altflow überschreiben)

**Zwei Trigger, die in dieselbe Kette münden:**

1. `Telegram Trigger` — updates: **`message` UND `callback_query`** (beides aktivieren!)
2. `Schedule Trigger` — täglich 09:30, Säulen-Rotation angebote/saisonal/community

**Kette:**
```
Trigger
  → Update normalisieren        (Code: chat_id, typ, text, foto-file_id,
                                 callback_data, callback_query_id, message_id)
  → Session laden               (dataTable get, alwaysOutputData)
  → Router                      (Code: entscheidet Zweig laut Tabelle oben)
       │
       ├─ CALLBACK ─→ Callback bestaetigen (answerCallbackQuery, MUSS < 10 s)
       │              → Buttons entfernen  (editMessageReplyMarkup)
       │              → Freigeben? ─→ Buffer planen → Log → Bestaetigung senden
       │                 Verwerfen? ─→ Log → Bestaetigung senden
       │                 Variante?  ─→ weiter zum Agenten (regenerate)
       │
       ├─ FOTO ─────→ Foto herunterladen → imgbb → photo_url speichern → Agent
       │
       └─ TEXT ─────→ Agent
                        │
       ┌────────────────┘
       ▼
  Status BUSY setzen  +  sendChatAction('typing')
       ↓
  Post-Agent  (gpt-5-mini, memory keyed auf chat_id, 4 dataTable-Tools, Output-Parser)
       ↓
  Rueckfrage?  ──ja──→ Frage als NORMALE Nachricht senden
       │                → state = AWAITING_ANSWER → ENDE
       │                  (KEIN sendAndWait, KEIN Wait-Node!)
       ↓ nein
  Post aufbereiten → Bild-Pipeline (siehe unten) → sendPhoto + Inline-Buttons
       ↓
  state = DRAFT_OPEN, draft_json + last_message_id speichern → ENDE
```

### Bild-Pipeline — **mit EINER wesentlichen Änderung gegenüber dem Altstand**

```
Bild-Modus (generate | edit_url | edit_prev)
  → Logo laden  (OneDrive, responseFormat: file, outputPropertyName: 'logo')
  → Bild-Request bauen  (führt Binaries zusammen: Basisfoto + logo)
  → GPT Bild  (/v1/images/edits, multipart, MEHRERE image[]-Felder)
  → Bild extrahieren
  → Preis-Badge? → Preis-Badge stempeln (editImage multiStep)   ← BLEIBT
  → Finalbild extrahieren → imgbb hochladen
```

Ebenfalls übernehmen: `Restaurant-Konfiguration` (Marke, Farben, **bild_guideline v2**, layouts,
hashtags), `Post-Schema` (Output-Parser), die vier dataTable-Tools, die Learning-Schleife.

#### 🔄 ÄNDERUNG: Logo NICHT mehr nachträglich aufkleben

**Problem im Altstand:** Das Logo wurde nach der Generierung per `editImage`-`composite`
aufgeklebt (`Logo skalieren` 155×155 → `Logo einfuegen` @ 850,30). Ergebnis wirkt aufgeklebt,
nie „wie aus einem Guss".

**Neu:** Das Logo wird als **zusätzliches Eingangsbild an die Bildgenerierung übergeben**, damit
das Modell es selbst stimmig ins Bild integriert (Perspektive, Licht, Materialität).

**Diese Nodes entfallen ersatzlos:**
`Logo suchen` · `Logo-ID waehlen` · `Logo herunterladen` · `Logo konvertieren` ·
`Bild und Logo buendeln` · `Logo skalieren` · `Logo einfuegen`

**Erprobtes Vorbild:** Workflow **`AIColor.Me Marketing Agent v8`** (ID `luWRBIdlesNnIMsz`),
Nodes `Logo laden` → `Social-Prompt bauen` → `GPT-Image Social-Bild`. Dort läuft das seit Monaten
stabil. **Vor dem Bauen dort reinschauen und das Muster exakt übernehmen.** Kern davon:

*1) Logo als Binary laden* — HTTP Request direkt auf die OneDrive-Content-URL:
```
url:  https://graph.microsoft.com/v1.0/me/drive/root:/Pizzarello/assets/pizzarello_transparent.png:/content
authentication: predefinedCredentialType,  nodeCredentialType: microsoftOneDriveOAuth2Api
options.response.response: { responseFormat: 'file', outputPropertyName: 'logo' }
```
→ Das Logo liegt danach als Binary-Property **`logo`** vor (kein Suchen/ID-Auflösen nötig).

*2) Binaries auf EINEM Item zusammenführen* (im Prompt-Builder-Code-Node):
```js
const logoBin = $('Logo laden').first().binary || {};
const binary = Object.assign({}, $input.first().binary);
if (logoBin.logo) binary.logo = logoBin.logo;
// binary.image0 = Basisfoto (Archiv-/Eingangsfoto), falls vorhanden
return [{ json: { prompt: prompt }, binary }];
```

*3) Mehrere Bilder an gpt-image-1 übergeben* — `/v1/images/edits`, `contentType: multipart-form-data`,
**mehrere `image[]`-Einträge**, jeweils `parameterType: 'formBinaryData'` mit **unterschiedlichem**
`inputDataFieldName`:
```
{ name:'model',  value:'gpt-image-1' }
{ name:'prompt', value:'={{ $json.prompt }}' }
{ name:'size',   value:'={{ $json.size }}' }
{ name:'quality',value:'high' }
{ parameterType:'formBinaryData', name:'image[]', inputDataFieldName:'image0' }   // Basisfoto
{ parameterType:'formBinaryData', name:'image[]', inputDataFieldName:'logo' }     // Logo
```
> Bei reiner Neugenerierung ohne Basisfoto: trotzdem `/v1/images/edits` mit **nur dem Logo** als
> `image[]` verwenden — nicht `/v1/images/generations`, denn dort kann kein Bild mitgegeben werden.

*4) Prompt muss die Beilagen ausdrücklich benennen* (das ist entscheidend, sonst ignoriert das
Modell sie). Nach dem Vorbild von AIColor.Me, angepasst auf Pizzarello:
```
ES SIND ZWEI BILDER BEIGEFUEGT: 1) das FOTO als Bildgrundlage, 2) das PIZZARELLO-LOGO.
- Das beigefuegte Foto treu uebernehmen (Gericht, Komposition, Personen nicht veraendern).
- Das beigefuegte Logo GENAU EINMAL, unveraendert in Form und Farbe, dezent und klein
  in eine ruhige Ecke integrieren (bevorzugt oben rechts) - als natuerlicher Teil der
  Aufnahme, nicht als aufgeklebtes Element.
- Erfinde KEIN eigenes Logo, keinen Schriftzug, kein Emblem.
```
Die bisherige Regel „Keep the TOP-RIGHT corner completely empty" muss dabei **entfallen** —
dort sitzt jetzt das Logo.

**Was bleibt wie bisher:** Der **Preis-Badge** wird weiterhin real per `editImage` gestempelt.
Preise müssen exakt stimmen; KI-gerenderte Zahlen sind unzuverlässig. Der Prompt muss die
untere rechte Ecke also weiterhin ruhig halten.

---

## 🆕 Mehrkanal-Ausspielung: Instagram + Facebook + TikTok

**Ziel:** Was der Gastronom **einmal** freigibt, geht in den **jeweils passenden Formaten** an alle
aktiven Kanäle bei Buffer. Facebook- und TikTok-Kanäle existieren **noch nicht** — der Flow muss
so gebaut sein, dass später **nur die Buffer-Kanal-ID eingetragen** werden muss, sonst nichts.

### Formatstrategie (bewusst sparsam, nicht dreimal generieren)

| Kanal | Zielformat | Wie erzeugt |
|---|---|---|
| **Instagram** | 1080×1350 (4:5) | **Master** — direkt generiert mit `size: 1024x1536` |
| **Facebook** | 1080×1350 (4:5) | **derselbe Master, unverändert** — Facebook zeigt 4:5 im Feed problemlos |
| **TikTok** | 1080×1920 (9:16) | Master → `editImage` auf 9:16-Leinwand (siehe unten) |

**Begründung:** Nur **ein** kostenpflichtiger Bild-Call pro Post. Instagram und Facebook teilen
sich denselben Master; nur TikTok braucht echtes Hochformat.

> ⚠️ **Technische Einschränkung:** `gpt-image-1` kann **kein echtes 9:16**. Unterstützt sind nur
> `1024x1024`, `1024x1536` (2:3) und `1536x1024` (3:2). Ein direkt generiertes „TikTok-Bild" gibt
> es also nicht — 9:16 muss immer per Nachbearbeitung entstehen.

### TikTok-Variante per `editImage` (kein zweiter KI-Call)

Bewährtes Social-Muster, das **nie** Text anschneidet und nichts neu rendert:
```
1. Master kopieren, stark hochskalieren + weichzeichnen (blur)  → Fülle für 1080×1920
2. Master scharf, unverändert, mittig darüber komponieren (composite)
3. Ergebnis = 1080×1920, Ränder oben/unten sind die unscharfe Verlängerung des Motivs
```
Alternative, falls `blur` Probleme macht: Leinwand in der Markenfarbe `#1e1a17` (dunkel) statt
Blur — ebenfalls sauber, weil das Bild-Design ohnehin auf dunklem Grund basiert.

**Wichtig:** Die TikTok-Variante wird **erst nach der Freigabe** erzeugt, nicht vorab — sonst
zahlt man Rechenzeit für Entwürfe, die verworfen werden.

### Konfiguration — so vorbereiten, dass später nur IDs fehlen

In `Restaurant-Konfiguration`:
```js
buffer: {
  posting_zeit: '17:00',
  kanaele: [
    { key:'instagram', channelId:'6a805d6bb2d9d57743816131', aktiv:true,
      format:'master',   tags:'max5' },
    { key:'facebook',  channelId:'',  aktiv:false,
      format:'master',   tags:'full' },
    { key:'tiktok',     channelId:'', aktiv:false,
      format:'vertical', tags:'full' }
  ],
  pinterest_url: 'https://www.pizzarello.net'
}
```
**Aktivierung eines Kanals = `channelId` eintragen + `aktiv:true`.** Sonst keine Codeänderung.

### Ablauf nach der Freigabe

```
[✅ Freigeben]
   → Aktive Kanaele ermitteln   (Code: kanaele.filter(k => k.aktiv && k.channelId))
   → Braucht 9:16?              (nur wenn ein aktiver Kanal format:'vertical' hat)
        ja → TikTok-Variante rendern (editImage) → imgbb hochladen
   → Buffer-Requests bauen      (EIN Request pro aktivem Kanal, mit passender Bild-URL
                                 und kanalspezifischem Hashtag-Umfang)
   → Split In Batches / Loop    → Buffer Post planen  (pro Kanal ein createPost)
   → Ergebnisse sammeln
   → Bestaetigung an Telegram:  "Freigegeben - geplant fuer 17:00 Uhr auf: Instagram ✅"
                                 (bzw. Liste aller Kanäle + Fehler, falls einer scheitert)
```

**Regeln:**
- Kein aktiver Kanal → klare Meldung an den Gastronomen, **nicht** stillschweigend nichts tun.
- Ein Kanal scheitert → die anderen trotzdem planen, Fehler in der Bestätigung benennen.
- Bildformat pro Kanal aus `format` ableiten (`master` → Master-URL, `vertical` → 9:16-URL).
- Die erzeugten URLs im `pizzarello_post_log` mitschreiben (Kanal, URL, geplante Zeit).

> **Offener Punkt zum Prüfen:** Ob Buffer für TikTok reine **Bild**-Posts unterstützt (TikTok ist
> primär Video), muss verifiziert werden, sobald ein TikTok-Kanal verbunden ist. Falls nur Video
> geht, ist das eine Produktentscheidung — im Zweifel TikTok zunächst `aktiv:false` lassen.

---

## Telegram-Details, die erfahrungsgemäß Zeit kosten

- **Inline-Keyboard (SDK-Syntax):**
  ```
  replyMarkup: 'inlineKeyboard',
  inlineKeyboard: { rows: [{ row: { buttons: [
    { text: '✅ Freigeben', additionalFields: { callback_data: 'ok:<post_id>' } }
  ] } }] }
  ```
- **`callback_data` ist auf 64 Bytes begrenzt** → kurzes Schema wie `ok:`, `neu:`, `weg:` + post_id.
- **`answerCallbackQuery` ist Pflicht** und muss innerhalb ~10 s erfolgen, sonst zeigt Telegram
  dem Nutzer einen Fehler und der Button dreht endlos.
- **Nach der Entscheidung die Buttons entfernen** (`editMessageReplyMarkup` mit leerem Markup),
  sonst tippt der Nutzer später erneut auf einen toten Entwurf.
- **Limits:** Foto-Caption max. **1024** Zeichen, normale Nachricht max. **4096**. Der Post-Text
  plus Hashtags kann das reißen → Caption kürzen oder Text als Folgenachricht senden.
- **`file_id` ist bot-spezifisch:** Trigger-Bot, Download-Bot und Sende-Bot **müssen dieselbe
  Credential** nutzen (`Telegram Pizzarello Bot`). Bei falscher Credential schlägt der Download
  wortlos fehl.
- **`getBinaryDataBuffer` direkt nach dem Download** aufrufen — ein IF/Set dazwischen bricht im
  `filesystem`-Binärmodus die Referenz.
- **Bildgenerierung dauert 30–90 s.** Vor dem Start `sendChatAction` senden und/oder eine kurze
  Zwischennachricht („Einen Moment, ich baue dir den Post…"), sonst wirkt der Bot eingefroren.

## n8n-MCP/SDK-Fallstricke (aus `Pizzarello_Handover.md`, Abschnitt 7)

1. **`update_workflow` wirft ALLE Credentials ab** → nach jedem Deploy per Audit prüfen und neu
   setzen. Das war in der Vorsession die Ursache tagelanger Fehlersuche.
2. **`publish_workflow` nicht vergessen** — sonst läuft die Produktion auf der alten Version.
3. **Nur ASCII im `jsCode`** (`waehle`, `fuer`, `Aenderung`) — Umlaute werden zerstört.
4. `update_workflow` ersetzt den kompletten Workflow → immer vollständigen Code senden.
5. Workflow-`description` max. 255 Zeichen.
6. `editImage`-Farben nur als 6-stelliges Hex.

---

## Aufräumen

- **Web-App `pNFLlk3GPQO3lcjS`:** `unpublish_workflow`, dann `archive_workflow`.
- **Altflow `tzRlOxsLZ8eyCdgT`:** erst deaktivieren, wenn der Neubau die Abnahmetests besteht —
  danach archivieren.
- **Entfallen ersatzlos:** Web Push (Service Worker, Manifest, VAPID, Node `Web-Push senden`),
  Data Table `pizzarello_push_subs`, Data Table `pizzarello_pending` (durch `pizzarello_sessions`
  ersetzt), sämtliche `[DIAG …]`-Diagnosetexte — **sowie die sieben Logo-Composite-Nodes**
  (`Logo suchen`, `Logo-ID waehlen`, `Logo herunterladen`, `Logo konvertieren`,
  `Bild und Logo buendeln`, `Logo skalieren`, `Logo einfuegen`), ersetzt durch das eine
  `Logo laden` + Übergabe an die Generierung.
- **Bleibt:** `pizzarello_angebote`, `pizzarello_speisekarte`, `pizzarello_fotos`,
  `pizzarello_learnings`, `pizzarello_post_log`.

---

## Zwingend mitbauen: Fehler-Sichtbarkeit

Im Altstand starben Fehler lautlos — der Gastronom merkte nur, dass nichts passierte.
Deshalb **im selben Zug**:

1. Workflow `Pizzarello Fehler-Melder`: `errorTrigger` → Telegram an den **Betreiber** mit
   Workflow, Node, Fehlertext, Execution-Link.
2. In den Settings des Bot-Workflows als `errorWorkflow` eintragen.
3. Im Bot selbst: bei jedem Abbruch `state` von `BUSY` zurücksetzen **und** dem Gastronomen eine
   verständliche Nachricht schicken („Da ist bei mir was schiefgelaufen — versuch es bitte
   nochmal."). Keine technischen Rohdaten in die Nutzer-Nachricht.

---

## Abnahmetests

| # | Szenario | Erwartung |
|---|---|---|
| 1 | „Mach was für Freitag" | Rückfrage als **normale Nachricht**; Antwort führt zum Entwurf |
| 2 | Foto + Bildunterschrift senden | Entwurf **auf Basis des Fotos** (kein Archivbild) |
| 3 | Bei offenem Entwurf „Titel kürzer" tippen | neue Variante, **kein** Button nötig |
| 4 | [✅ Freigeben] tippen | Buttons verschwinden, Bestätigung **mit Uhrzeit und Kanalliste**, Buffer geplant |
| 5 | Tagespost 09:30, Entscheidung erst 6 h später | funktioniert — keine laufende Execution nötig |
| 6 | n8n mitten im Gespräch neu starten | Gespräch läuft weiter (Zustand liegt in der Tabelle) |
| 7 | Zweimal schnell hintereinander senden | zweite Nachricht wird höflich abgefangen (`BUSY`) |
| 8 | Zweimal auf denselben Button tippen | zweiter Tap läuft ins Leere, kein Doppel-Post |
| 9 | **Logo im Ergebnis** | genau **einmal** vorhanden, unverfälscht, wirkt integriert statt aufgeklebt; kein erfundenes Zweitlogo |
| 10 | **Freigabe mit nur Instagram aktiv** | genau **ein** Buffer-Post; keine TikTok-Variante gerendert (Kosten sparen) |
| 11 | **`facebook` auf `aktiv:true` + ID setzen** | ohne weitere Codeänderung gehen **zwei** Posts raus, beide mit dem Master-Bild |
| 12 | **`tiktok` auf `aktiv:true` + ID setzen** | 9:16-Variante wird erzeugt, hochgeladen und als dritter Post geplant |
| 13 | Kein Kanal aktiv | klare Meldung an den Gastronomen statt stiller Wirkungslosigkeit |

---

## Nicht-Ziele (bewusst weglassen)

- Keine Web-App, keine PWA, kein Web Push.
- Kein `sendAndWait`, kein `Wait`-Node für die Freigabe.
- Keine Multi-Mandanten-Konfiguration in diesem Schritt (Config bleibt vorerst im Code —
  Auslagerung in eine `restaurant_config`-Tabelle ist der **nächste** Schritt danach).

---

## Vorgehen

1. `Pizzarello_Handover.md` lesen (Architektur-Altstand, Fallstricke).
2. `workflows/hauptflow.ts` lesen — daraus Konfiguration, Agent-Setup, Post-Aufbereitung,
   Preis-Badge und Learning-Schleife übernehmen.
3. **`AIColor.Me Marketing Agent v8` (`luWRBIdlesNnIMsz`) ansehen** — Nodes `Logo laden`,
   `Social-Prompt bauen`, `GPT-Image Social-Bild`. Das ist die Referenz für die Logo-Übergabe.
4. `get_sdk_reference` + `get_node_types` für Telegram-Trigger, Telegram-Node
   (`sendMessage`/`sendPhoto`/`answerCallbackQuery`/`editMessageReplyMarkup`/`sendChatAction`),
   `editImage` (resize/blur/composite) und dataTable ziehen — **Parameternamen nicht raten**.
5. `pizzarello_sessions` anlegen.
6. Workflow als **neuen** Workflow bauen, validieren, deployen, publishen, Credentials setzen.
7. Abnahmetests 1–13 durchgehen (9–13 decken Logo und Mehrkanal ab).
8. Erst dann Altflow + Web-App archivieren.

> **Vor dem ersten Deploy dem Nutzer ansagen**, dass danach die Credentials neu gesetzt werden
> müssen — und Änderungen bündeln statt einzeln zu deployen.
