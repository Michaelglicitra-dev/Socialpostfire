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

### Bild-Pipeline — **unverändert aus `workflows/hauptflow.ts` übernehmen**

Diese Kette funktioniert nachweislich und darf nicht neu erfunden werden:
```
Bild-Modus (generate | edit_url | edit_prev)
  → Gen-Request → GPT Bild (gen)      ODER
    Basisfoto laden → Kombi-Request → GPT Bild (edits)
  → Bild extrahieren
  → Logo suchen (OneDrive) → Logo-ID waehlen → Logo herunterladen
  → Logo konvertieren → Bild und Logo buendeln
  → Logo skalieren (155×155) → Logo einfuegen (composite @ 850,30)
  → Preis-Badge? → Preis-Badge stempeln (editImage multiStep)
  → Finalbild extrahieren → imgbb hochladen
```
Ebenfalls 1:1 übernehmen: `Restaurant-Konfiguration` (Marke, Farben, **bild_guideline v2**,
layouts, hashtags), `Post-Schema` (Output-Parser), die vier dataTable-Tools, die Learning-Schleife
und den Buffer-Teil.

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
  ersetzt), sämtliche `[DIAG …]`-Diagnosetexte.
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
| 4 | [✅ Freigeben] tippen | Buttons verschwinden, Bestätigung **mit Uhrzeit**, Buffer geplant |
| 5 | Tagespost 09:30, Entscheidung erst 6 h später | funktioniert — keine laufende Execution nötig |
| 6 | n8n mitten im Gespräch neu starten | Gespräch läuft weiter (Zustand liegt in der Tabelle) |
| 7 | Zweimal schnell hintereinander senden | zweite Nachricht wird höflich abgefangen (`BUSY`) |
| 8 | Zweimal auf denselben Button tippen | zweiter Tap läuft ins Leere, kein Doppel-Post |

---

## Nicht-Ziele (bewusst weglassen)

- Keine Web-App, keine PWA, kein Web Push.
- Kein `sendAndWait`, kein `Wait`-Node für die Freigabe.
- Keine Multi-Mandanten-Konfiguration in diesem Schritt (Config bleibt vorerst im Code —
  Auslagerung in eine `restaurant_config`-Tabelle ist der **nächste** Schritt danach).

---

## Vorgehen

1. `Pizzarello_Handover.md` lesen (Architektur-Altstand, Fallstricke).
2. `workflows/hauptflow.ts` lesen — daraus Bild-Pipeline, Konfiguration, Agent-Setup,
   Learning-Schleife und Buffer-Teil übernehmen.
3. `get_sdk_reference` + `get_node_types` für Telegram-Trigger, Telegram-Node
   (`sendMessage`/`sendPhoto`/`answerCallbackQuery`/`editMessageReplyMarkup`/`sendChatAction`)
   und dataTable ziehen — **Parameternamen nicht raten**.
4. `pizzarello_sessions` anlegen.
5. Workflow als **neuen** Workflow bauen, validieren, deployen, publishen, Credentials setzen.
6. Abnahmetests 1–8 durchgehen.
7. Erst dann Altflow + Web-App archivieren.

> **Vor dem ersten Deploy dem Nutzer ansagen**, dass danach die Credentials neu gesetzt werden
> müssen — und Änderungen bündeln statt einzeln zu deployen.
