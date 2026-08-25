# Pizzarello Bot — Neuaufbau (ereignisgesteuert, rein Telegram)

> Stand: 25.08.2026 · Ersetzt die Zweiteilung aus `Pizzarello_Handover.md`
> (Hauptflow `tzRlOxsLZ8eyCdgT` + Web-App `pNFLlk3GPQO3lcjS`).
> **Der Neubau ist deployt, aber noch NICHT aktiv.** Siehe "Offene Handgriffe".

---

## 1. Was gebaut wurde

| Workflow | ID | Nodes | Status |
|---|---|---|---|
| **Pizzarello Bot** | `B7LuGXIaNnPC5ulk` | 82 | deployt, published, **deaktiviert** |
| **Pizzarello Fehler-Melder** | `QcBt5fGwEQ4Y3JcB` | 7 | deployt, published, aktiv |

Quellcode (einzige vollständige Quelle):
```
workflows/bot.ts            -> B7LuGXIaNnPC5ulk
workflows/fehlermelder.ts   -> QcBt5fGwEQ4Y3JcB
```

Neue Data Table: **`pizzarello_sessions`** — `8WhvJ2bY2B6wKyGY`
(`chat_id`, `state`, `post_id`, `draft_json`, `photo_url`, `last_message_id`, `updated`)

`pizzarello_post_log` wurde um zwei Spalten erweitert: `kanaele`, `geplant_fuer`.

---

## 2. Architektur: Zustandsautomat statt Wait-Node

Kein `sendAndWait`, kein `Wait`-Node. Jede Telegram-Nachricht und jeder Button-Tap
startet eine **eigene kurze Execution**; der Gesprächszustand liegt in
`pizzarello_sessions`, das Agent-Gedächtnis im `memoryBufferWindow` (gekeyt auf `chat_id`).

```
Trigger -> Update normalisieren -> Eingang -> Restaurant-Konfiguration
        -> Session laden -> Router -> Zweig waehlen (Switch, 6 Ausgaenge)
```

| Route | Bedingung | Zweig |
|---|---|---|
| 0 | `typ = callback` | Callback bestaetigen -> gueltig? -> ok / neu / weg |
| 1 | `state = BUSY` (Telegram) | "Bin beschaeftigt" |
| 2 | `typ = foto` | imgbb -> Foto-Auftrag -> Agent |
| 3 | `typ = text` | Text-Auftrag (IDLE / AWAITING_ANSWER / DRAFT_OPEN) -> Agent |
| 4 | `typ = schedule` | Tagespost-Auftrag -> Agent |
| 5 | fremder Chat, BUSY+Schedule, sonstiges | Ignorieren |

**Die Chat-ID-Prüfung sitzt im `Router`, nicht im Trigger.** Grund: `chatIds` im
Telegram-Trigger filtert `callback_query`-Updates nicht zuverlässig — Button-Taps
wären sonst still verschwunden.

---

## 3. Bild-Pipeline — Logo wird mitgeneriert, nicht aufgeklebt

Die sieben Logo-Composite-Nodes des Altstands sind ersatzlos entfallen. Stattdessen
nach dem Vorbild von `AIColor.Me Marketing Agent v8`:

```
Bild-Modus -> Logo laden (OneDrive-Content-URL, responseFormat file, Property 'logo')
           -> Mit Basisfoto?
                ja   -> Basisfoto laden ('basis') -> Bild-Request bauen (Foto)
                        -> GPT Bild (Foto + Logo)   [2x image[]]
                nein -> Bild-Request bauen (Logo)
                        -> GPT Bild (nur Logo)      [1x image[]]
           -> Bild extrahieren -> Preis-Badge? -> Finalbild -> imgbb
```

Beides geht über `/v1/images/edits` mit `multipart-form-data` und mehreren
`image[]`-Einträgen (`parameterType: formBinaryData`, unterschiedliche
`inputDataFieldName`). Der Prompt benennt die Beilagen ausdrücklich
("ES SIND ZWEI BILDER BEIGEFUEGT…"), sonst ignoriert das Modell sie.

Die alte Regel "Keep the TOP-RIGHT corner completely empty" ist entfallen — dort
sitzt jetzt das Logo. Der **Preis-Badge bleibt echtes `editImage`-Overlay**;
Koordinaten auf das neue Master-Format 1024x1536 umgerechnet
(Kreis-Mittelpunkt 852/1364 statt 852/852).

### Logo-Pfad

Das Logo wird über eine **direkte Graph-Content-URL** geholt, nicht mehr per
OneDrive-Suche. Der Pfad steht als `logo_url` in `Restaurant-Konfiguration`:

```
https://graph.microsoft.com/v1.0/me/drive/root:/SocialPostFire/Pizzarello/Pizzarello_transp.png:/content
```

Das entspricht lokal `…\OneDrive\SocialPostFire\Pizzarello\Pizzarello_transp.png`.
Der Teil nach `root:/` ist **immer relativ zur OneDrive-Wurzel** — der lokale
Laufwerkspfad davor gehört nicht in die URL.

> Vorsicht: Die Direkt-URL ist exakt, inklusive Gross-/Kleinschreibung. Wird das
> Logo umbenannt oder verschoben, schlägt `Logo laden` mit 404 fehl und der Lauf
> bricht ab. Der Altstand hat stattdessen per Dateinamen *gesucht* und war dadurch
> unempfindlicher gegen Verschieben — dafür brauchte er vier Nodes mehr.

---

## 4. Mehrkanal-Ausspielung

In `Restaurant-Konfiguration`:
```js
buffer: {
  posting_zeit: '17:00',
  kanaele: [
    { key:'instagram', name:'Instagram', channelId:'6a805d6bb2d9d57743816131', aktiv:true,  format:'master',   tags:'max5' },
    { key:'facebook',  name:'Facebook',  channelId:'',                          aktiv:false, format:'master',   tags:'full' },
    { key:'tiktok',    name:'TikTok',    channelId:'',                          aktiv:false, format:'vertical', tags:'full' }
  ]
}
```
**Kanal aktivieren = `channelId` eintragen + `aktiv:true`. Sonst keine Codeänderung.**

- `format: 'master'` -> Master-Bild (1024x1536) unverändert
- `format: 'vertical'` -> 9:16 wird **erst nach der Freigabe** gerendert:
  `Master laden` -> `Hochformat Hintergrund` (resize 1080x1920 + blur) ->
  `Hochformat Vordergrund` (resize 1080x1620) -> `Hochformat komponieren`
  (composite bei y=150) -> imgbb. Kein zweiter KI-Call.
- Kein aktiver Kanal -> eigener Zweig mit Klartext-Meldung an den Wirt.
- Ein Kanal scheitert -> die anderen werden trotzdem geplant, der Fehler steht in
  der Bestätigung.

---

## 5. Telegram-Detail: Buttons entfernen ohne `editMessageReplyMarkup`

Der n8n-Telegram-Node kennt **kein** `editMessageReplyMarkup` und
`editMessageText` funktioniert nicht auf Foto-Nachrichten. Deshalb wird der
Entwurf als **zwei** Nachrichten geschickt:

1. `Entwurf-Foto senden` — Bild + kurze Caption (Limit 1024 Zeichen sicher eingehalten)
2. `Entscheidung senden` — Volltext + Hashtags + Inline-Buttons (Limit 4096)

Nur die **zweite** (reine Text-)Nachricht trägt die Buttons; ihre `message_id`
landet in `last_message_id`. Nach der Entscheidung ersetzt `editMessageText` mit
`replyMarkup: 'none'` diese Nachricht durch die Bestätigung — die Buttons sind weg.
Das löst zugleich das Caption-Längenproblem.

`callback_data`-Schema: `ok:<post_id>` / `neu:<post_id>` / `weg:<post_id>`
(ca. 23 Bytes, Limit 64). `answerCallbackQuery` ist der **erste** Node im
Callback-Zweig, also weit unter 10 s.

---

## 6. Verifiziert (Testläufe mit Pin-Daten)

| Execution | Was | Ergebnis |
|---|---|---|
| 2877 | Freigabe `ok:` bei DRAFT_OPEN, 1 aktiver Kanal | Route 0, genau **ein** Buffer-Request (Instagram, max5-Tags, korrekte metadata), **keine** 9:16-Variante gerendert, Bestätigung mit Kanalliste + Uhrzeit, Session -> IDLE |
| 2878 | zweiter Tap auf denselben Button | `gueltig=false`, Hinweis "Dieser Entwurf ist nicht mehr aktuell.", Ende bei "Toter Entwurf" — **kein** Doppel-Post, kein Log-Eintrag |
| 2879 | Freitext aus IDLE | Route 3, Agent lief echt durch (Tools inkl. `get_bildarchiv`, Output-Parser), Website-Parser korrekt, `Bild-Modus` -> `edit_url` mit Archivfoto |
| 2880 | Fehler-Melder | Betreiber-Text mit Workflow/Node/Fehler/Execution-Link, `ist_bot` erkannt, `BUSY` -> `IDLE` zurückgesetzt |

Zusätzlich statisch geprüft: alle **72** `$('Node')`-Querverweise zeigen auf Nodes,
die auf dem jeweiligen Pfad tatsächlich Vorgänger sind; alle 26 `jsCode`-Blöcke im
deployten Workflow sind **byte-identisch** mit `workflows/bot.ts`; kein
Nicht-ASCII-Zeichen im deployten `jsCode`.

---

## 7. Offene Handgriffe (manuell in n8n, nicht per MCP möglich)

### 7.1 Credentials — KRITISCH
`create_workflow_from_code` hat die Credentials **falsch bzw. gar nicht** gesetzt:

| Nodes | zugewiesen | muss sein |
|---|---|---|
| alle 8 Telegram-Nodes im Bot + 2 im Fehler-Melder | `Telegram AiColorMe` | **`Telegram Pizzarello Bot`** |
| `OpenAI gpt-5-mini` | `OpenAi account` | `OpenAI Pizzarello` |
| `Logo laden` | *(leer)* | `OneDrive Pizzarello` |
| `GPT Bild (Foto + Logo)`, `GPT Bild (nur Logo)`, `Learning bewerten` | *(leer)* | `OpenAI Pizzarello` |
| `imgbb hochladen`, `imgbb Hochformat`, `Eingangsfoto hochladen` | *(leer)* | `imgbb` |
| `Buffer Post planen` | *(leer)* | `Buffer` |
| `Website laden`, `Feiertage laden`, `Basisfoto laden`, `Master laden` | *(leer)* | **keine** (korrekt) |

> **Trigger-Bot, Download-Bot und Sende-Bot müssen dieselbe Credential nutzen** —
> sonst schlägt der `file_id`-Download des Eingangsfotos wortlos fehl.
> `get_workflow_details` liefert über den MCP **keine** Credential-Felder, ein
> Audit per MCP ist also nicht möglich. Prüfung nur im n8n-UI.

### 7.2 errorWorkflow eintragen
In den Settings von `Pizzarello Bot` -> **Error Workflow = `Pizzarello Fehler-Melder`**.
Der MCP kann Workflow-Settings nicht setzen.

### 7.3 Aktivieren
`Pizzarello Bot` ist bewusst **deaktiviert**. Beim Aktivieren registriert der
Telegram-Trigger einen Webhook auf dem Bot-Token — **das entzieht den Webhook
jedem anderen aktiven Workflow mit demselben Token** (Altflow `tzRlOxsLZ8eyCdgT`,
ggf. `AIColor.Me Marketing Agent v8`). Reihenfolge deshalb:
1. Credentials setzen
2. Altflow `tzRlOxsLZ8eyCdgT` deaktivieren
3. `Pizzarello Bot` aktivieren
4. Abnahmetests 1-13 fahren
5. erst dann Altflow + Web-App `pNFLlk3GPQO3lcjS` archivieren

### 7.4 Aufräumen nach bestandenen Tests
- `pNFLlk3GPQO3lcjS` (Web-App): unpublish -> archive
- `tzRlOxsLZ8eyCdgT` (Altflow): deaktivieren -> archive
- Data Tables `pizzarello_pending` und `pizzarello_push_subs` werden nicht mehr
  gebraucht.
- **Testzeile entfernen:** in `pizzarello_post_log` steht eine Zeile mit der
  Headline `TESTLAUF Freigabepfad` aus Execution 2877. Der MCP hat kein
  Werkzeug zum Zeilenlöschen — bitte im n8n-UI löschen.

---

## 8. Bewusste Abweichungen vom Bau-Auftrag

1. **Kein `Split In Batches` für die Buffer-Kanäle.** `Buffer-Requests bauen` gibt
   ein Item pro Kanal aus, `Buffer Post planen` läuft dadurch automatisch einmal
   pro Item. Gleiches Ergebnis, drei Nodes weniger, und `Freigabe-Ergebnis` sieht
   über `$input.all()` alle Antworten — bei einer Schleife wäre das Einsammeln
   über `runIndex` deutlich fehleranfälliger.
2. **`editMessageReplyMarkup` gibt es im n8n-Telegram-Node nicht** — gelöst über
   die Zwei-Nachrichten-Aufteilung, siehe Abschnitt 5.
3. **`edit_prev` entfällt.** Im Altstand kam das Vorgängerbild als base64 aus
   derselben Execution. Da jetzt jede Execution eigenständig ist, dient bei einem
   Änderungswunsch die `image_url` aus `draft_json` als Basis (`edit_url`).
4. **Chat-ID-Prüfung im Router statt im Trigger**, siehe Abschnitt 2.
5. **`Restaurant-Konfiguration` enthält keine Backslash-Escapes mehr.** Regexe
   werden über `new RegExp(...)` gebaut, das Euro-Zeichen über
   `String.fromCharCode(0x20ac)`. Grund: Backslashes in Template-Literals sind die
   Hauptquelle stiller Deploy-Fehler. Die Datei enthält jetzt **null** Backslashes
   und **null** Nicht-ASCII-Zeichen.

---

## 9. Bekannte Restrisiken

- **Foto-Eingang ist nicht end-to-end getestet.** `Update normalisieren` liest das
  Binary direkt nach dem Trigger (`getBinaryDataBuffer(0,'data')`) — genau wie im
  alten, funktionierenden Telegram-Eingang, aber ohne den dazwischenliegenden
  IF-Node. Das sollte robuster sein, ist aber unbestätigt.
- **TikTok:** ob Buffer für TikTok reine Bild-Posts annimmt, ist offen. Im Zweifel
  `aktiv:false` lassen.
- **Zeitangabe im Entwurf.** Der Entwurf nennt "heute 17:00 Uhr". Wird erst nach
  16:45 freigegeben, verschiebt `Freigabe vorbereiten` auf den Folgetag; die
  Bestätigung zeigt dann die echte Zeit aus der Buffer-Antwort.
- **Der Betreiber-Chat ist derselbe wie der Wirt-Chat** (`7582948490`). Im
  Fehlerfall kommen daher zwei Nachrichten an. Sobald eine separate Betreiber-Chat-ID
  existiert, nur `BETREIBER_CHAT` in `workflows/fehlermelder.ts` ändern.
