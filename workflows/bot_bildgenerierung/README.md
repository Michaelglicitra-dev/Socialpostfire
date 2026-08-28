# Bildgenerierung im Workflow „Pizzarello Bot" (`B7LuGXIaNnPC5ulk`)

Korrigierte Quellen der Nodes, die an der Bildkette hängen. Stand: 28.08.2026.

Die Kette im Live-Flow:

```
Post-Agent -> Post aufbereiten -> Bild-Modus -> Logo laden -> Mit Basisfoto?
   |-- true  -> Basisfoto laden -> Bild-Request bauen (Foto) -> GPT Bild (Foto + Logo)
   |-- false ->                    Bild-Request bauen (Logo) -> GPT Bild (nur Logo)
-> Bild extrahieren -> Preis-Badge? -> Preis-Badge stempeln -> Finalbild extrahieren -> imgbb
```

## Dateien

| Datei | n8n-Node | Feld |
|---|---|---|
| `01_Restaurant-Konfiguration.js` | Restaurant-Konfiguration | `jsCode` |
| `02_Bild-Modus.js` | Bild-Modus | `jsCode` |
| `03_Bild-Request_bauen_Foto.js` | Bild-Request bauen (Foto) | `jsCode` |
| `04_Bild-Request_bauen_Logo.js` | Bild-Request bauen (Logo) | `jsCode` |
| `05_Bild_extrahieren.js` | Bild extrahieren | `jsCode` |
| `06_Preis-Badge_positionX.txt` | Preis-Badge stempeln | Operation 4 (`text`), Feld `positionX` |
| `_test_prompts.js` | — | lokaler Prompt-Simulator (`node _test_prompts.js`) |

Zusätzlich per Hand zu setzen (Node-Einstellung, kein Code):

- **GPT Bild (Foto + Logo)** und **GPT Bild (nur Logo)**: *Settings → On Error → „Continue (using regular output)"*
  (`onError = continueRegularOutput`). Erst dadurch kommt eine Moderations-Ablehnung
  als Datensatz bei `Bild extrahieren` an und wird dort in eine verständliche deutsche
  Fehlermeldung übersetzt (statt als roher HTTP-Fehler im Fehler-Melder zu landen).
  `retryOnFail` ist an beiden Nodes bereits aktiv und bleibt es.

## Was geändert wurde — Befund für Befund

**1. Logo und Headline kämpfen um dieselbe Zone.** Die Zonen sind jetzt disjunkt und werden
an genau einer Stelle vergeben (Block `ZONES` in beiden Buildern): Logo **unten links**,
Preis-Badge **unten rechts**, Headline **oberes Drittel**, Motiv dazwischen und in keiner der
beiden unteren Ecken. Das frühere „Logo … bevorzugt oben rechts" ist ersatzlos weg.
Der Preis-Badge wird ohnehin bei (852|1364) gestempelt, also unten rechts — Badge und Logo
kollidieren damit auch physisch nicht mehr.

**2. Im Foto-Pfad fehlten `image_brief` und der Markenkern.** Der Foto-Pfad bekommt jetzt
`grading` + `look` (Studio-Look) + die Zonen + `stil_foto` und den `image_brief` als
ausdrücklich **beschreibenden** Kontext („this is what image 1 already shows — do not
re-invent it and add nothing to it"). Der Brief wird bewusst nicht als Gestaltungsauftrag
gesetzt, sonst malt das Modell das Gericht um. Dazu kommt der für Archiv-Fotos entscheidende
Satz: fehlt im oberen Drittel eine ruhige Fläche, soll der Hintergrund nach oben verlängert
werden, statt ins Gericht zu schneiden.

**3. Doppel-Logo bei Änderungswünschen.** `Bild-Modus` liefert neu `anpassung` / `logo_drin`.
Ist das Basisbild der vorherige Entwurf, baut der Foto-Builder einen eigenen, kurzen Prompt
(≈750 statt ≈2.900 Zeichen): Bild 1 bleibt wie es ist, **nur** der Änderungswunsch wird
umgesetzt, und Bild 2 (das Logo) ist ausdrücklich nur noch **Referenz** — „it is already part
of image 1, do not add a second one". Guideline-, Layout- und Stil-Blöcke entfallen in diesem
Fall komplett; sie waren die Ursache für das „Verwässern" des Änderungswunsches.

**4. Widerspruch beim Badge.** Die Erlaubnis „a small fine circular badge ONLY when a concrete
date …" ist aus dem Markenkern gestrichen. Es gilt nur noch die eine Regel in `verbote`:
gar keine Badges, Sticker, Siegel, Bänder, Datumsstempel. Datumsangaben gehören in die
Headline, der Preis kommt als echter Stempel.

**5. Deutsch/Englisch gemischt.** Sämtliche Steueranweisungen sind jetzt Englisch. Deutsch
bleiben nur die beiden Dinge, die deutsch sein müssen: die zu rendernde Headline (wörtlich in
Anführungszeichen, mit dem Hinweis „the wording is German") und der Änderungswunsch des Wirts.

**6. Negativlisten.** Die alte `negativ`-Liste („rustic wooden-table, candle, wine, napkin,
herbs, tricolore …") ist ersetzt durch `stil` bzw. `stil_foto` — positiv formuliert, was im
Bild sein soll. Übrig bleibt ein kurzer, harter Block `verbote` mit den vier Dingen, die
wirklich Verbote sein müssen (kein eigenes Logo, kein Preis/keine Zahl, keine Badges, Text
nur innerhalb der Safe Area). Kein einziges Requisit wird mehr namentlich genannt.

**7. Prompt-Budget.** Der Generierungs-Prompt ist von ~4.500–5.000 auf ~2.400–3.000 Zeichen
geschrumpft, und das Motiv (`image_brief`) steht jetzt an **erster** Stelle. Die
Doppelbeschreibung der Textplatzierung ist aufgelöst: `layouts[*].bild` ist die **einzige**
Quelle für die Headline-Zone, `module[*]` beschreibt nur noch das Motiv, `markenkern` ist in
`look` (Licht/Farbe/Anmutung, gilt immer) und `motiv` (Untergrund und Food-Staging, nur bei
Gerichten) zerlegt. Bei `bild_typ` flyer/event entfällt `motiv`, sonst hätte der Studio-Tisch
der Szene widersprochen.

**8. Kleinkram.**
- *retryOnFail:* war entgegen dem Befund an beiden GPT-Bild-Nodes bereits gesetzt (3 Versuche).
  Das half nur nicht: ein Moderations-Refusal wird dreimal identisch abgelehnt. Deshalb jetzt
  `onError = continueRegularOutput` plus die Auswertung in `Bild extrahieren`.
- *Font-Hint:* die Flyer-Variante (Barlow Condensed) gilt jetzt in **beiden** Buildern und
  greift bei `bild_typ = flyer` **oder** `layout = event_poster`.
- *Badge-Zentrierung:* statt `852 - len*15` jetzt eine gewichtete Breite nach den
  Helvetica-Metriken von GraphicsMagick (Ziffer 33 px, Komma/Punkt/Leerzeichen 17 px,
  Euro-Zeichen 33 px bei fontSize 60). „9 €" landet bei x=811, „12,90 €" bei x=753.

## Zusätzlich gefunden (nicht im Prüfbericht)

**9. Doppelter Preis-Badge bei Änderungswünschen.** Bei `modus = aenderung` ist das Basisbild
die imgbb-URL des **fertigen** Entwurfs — inklusive des bereits gestempelten Preis-Badges.
Der alte Prompt sagte trotzdem „Rendere KEINEN Preis"; anschließend stempelte
`Preis-Badge stempeln` erneut. Ergebnis: das Modell zeichnet den Badge unscharf nach, verschiebt
ihn womöglich, und darüber liegt dann ein zweiter, echter Badge. Jetzt lautet die Anweisung,
den vorhandenen Badge **exakt an Ort und Größe zu belassen** — der erneute Stempel deckt ihn
dann pixelgenau ab (gleiche Koordinaten, deckender Kreis).

## Noch offen / bewusst nicht gemacht

- Die **Web-App** (`pNFLlk3GPQO3lcjS`) und der alte **Marketing Agent v2** (`tzRlOxsLZ8eyCdgT`)
  tragen eine eigene Kopie derselben Config. Beide sind derzeit inaktiv, deshalb hier nicht
  angefasst. Wird einer davon reaktiviert, muss die Config nachgezogen werden — oder die
  Config wandert endlich in eine Data Table (siehe Handover, Abschnitt 9).
- Ein echter **Rettungs-Pfad** bei Moderations-Ablehnung (entschärfter Prompt, zweiter Versuch)
  bräuchte zwei zusätzliche Nodes und damit einen vollständigen Deploy.

---

## Deploy-Stand 28.08.2026

Der Draft von `B7LuGXIaNnPC5ulk` ist per MCP aktualisiert (`update_workflow`), **noch nicht publiziert** —
die Produktion laeuft weiter auf der alten aktiven Version, bis `publish_workflow` laeuft.

Der komplette SDK-Quellcode des Bots liegt jetzt als `workflows/bot.ts` im Repo (vorher hatte
der Bot ueberhaupt keine Quelle). Er wurde aus dem Live-Export generiert
(`_gen_sdk.py` aus `_deploy_source.json`, gegengeprueft mit `_verify_local.js`), und der
deployte Draft wurde Feld fuer Feld gegen die Vorlage geprueft: Nodes, Parameter,
Verbindungen und Workflow-Settings stimmen exakt ueberein.

### Vor dem Publish von Hand nachziehen

1. **Credentials an 12 HTTP-Nodes** (`update_workflow` wirft sie prinzipbedingt ab —
   per Test bestaetigt, `newCredential()` bindet nicht an bestehende Credentials):

   | Credential | Nodes |
   |---|---|
   | OpenAI Pizzarello | GPT Bild (Foto + Logo), GPT Bild (nur Logo), Learning bewerten |
   | imgbb | imgbb hochladen, imgbb Hochformat, Eingangsfoto hochladen |
   | Buffer | Buffer Post planen |
   | *(keine)* | Master laden, Website laden, Feiertage laden, Logo laden, Basisfoto laden |

   Die letzten fuenf sind unauthentifiziert und brauchen nichts. Ebenfalls pruefen (n8n
   markiert fehlende Credentials rot): die 9 Telegram-Nodes, der Telegram-Trigger und
   `OpenAI gpt-5-mini`.

2. **Retry-Feinwerte**: das SDK uebertraegt `retryOnFail`, aber **nicht** `maxTries` /
   `waitBetweenTries`. Nach dem Deploy stehen betroffene Nodes auf dem Default (3 Versuche,
   1 s Pause). Wieder setzen, falls gewuenscht: `Logo laden` 5 Versuche / 5 s,
   `GPT Bild (Foto + Logo)` und `GPT Bild (nur Logo)` je 3 Versuche / 5 s.

3. **onError pruefen**: an beiden GPT-Bild-Nodes muss *On Error* auf
   „Continue (using regular output)" stehen — im Deploy gesetzt, nach manuellen
   UI-Aenderungen aber leicht zu verlieren.

Danach `publish_workflow` (oder „Publish" in der n8n-UI). Der Telegram-Trigger bekommt beim
Publish eine neue `webhookId` und registriert seinen Webhook neu — dafuer muss sein
Credential haengen, sonst empfaengt der Bot keine Nachrichten mehr.

### Kuenftige Deploys

`workflows/bot.ts` bearbeiten → `validate_workflow` → `update_workflow` → Credentials
nachziehen → `publish_workflow`. Oder, fuer reine Prompt-Iterationen: die Dateien in diesem
Ordner direkt in die Code-Nodes der n8n-UI kopieren — das kostet keine Credentials.
