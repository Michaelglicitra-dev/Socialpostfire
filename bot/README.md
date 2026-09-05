# Pizzarello Bot — aktueller Stand (Bild-Guideline v3)

> **Das hier ist die aktuelle Variante.** `workflows/hauptflow.ts` und `workflows/webapp.ts`
> sind der **Altstand** (Web-App-Architektur, verworfen) — siehe [`../LEGACY.md`](../LEGACY.md).

Live-Workflow in n8n: **`Pizzarello Bot`**, ID `B7LuGXIaNnPC5ulk` (aktiv, 87 Nodes,
rein Telegram-basiert). Sein vollständiger SDK-Quellcode existiert nicht — der Workflow
wurde direkt in n8n gepflegt. Dieses Verzeichnis enthält deshalb den **Node-Code der
bildrelevanten Nodes** plus einen JSON-Snapshot des Live-Workflows als Referenz.

```
bot/
  nodes/                  <- Code zum Einspielen (pro n8n-Node eine Datei)
  prompts/                <- gerenderte Beispiel-Prompts je Layout, zum Gegentesten
  live/                   <- Snapshot des Live-Workflows + fertige Import-JSON
  preview.mjs             <- rendert die Prompts aus nodes/, ohne n8n
  build-workflow-json.mjs <- baut die Import-JSON aus Snapshot + nodes/
```

---

## Weg A: fertige Workflow-JSON importieren

`bot/live/Pizzarello-Bot-v3.import.json` enthält den **kompletten Workflow mit allen 87
Nodes**, v3 bereits eingebaut. In n8n über **Workflows → … → Import from File** einlesen.

> ⚠️ **Nicht in den laufenden Workflow hineinkopieren.** Einfügen ins Canvas legt die 87
> Nodes *zusätzlich* neben die vorhandenen — du hättest jeden Node doppelt. Importiere die
> Datei als **neuen Workflow**.

> ⚠️ **n8n importiert die Workflow-Einstellungen nicht mit.** Die Datei enthält
> `errorWorkflow` und `availableInMCP`, der Import verwirft beides. Ohne Error-Workflow
> bleibt nach einem Fehler der Session-Status auf `BUSY` stehen und der Bot antwortet nur
> noch „Ich bin beschäftigt". **Beides nach dem Import von Hand setzen.**

Nach dem Import in dieser Reihenfolge:

0. **Workflow-Einstellungen setzen** (Drei-Punkte-Menü → Settings):
   *Error Workflow* = `Pizzarello Fehler-Melder`, und MCP-Zugriff aktivieren. Die n8n-API liefert Credentials nicht aus, der Snapshot
   enthält also keine. Betroffen sind alle Telegram-, OpenAI-, imgbb- und HTTP-Nodes
   (23 Stück). Das ist der Preis dieses Wegs.
2. **Alten Bot deaktivieren**, bevor du den neuen aktivierst — zwei aktive Workflows am
   selben Telegram-Bot verarbeiten jede Nachricht doppelt.
3. Neuen Workflow aktivieren und mit einer Testnachricht prüfen.

Die `webhookId` des Telegram-Triggers ist bewusst entfernt, damit n8n eine neue vergibt.
`settings.errorWorkflow` zeigt weiterhin auf den `Pizzarello Fehler-Melder`.

Die Datei wird erzeugt mit:

```bash
node bot/build-workflow-json.mjs
```

Das Skript patcht den Snapshot mit den Dateien aus `nodes/` und prüft dabei jede der 19
Änderungen — schlägt eine fehl, bricht es ab, statt eine halb gepatchte Datei zu schreiben.

---

## Weg B: einzelne Nodes einspielen (empfohlen)

Weniger bequem, aber **ohne Credential-Verlust und ohne zweiten Workflow**: du änderst den
laufenden Bot direkt. Der Code wird **pro Node in der n8n-Oberfläche** eingefügt. Reihenfolge egal, aber alle sechs gehören zusammen —
teilweises Einspielen bricht den Flow (z.B. neue Layout-Namen ohne passende Config).

| Datei | n8n-Node | Wohin |
|---|---|---|
| `nodes/Restaurant-Konfiguration.js` | `Restaurant-Konfiguration` | Feld **JavaScript** komplett ersetzen |
| `nodes/Post-aufbereiten.js` | `Post aufbereiten` | Feld **JavaScript** komplett ersetzen |
| `nodes/Logo-buendeln.js` | `Logo buendeln` | Feld **JavaScript** komplett ersetzen |
| `nodes/Router.js` | `Router` | Feld **JavaScript** komplett ersetzen |
| `nodes/Bild-Request-bauen-Neu.js` | `Bild-Request bauen (Neu)` | Feld **JavaScript** komplett ersetzen |
| `nodes/Bild-Request-bauen-Foto.js` | `Bild-Request bauen (Foto)` | Feld **JavaScript** komplett ersetzen |
| `nodes/Post-Schema.jsonSchemaExample.txt` | `Post-Schema` | Feld **JSON Example** komplett ersetzen |
| `nodes/Post-Agent.systemMessage.txt` | `Post-Agent` | Options → **System Message** komplett ersetzen |

Dazu kommen **sechs Zahlenfelder** im Node `Preis-Badge stempeln`. Sie waren fest auf die
Leinwand 1024×1536 verdrahtet; seit das Format je Plattform wechselt, müssen sie relativ
zur Bildhöhe rechnen. Jeweils die Zahl durch den Ausdruck ersetzen:

| Operation | Feld | alt | neu |
|---|---|---|---|
| 1. Kreis (rot) | Start Position Y | `1364` | `={{ $('Logo buendeln').first().json.badge_mitte_y }}` |
| 1. Kreis (rot) | End Position Y | `1216` | `={{ $('Logo buendeln').first().json.badge_aussen_y }}` |
| 2. Kreis (creme) | Start Position Y | `1364` | `={{ $('Logo buendeln').first().json.badge_mitte_y }}` |
| 2. Kreis (creme) | End Position Y | `1228` | `={{ $('Logo buendeln').first().json.badge_innen_y }}` |
| Text „nur" | Position Y | `1327` | `={{ $('Logo buendeln').first().json.badge_nur_y }}` |
| Text Preis | Position Y | `1420` | `={{ $('Logo buendeln').first().json.badge_preis_y }}` |

> Bei 1024×1536 liefern die Ausdrücke exakt die bisherigen Zahlen — auf Hochformat-Tagen
> ändert sich also nichts. Ohne diese Änderung landet der Preis-Badge an quadratischen
> Tagen außerhalb der Leinwand.

Danach speichern und den Workflow neu publishen. **Credentials bleiben erhalten** — sie
gehen nur bei `update_workflow` über MCP verloren, nicht beim Bearbeiten einzelner Nodes.

---

## Was v3 ändert

Der alte Look war auf „reduziert, gedämpft" getrimmt: graue Flächen, weiches Licht, eine
dünne Headline. Sah sauber aus, aber nicht nach Werbung. v3 dreht das um.

**Bildsprache.** Tiefes Nahschwarz oder unscharfe reale Szene statt Grau, gerichtetes Licht
mit harten Lichtern und tiefen Schatten, gesättigtes Gericht in ruhiger dunkler Umgebung.
Neu in der Negativliste: `flat washed-out grey lighting and low contrast`.

**Typo-Hierarchie statt einer Zeile.** Der Post-Agent liefert jetzt bis zu vier Bildzeilen:

| Feld | Max | Inhalt |
|---|---|---|
| `bild_headline` | 40 | wie bisher, größtes Element |
| `bild_subline` | 60 | z.B. `Mortadella - Stracciatella - Pistazie` |
| `bild_infozeile` | 40 | Zeitraum/Ort in Versalien, **ohne Ziffern** |
| `bild_cta` | 30 | Handlungsaufruf, nur `produkt_spotlight` / `event_poster` |

`Post aufbereiten` erzwingt das: ASCII-Filter, Längenkappung, Ziffern in der Infozeile
werden verworfen, CTA außerhalb der zwei Layouts wird geleert, bei `pur` fallen alle vier weg.

**Drei Stil-Familien, acht Layouts.**

| Layout | Stil | Schrift | Wofür |
|---|---|---|---|
| `klassik` | promo | geometrisch | Allrounder |
| `promo_poster` | promo | condensed | **neu** — Werbeplakat, Text oben gestapelt |
| `menue_karte` | promo | geometrisch | Gericht komplett + Zutatenzeile |
| `angebots_sticker` | promo | condensed | Angebot, unten rechts frei für Preis-Badge |
| `produkt_spotlight` | spotlight | geometrisch | **neu** — Kampagne mit Handlungsaufruf |
| `event_poster` | event | condensed | Event, mehrere Textblöcke |
| `pur` | promo | – | kein Text im Bild |
| `zitat` | promo | geometrisch | eine kurze Zeile |

**Eine Plattform je Post, im passenden Format.** Ein Bild geht an genau einen Kanal, die
Kanäle rotieren über die Woche. Damit braucht kein Bild je zugeschnitten oder mit Balken
gestreckt zu werden — es entsteht direkt in der richtigen Größe.

| Wochentag | Plattform | Generierung | Nachbearbeitung |
|---|---|---|---|
| Mo, Do, So | Instagram | 1024×1024 (1:1) | keine |
| Di, Fr | Facebook | 1024×1024 (1:1) | keine |
| Mi, Sa | TikTok | 1024×1536 (2:3) | vorhandene 9:16-Ableitung nach Freigabe |

`gpt-image-1` kann nativ nur 1:1, 2:3 und 3:2 — deshalb ist 9:16 der einzige Fall, der
noch nachbearbeitet wird. Die Rotation steht in `plattform_rotation`, die Formatzuordnung
in `plattformen[x].bild_format`, die Leinwände in `formate`.

**Nicht scharf geschaltete Plattformen werden übersprungen.** Facebook und TikTok haben
noch keine `channelId`; solange das so ist, fällt die Rotation auf die nächste aktive
Plattform zurück und alles geht an Instagram. Sobald du eine Kanal-ID einträgst und
`aktiv: true` setzt, greift die Rotation für diesen Tag automatisch.

Der Prompt bekommt je Format einen **Leinwand-Hinweis** (`formate[x].hinweis`), damit die
Textzone zum Seitenverhältnis passt — im Quadrat ist weniger Höhe, also Headline plus
höchstens eine kurze Zeile.

**Alles Nachgelagerte bleibt unverändert.** Die Config setzt `bild_size` und
`buffer.kanaele` auf die Plattform des Tages; `Freigabe vorbereiten`, `Buffer-Requests
bauen`, `Log schreiben` und die 9:16-Ableitung arbeiten damit unverändert weiter.

**Änderungswünsche haben Vorrang.** Der Anpassungs-Pfad sagte gleichzeitig „behalte Foto,
Komposition, Gericht und Personen" *und* „setze diese Änderung um". Betraf der Wunsch genau
das Gericht („zeig statt einer Pizza tanzende Paare"), gewann die Behalten-Klausel — der
Text wurde übernommen, das Motiv nicht. Jetzt steht ausdrücklich im Prompt, dass der
Änderungswunsch jede andere Anweisung schlägt, dass „statt X zeig Y" das alte Motiv
**ersetzt** statt es zu ergänzen, und dass ein Wunsch mehrere Teile haben darf.

**`bild_neu` hängt jetzt am Motiv.** Bisher galt „true nur wenn ein KOMPLETT anderes Bild
gewünscht ist" — zu eng, deshalb landeten Motivwünsche im Anpassungs-Pfad, der sie gar nicht
umsetzen kann. Neue Regel: betrifft der Wunsch **was zu sehen ist** (anderes Gericht, andere
Szene, andere Personen) → `true`, es wird neu generiert. Betrifft er nur die **Darstellung**
(Text, Farben, Ausschnitt, Layout) → `false`, das Bild wird angepasst.

**BUSY-Notbremse im Router.** Solange ein Lauf arbeitet, steht die Session auf `BUSY` und
neue Nachrichten bekommen „Ich bin beschäftigt". Bricht ein Lauf ab, ohne dass der
Error-Workflow greift, blieb der Bot bisher **dauerhaft** in diesem Zustand — nur ein
Eingriff in die Data Table half. Jetzt gilt ein `BUSY`, das älter als zehn Minuten ist, als
abgelaufen und wird wie `IDLE` behandelt. Ein Bildlauf braucht selten mehr als zwei Minuten.

**Vorrang der reservierten Ecken.** Layout-Beschreibung und freie Ecke können sich
widersprechen — genau daran ist die erste Testrunde gescheitert (Layout sagte „Gericht
angeschnitten", Zonen-Regel sagte „Ecke frei"; das Modell hat sich für das schönere Bild
entschieden und das Logo landete auf der Kruste). Jetzt steht ausdrücklich im Prompt:
die reservierte Ecke schlägt jede andere Platzierungsanweisung.

Logo unten links (Box 420×200, Rand 64) und Preis-Badge unten rechts sind unverändert —
beides wird weiterhin real aufkomponiert, nie von der Bild-KI gemalt.

---

## Prompts testen, ohne zu deployen

```bash
node bot/preview.mjs                     # alle 8 Layouts, Neu-Generierung
node bot/preview.mjs promo_poster        # nur eines
node bot/preview.mjs --foto              # Foto-Pfad
node bot/preview.mjs --tag 3             # Wochentag setzen (1=Mo..7=So) -> Plattform
node bot/preview.mjs --out bot/prompts/  # als .txt ablegen
```

Das Werkzeug führt den **echten Node-Code** aus `bot/nodes/` aus. Was es ausgibt, ist
Zeichen für Zeichen der Prompt, den n8n an `gpt-image-1` schickt.

**Testschleife:** Prompt aus `bot/prompts/` in ChatGPT geben (Format 2:3 hochkant), Ergebnis
beurteilen, den störenden Baustein in `nodes/Restaurant-Konfiguration.js` ändern, neu
rendern. Erst wenn der Look sitzt, in n8n einspielen.

Für den Foto-Pfad: erst das eigene Foto anhängen, dann den `*_foto.txt`-Prompt einfügen.

---

## Der Foto-Pfad ist bewusst anders gebaut

Kommt ein eigenes oder ein Archiv-Foto als Grundlage, läuft das Bild über `images/edits`
statt `images/generations`. Der Prompt lässt weg, was das Foto umbauen würde:

| | Neu-Generierung | Foto-Pfad |
|---|---|---|
| `look`, `stile`, `module`, `motiv` | ja | **nein** |
| `grading` (nur Look, Motiv bleibt) | nein | ja |
| Layout | volle Bildaufteilung | **nur die Textplatzierung** |
| Typo, Textzeilen, Zonen, Verbote | ja | ja |

Ist das Gericht auf dem Foto randlos und mittig, kann keine Ecke wirklich frei werden —
dann sind `klassik` oder `pur` die sicherere Wahl als `promo_poster`.
