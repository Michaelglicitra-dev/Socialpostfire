# Pizzarello Bot — aktueller Stand (Bild-Guideline v3)

> **Das hier ist die aktuelle Variante.** `workflows/hauptflow.ts` und `workflows/webapp.ts`
> sind der **Altstand** (Web-App-Architektur, verworfen) — siehe [`../LEGACY.md`](../LEGACY.md).

Live-Workflow in n8n: **`Pizzarello Bot`**, ID `B7LuGXIaNnPC5ulk` (aktiv, 87 Nodes,
rein Telegram-basiert). Sein vollständiger SDK-Quellcode existiert nicht — der Workflow
wurde direkt in n8n gepflegt. Dieses Verzeichnis enthält deshalb den **Node-Code der
bildrelevanten Nodes** plus einen JSON-Snapshot des Live-Workflows als Referenz.

```
bot/
  nodes/       <- Code zum Einspielen (pro n8n-Node eine Datei)
  prompts/     <- gerenderte Beispiel-Prompts je Layout, zum Gegentesten
  live/        <- JSON-Snapshot des Live-Workflows (Referenz, nicht zum Einspielen)
  preview.mjs  <- rendert die Prompts aus nodes/, ohne n8n
```

---

## Einspielen in n8n

`update_workflow` über MCP ersetzt **den kompletten Workflow** und würde die 83 Nodes
gefährden, die mit Bildgenerierung nichts zu tun haben. Deshalb wird der Code **pro Node
in der n8n-Oberfläche** eingefügt. Reihenfolge egal, aber alle sechs gehören zusammen —
teilweises Einspielen bricht den Flow (z.B. neue Layout-Namen ohne passende Config).

| Datei | n8n-Node | Wohin |
|---|---|---|
| `nodes/Restaurant-Konfiguration.js` | `Restaurant-Konfiguration` | Feld **JavaScript** komplett ersetzen |
| `nodes/Post-aufbereiten.js` | `Post aufbereiten` | Feld **JavaScript** komplett ersetzen |
| `nodes/Bild-Request-bauen-Neu.js` | `Bild-Request bauen (Neu)` | Feld **JavaScript** komplett ersetzen |
| `nodes/Bild-Request-bauen-Foto.js` | `Bild-Request bauen (Foto)` | Feld **JavaScript** komplett ersetzen |
| `nodes/Post-Schema.jsonSchemaExample.txt` | `Post-Schema` | Feld **JSON Example** komplett ersetzen |
| `nodes/Post-Agent.systemMessage.txt` | `Post-Agent` | Options → **System Message** komplett ersetzen |

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
