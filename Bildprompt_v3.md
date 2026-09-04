# Bild-Guideline v3 — Masterprompt + Layout-Varianten

> Stand: 04.09.2026 · Ersetzt die Bild-Guideline v2 (die den flachen, grauen
> „Editorial-Studio"-Look erzeugt hat). Betrifft `workflows/hauptflow.ts` **und**
> `workflows/webapp.ts` — beide tragen dieselbe Config und dieselben Prompt-Bauer.

---

## 1. Warum v3

v2 war auf „reduziert, gedämpft, viel Negativraum" getrimmt. Das Ergebnis war
technisch sauber, aber flau: graue Bürstenmetall-Flächen, weiches Licht ohne
Kontrast, eine einzelne dünne Headline — es sah aus wie eine Menükarte, nicht
wie Werbung. v3 dreht genau diese Schrauben um:

| | v2 (alt) | v3 (neu) |
|---|---|---|
| Hintergrund | gebürstetes Warmgrau / Anthrazit | tiefes Nahschwarz **oder** reale, unscharfe Szene |
| Licht | weich, flächig | gerichtet, harte Lichter + tiefe Schatten |
| Farbe | alles gedämpft | Gericht warm & gesättigt, Umfeld ruhig |
| Typo | eine leichte Headline | **Hierarchie**: Headline ≫ Subline > Infozeile > CTA |
| Schrift | Poppins, nie fett-kondensiert | pro Layout: geometrisch **oder** fett-kondensiert |
| Grafik-Extras | praktisch verboten | Info-Kreis und CTA-Fläche erlaubt, wenn Inhalt sie hergibt |
| Layouts | 6 | 8, gruppiert in 3 Stil-Familien |

Der explizite Negativ-Eintrag `flat washed-out grey lighting and low contrast`
adressiert genau das, was am bisherigen Ergebnis gestört hat.

---

## 2. Aufbau des Masterprompts

Der Prompt wird im Node **`Gen-Request`** aus Bausteinen zusammengesetzt. Jeder
Baustein steht als eigener Schlüssel in `cfg.restaurant.bild_guideline` und ist
einzeln austauschbar:

```
1  Format          "Square 1:1 social media marketing image ..."
2  MOTIF           post.image_brief          (vom Post-Agent, nur das Motiv)
3  master          universeller Masterprompt (immer)
4  stile[stil]     Stil-Familie des Layouts  (promo | spotlight | event)
5  module[bild_typ] Inhaltsmodul             (produkt/event/angebot/saison/bts/flyer)
6  LAYOUT          layouts[layout].bild      (konkrete Textplatzierung)
7  foto            Food-Fotografie-Regeln
8  typo + Textzeilen  Schrifthierarchie + die exakten Zeilen
9  logo_zone       Ecke oben rechts frei, nie ein Logo malen
10 text_regel      nur die gelisteten Zeilen, keine Zahlen/Preise
11 text_safety     Sicherheitsrand, nichts angeschnitten
12 negativ         Negativliste
```

Der Bild-Edit-Pfad (**`Kombi-Request`**, wenn ein eigenes Foto oder ein
Archiv-Foto die Grundlage ist) nutzt dieselben Bausteine, ersetzt aber
`master`/`stile`/`module` durch `grading` — das Foto selbst bleibt unangetastet,
nur Look und Text kommen dazu.

**`Kombi-Request (Vorher)`** (Nachbesserung eines schon fertigen Bildes) bleibt
bewusst minimal: dort soll ausdrücklich *nur* der gewünschte Änderungswunsch
greifen, nicht der volle Masterprompt.

---

## 3. Die drei Stil-Familien

Abgeleitet aus den Referenzbildern:

| Stil | Vorbild | Kern |
|---|---|---|
| `promo` | „60 seconds to napoli — NEUE SPECIALS" | Werbeplakat, Held-Produkt gross angeschnitten, tiefes Schwarz, punchy Typo, optionaler Info-Kreis |
| `spotlight` | Arla Pro „NYC Pizza Trend Guide" | Kampagnenbild mit **einer** klaren Botschaft und CTA-Fläche unten links, warme unscharfe Szene |
| `event` | „FESTA ITALIANA" | Stimmungsfoto (Abend, Lichterketten, Gäste unscharf), fett-kondensierte Headline, mehrere Textblöcke |

## 4. Die acht Layouts

| Layout | Stil | Schrift | Logo-Ecke | Wofür |
|---|---|---|---|---|
| `klassik` | promo | geometrisch | oben rechts | Allrounder: Headline oben, Gericht unten |
| `promo_poster` | promo | condensed | **unten links** | **neu** — Text links gestapelt, Gericht rechts angeschnitten |
| `menue_karte` | promo | geometrisch | oben rechts | Gericht komplett sichtbar + Zutatenzeile |
| `angebots_sticker` | promo | condensed | oben rechts | Angebot; unten rechts frei für den echten Preis-Badge |
| `produkt_spotlight` | spotlight | geometrisch | oben rechts | **neu** — Aktion/Gutschein mit CTA-Fläche |
| `event_poster` | event | condensed | **unten rechts** | Event/Strassenfest, mehrere Textblöcke |
| `pur` | promo | – | oben rechts | gar kein Text im Bild |
| `zitat` | promo | geometrisch | oben rechts | eine kurze Zeile |

### Logo-Ecke pro Layout

Das Logo wird nicht gemalt, sondern per `editImage` als echte Datei aufkomponiert.
Bisher immer fest auf `(850, 30)` — also oben rechts. Beim `promo_poster` läuft die
Pizza aber genau dort bis in die Ecke, das Logo landete auf der Kruste.

Deshalb ist die Ecke jetzt **pro Layout** wählbar (`layouts[x].logo_ecke`), und beide
Seiten ziehen an derselben Quelle:

- der Prompt reserviert die Ecke (`logo_zone` mit Platzhalter `{ECKE}`)
- `Logo-ID waehlen` rechnet daraus `logo_x`/`logo_y` aus, `Logo einfuegen` stempelt dorthin

Verfügbare Ecken in `cfg.logo_positionen`: `oben_rechts` (850/30), `oben_links` (34/30),
`unten_rechts` (850/840), `unten_links` (34/840) — Werte für 1024×1024 bei 155×155 Logo.

> `unten_rechts` ist bei `angebots_sticker` tabu: dort sitzt der echte Preis-Badge.
> `unten_links` ist bei `produkt_spotlight` und `event_poster` tabu: dort sitzt die CTA-Fläche.

**Vorrangregel.** Layout-Beschreibung und Logo-Ecke können sich widersprechen — genau
daran ist die erste `promo_poster`-Runde gescheitert (Layout sagte „Gericht rechts
angeschnitten", Logo-Zone sagte „Ecke oben rechts frei"; das Modell hat sich für das
schönere Bild entschieden). Deshalb steht jetzt hinter jeder Logo-Zone der Baustein
`logo_vorrang`: die reservierte Ecke schlägt **jede** andere Platzierungsanweisung.
Zusätzlich sind die Layout-Texte so geschärft, dass sie gar nicht erst in die Ecke
zeigen — Headlines sind linksbündig statt zentriert, wo das Logo oben rechts sitzt.

## 5. Neue Agent-Felder

Der Post-Agent liefert jetzt bis zu vier Bildzeilen statt einer. Damit lassen
sich die Referenz-Layouts überhaupt erst nachbauen:

| Feld | Max | Inhalt |
|---|---|---|
| `bild_headline` | 40 | wie bisher |
| `bild_subline` | 60 | **neu** — z.B. `Mortadella - Stracciatella - Pistazie` |
| `bild_infozeile` | 40 | **neu** — Zeitraum/Ort in Versalien, **ohne Ziffern** |
| `bild_cta` | 30 | **neu** — Handlungsaufruf, nur bei `produkt_spotlight` / `event_poster` |

`Post aufbereiten` erzwingt das: ASCII-Filter, Längenkappung, Ziffern in der
Infozeile werden verworfen, CTA ausserhalb der zwei Layouts wird geleert, und
bei `pur` fallen alle vier Zeilen weg.

Preise bleiben **ausserhalb** des Prompts — sie werden weiterhin per `editImage`
als echter Badge aufgestempelt. `text_regel` verbietet dem Modell ausdrücklich
jede Zahl, jedes Prozent- und Währungszeichen.

---

## 6. Prompts testen — ohne Deploy

```bash
node tools/bildprompt_preview.mjs                  # alle 8 Layouts in die Konsole
node tools/bildprompt_preview.mjs promo_poster     # nur eines
node tools/bildprompt_preview.mjs --out prompts/   # zusätzlich als .txt ablegen
```

Das Werkzeug **extrahiert den echten jsCode** aus `workflows/hauptflow.ts` und führt
ihn aus — ohne `--foto` den Node `Gen-Request` (Neu-Generierung), mit `--foto` den
Node `Kombi-Request` (eigenes Foto als Grundlage). Was es ausgibt,
ist Zeichen für Zeichen der Prompt, den n8n später an `gpt-image-1` schickt — es
gibt keine zweite Prompt-Kopie, die auseinanderlaufen könnte.

**Testschleife für den Bild-Look:**
1. `node tools/bildprompt_preview.mjs --out prompts/`
2. Eine `prompts/*.txt` in ChatGPT / den OpenAI-Playground (gpt-image-1, 1024×1024, quality `high`) kippen
3. Gefällt es nicht → nur den betroffenen Baustein in `bild_guideline` bzw. `layouts` in **beiden** Workflow-Dateien ändern
4. Schritt 1 wiederholen, bis der Look sitzt — erst danach deployen

Die Prompts liegen aktuell bei ~4.900–6.400 Zeichen (Limit von `gpt-image-1`:
32.000), es ist also Luft für weitere Bausteine.

---

## 6a. Der Foto-Pfad

Schickt der Wirt ein eigenes Foto mit — oder wählt der Agent ein Archiv-Foto — läuft
das Bild **nicht** über `images/generations`, sondern über `images/edits` (Node
`Kombi-Request`). Der Prompt ist bewusst anders gebaut:

| | Neu-Generierung | Foto-Pfad |
|---|---|---|
| Motiv | `image_brief` beschreibt die Szene | das Foto **ist** die Szene |
| `master` / `stile` / `module` / `foto` | ja | **nein** — würden das Foto umbauen |
| `grading` | nein | ja — nur Look: dunkler, kontrastreicher, gesättigtes Gericht |
| Layout | volle Komposition | **nur der Textplatzierungs-Teil** |
| Typo, Textzeilen, Logo-Ecke, Negativliste | ja | ja |

Zwei Konflikte mussten dafür entschärft werden:

1. **Layout gegen Foto.** Ein Layout wie `promo_poster` schreibt „Gericht rechts
   angeschnitten" vor — das Foto zeigt aber vielleicht eine zentrierte Pizza. Der
   Prompt sagt jetzt ausdrücklich, dass aus der Layout-Beschreibung **nur** die
   Textplatzierung zu übernehmen ist und alles ignoriert wird, was die Bildkomposition
   ändern würde.
2. **Logo-Ecke im Foto.** Ein reales Foto füllt die reservierte Ecke oft schon. Der
   Foto-Pfad erlaubt dem Modell deshalb explizit, dort den Hintergrund sanft zu
   verlängern und abzudunkeln oder den Ausschnitt leicht zu verschieben — aber nie
   das Gericht selbst zu verändern.

> Erwartungshaltung: Der Foto-Pfad ist naturgemäß weniger kontrollierbar als die
> Neu-Generierung. Ist das Gericht auf dem Foto mittig und randlos, kann keine Ecke
> wirklich frei werden. Für solche Fotos ist `klassik` oder `pur` die sicherere Wahl
> als `promo_poster`.

---

## 7. Deploy

Unverändert der Zyklus aus `Pizzarello_Handover.md` — und die Fallstricke gelten
weiter:

```
mcp__n8n__update_workflow  (tzRlOxsLZ8eyCdgT bzw. pNFLlk3GPQO3lcjS, VOLLSTÄNDIGER Code)
mcp__n8n__publish_workflow (sonst läuft weiter die alte Version)
Credentials nachziehen     (update_workflow wirft sie ab — siehe Handover KRITISCH-1)
```

Beide Dateien sind jetzt **komplett ASCII** — auch das Euro-Zeichen in der
Preis-Normalisierung wird nicht mehr als Literal geschrieben, sondern als
`String.fromCharCode(8364)`. Damit kann `update_workflow` beim Deploy nichts
mehr zerstören (Handover-Fallstrick 4).
