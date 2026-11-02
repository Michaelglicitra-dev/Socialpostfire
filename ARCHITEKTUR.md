# Social-Media-Bot — Architektur und Betrieb

> Stand: 02.11.2026 · Dies ist die **maßgebliche** Dokumentation. Ältere Dateien
> (`Pizzarello_Handover.md`, `Pizzarello_status.md`, `workflows/*.ts`) beschreiben verworfene
> Architekturen — siehe [`LEGACY.md`](./LEGACY.md).

Ein Telegram-Bot, der für einen Betrieb täglich einen fertigen Social-Media-Post vorschlägt
(Text + gebrandetes Bild), ihn per Knopfdruck freigeben lässt und terminiert ausspielt.
Der Betreiber kann jederzeit selbst einen Post anstoßen — per Chat-Nachricht oder eigenem Foto.

---

## 1. Überblick

**Ein n8n-Workflow, 87 Nodes.** Produktiv für Pizzarello (Oberhausen) unter dem Namen
`Pizzarello Bot v3`. Einzige KI: OpenAI — `gpt-5-mini` für Text, `gpt-image-1` für Bilder.

| Bestandteil | Technik |
|---|---|
| Eingang | Telegram-Trigger + Schedule-Trigger (täglich 09:30) |
| Gesprächszustand | n8n Data Table, **nicht** ein laufender Wait-Node |
| Textgenerierung | LangChain-Agent mit vier Data-Table-Tools und Structured Output |
| Bildgenerierung | `gpt-image-1`, Logo und Preis-Badge werden real aufkomponiert |
| Freigabe | Telegram-Inline-Buttons |
| Ausspielung | Buffer (GraphQL) |
| Fehler | eigener Workflow `Pizzarello Fehler-Melder` als Error-Workflow |

**Die zentrale Entwurfsentscheidung:** Jede eingehende Nachricht und jeder Button-Tap startet
eine **eigene, kurze Execution**. Der Zustand liegt in der Data Table `sessions`, nicht in einer
laufenden Execution. Dadurch überlebt das Gespräch Neustarts, kann beliebig lange pausieren, und
Freitext funktioniert gleichberechtigt neben Buttons.

```
Nachricht/Button → Execution startet → Zustand laden → handeln → antworten
                 → Zustand speichern → Execution ENDET
```

---

## 2. Ablauf

### 2.1 Eingang und Weiche

```
Telegram Eingang ─┐
                  ├→ Eingang → Restaurant-Konfiguration → Session laden → Router → Zweig waehlen
Taeglich 09:30 ───┘
```

`Router` entscheidet anhand von Session-Zustand und Nachrichtentyp über eine von sechs Routen:

| Route | Bedingung | Ziel |
|---|---|---|
| 0 | Button-Tap | `Callback bestaetigen` → `Callback-Aktion` |
| 1 | Session ist `BUSY` | `Bin beschaeftigt` |
| 2 | Foto empfangen | `Eingangsfoto hochladen` → `Foto-Auftrag` |
| 3 | Text empfangen | `Text-Auftrag` |
| 4 | Schedule | `Tagespost-Auftrag` |
| 5 | sonst (fremder Chat, toter Entwurf) | `Ignorieren` |

**BUSY-Notbremse:** Ein `BUSY`, dessen Zeitstempel älter als zehn Minuten ist, gilt als
abgelaufen und wird wie `IDLE` behandelt. Ohne diese Regel sperrte ein abgebrochener Lauf den
Bot dauerhaft.

### 2.2 Session-Zustände

| Zustand | Bedeutung | Gesetzt von |
|---|---|---|
| `IDLE` | bereit | `Session zuruecksetzen` |
| `BUSY` | ein Lauf arbeitet | `Status BUSY setzen` |
| `AWAITING_ANSWER` | Agent hat eine Rückfrage gestellt | `Session AWAITING_ANSWER` |
| `DRAFT_OPEN` | Entwurf liegt zur Freigabe | `Session DRAFT_OPEN` |

Bei `DRAFT_OPEN` ist **Freitext ein Änderungswunsch** — der Betreiber muss keinen Button drücken.

### 2.3 Textgenerierung

```
Auftrag → Website laden → Feiertage laden → Kontext → Post-Agent → Rueckfrage noetig?
                                                                   ├true→ Rueckfrage senden
                                                                   └false→ Post aufbereiten
```

Der `Post-Agent` hat vier Unter-Nodes als Werkzeuge (`get_learnings`, `get_aktuelle_angebote`,
`get_speisekarte`, `get_bildarchiv`), ein Gesprächs-Memory auf die Chat-ID gekeyt, und
`Post-Schema` als Structured-Output-Parser.

**Agent-Ausgabe:** `needs_clarification`, `clarification_question`, `headline`, `post_text`,
`hashtags[]`, `layout`, `bild_typ`, `bild_neu`, `bild_headline`, `bild_subline`,
`bild_infozeile`, `bild_cta`, `image_brief`, `preis_text`, `archiv_foto_url`.

`Post aufbereiten` validiert: Layout-Whitelist, Bildzeilen auf ASCII und Länge, keine Ziffern in
der Infozeile, CTA nur bei zwei Layouts, Preis-Normalisierung nach `€`, Hashtag-Merge.

### 2.4 Bildpipeline

```
Bild-Modus ──generate──→ Bild-Request bauen (Neu)  → GPT Bild (Neu)   ┐
           └─edit──→ Basisfoto laden → Basisfoto pruefen/normalisieren │
                   → Bild-Request bauen (Foto) → GPT Bild (Foto)      ┘
                                                                       ↓
   Bild extrahieren → Logo laden → Logo buendeln → Logo skalieren → Logo einfuegen
   → Preis-Badge? → Preis-Badge stempeln → Finalbild extrahieren → imgbb hochladen
   → Entwurf-Daten bauen → Entwurf-Foto senden → Session DRAFT_OPEN
```

Drei Bildmodi, entschieden in `Bild-Modus`:

| Modus | Wann | Verhalten |
|---|---|---|
| `generate` | kein Basisfoto, oder `bild_typ = flyer` | Bild wird neu erzeugt |
| `edit_url` | eigenes Foto oder Archivfoto | Foto wird veredelt, Motiv bleibt |
| `anpassung` | Änderungswunsch zu offenem Entwurf | nur die gewünschte Änderung |

Details zur Bildsprache: [`bot/README.md`](./bot/README.md).

### 2.5 Freigabe und Ausspielung

```
Callback-Aktion ──ok──→ Freigabe vorbereiten → Braucht Hochformat?
                        ├true→ Hochformat Hintergrund/Vordergrund/komponieren → imgbb Hochformat
                        └─────→ Buffer-Requests bauen → Buffer Post planen
                                → Log schreiben → Freigabe bestaetigen → Session zuruecksetzen
                ──neu─→ Variante-Auftrag  (zurück zum Agenten, bild_neu=true)
                ──weg─→ Verwurf-Daten → Verwurf loggen → Verwurf bestaetigen
```

Bei Ablehnung mit Begründung läuft zusätzlich die **Lernschleife**:
`Bewertungs-Anfrage → Learning bewerten → Learning parsen → Dauerhaft? → Learning speichern`.
Gespeicherte Learnings liest der Agent beim nächsten Post über `get_learnings`.

---

## 3. Daten

Sechs Data Tables, alle auf die Chat-ID bzw. den Betrieb bezogen:

| Tabelle | Zweck | Gepflegt von |
|---|---|---|
| `sessions` | Gesprächszustand, offener Entwurf | Bot selbst |
| `speisekarte` | echte Gerichte, Zutaten, Preise | Workflow `Speisekarte Indexer` (PDF → OpenAI) |
| `angebote` | aktuelle Aktionen und Preise | von Hand |
| `fotos` | Bildarchiv mit `url`, `kategorie`, `beschreibung` | Workflow `Foto-Archiv Indexer` (OneDrive → Vision) |
| `learnings` | dauerhafte Stil-Regeln aus Ablehnungen | Lernschleife |
| `post_log` | was wann wohin ging | Bot selbst |

Zwei Hilfs-Workflows befüllen Speisekarte und Fotoarchiv und werden **von Hand** ausgelöst,
wenn sich etwas ändert.

### Spalten

Alle Spalten sind vom Typ **String**, außer wo anders vermerkt. Beim Anlegen für einen neuen
Kunden werden die Tabellen **leer** erzeugt — niemals Pizzarellos Tabellen kopieren, sonst
wandern dessen Sessions, Learnings und Log-Einträge mit.

**`sessions`** — der Bot schreibt und liest, gefiltert nach `chat_id`

| Spalte | Inhalt |
|---|---|
| `chat_id` | Telegram-Chat-ID des Betreibers |
| `state` | `IDLE`, `BUSY`, `AWAITING_ANSWER`, `DRAFT_OPEN` |
| `post_id` | ID des offenen Entwurfs |
| `draft_json` | der Entwurf als JSON-String |
| `photo_url` | zuletzt geschicktes Foto |
| `last_message_id` | für das Nachfassen in Telegram |
| `updated` | ISO-Zeitstempel, Grundlage der BUSY-Notbremse |

**`learnings`** — Lernschleife schreibt, Agent liest

| Spalte | Inhalt |
|---|---|
| `saeule` | zu welchem Thema die Regel gilt |
| `kind` | Art der Regel |
| `reason` | Begründung des Betreibers |
| `learning` | die Regel selbst |
| `aktiv` | **Boolean** |

**`post_log`** — nur geschrieben, zur Nachvollziehbarkeit

`datum`, `saeule`, `headline`, `post_text`, `hashtags`, `image_url`, `status`,
`buffer_ids`, `kanaele`, `geplant_fuer`

**`speisekarte`** — vom Indexer befüllt, Agent liest

`kategorie`, `name`, `beschreibung`, `preis`, `aktiv` (**Boolean**)

**`fotos`** — vom Indexer befüllt, Agent liest

`url`, `kategorie`, `beschreibung`, `aktiv` (**Boolean**)

**`angebote`** — von Hand gepflegt, Agent liest

`typ`, `titel`, `beschreibung`, `preis`, `gueltig_von`, `gueltig_bis`, `aktiv` (**Boolean**)

> Die Spaltennamen der drei gelesenen Tabellen stehen so in den Beschreibungen der
> Agent-Tools (`get_speisekarte`, `get_bildarchiv`, `get_aktuelle_angebote`). Weicht eine
> Tabelle davon ab, sucht der Agent ins Leere, ohne dass ein Fehler auftritt.

---

## 4. Mandantenfähigkeit

Die Bildsprache ist das Produkt, die Kundendaten sind austauschbar. Der Code ist entsprechend
dreigeteilt:

```
bot/template/branchen/<branche>.json   Bildsprache: Guideline, Layouts, Saeulen
bot/template/formate.json              Leinwaende (branchenneutral)
bot/kunden/<kunde>.json                Stammdaten, Marke, Kanaele, Tabellen-IDs
```

Der Generator setzt daraus den fertigen Workflow zusammen:

```bash
node bot/build-kunde.mjs <kunden-id>     # erzeugt bot/kunden/<id>/
node bot/pruefe.mjs                      # prueft alle Kunden
```

Er tauscht automatisch: den Config-Node, **alle zwölf Data-Table-Referenzen**, die
Telegram-Chat-ID und den Workflow-Namen. Ergebnis sind eine Import-JSON und die acht Node-Dateien
zum Einspielen von Hand.

**Regressionsschutz:** `bot/pruefe.mjs` vergleicht den generierten Pizzarello-Config-Node an
allen sieben Wochentagen mit dem gepflegten Live-Node. Weichen sie ab, ist die Zerlegung kaputt.

Eine neue Branche ist eine neue Datei unter `bot/template/branchen/`. Die Gastronomie-Fassung
enthält rund 30 branchenspezifische Begriffe (Gericht, Kruste, Teig, Steinofen) — für eine andere
Branche werden die ersetzt, die Struktur bleibt.

---

## 5. Einen neuen Kunden aufsetzen

1. **Formblatt ausfüllen lassen** → liefert die Kundendatei als JSON
2. `bot/kunden/<id>.json` ablegen (Vorlage: `bot/kunden/_vorlage.json`)
3. In n8n **sechs Data Tables anlegen** und ihre IDs in die Kundendatei eintragen
4. `node bot/build-kunde.mjs <id>` ausführen
5. Import-JSON in n8n importieren — **als neuen Workflow**, nicht ins Canvas einfügen
6. Nach dem Import von Hand: **Credentials zuordnen** und in den Workflow-Einstellungen
   *Error Workflow* und MCP-Zugriff setzen (der Import überträgt beides nicht)
7. Telegram-Bot anlegen, Token als Credential hinterlegen, Chat-ID prüfen
8. Speisekarte und Fotoarchiv über die beiden Indexer-Workflows befüllen
9. Testnachricht schicken, dann publishen

---

## 6. Fallstricke (teuer gelernt)

| Fallstrick | Wirkung |
|---|---|
| `update_workflow` über MCP wirft **alle Credentials** ab | Flow bricht still ab |
| Nicht-ASCII im `jsCode` wird dabei zerstört | Umlaute als `String.fromCharCode` schreiben |
| **Import überträgt Workflow-Einstellungen nicht** | kein Error-Workflow → BUSY-Sperre bleibt |
| Draft ≠ Active | ohne Publish läuft die alte Version weiter |
| `get_execution` scheitert an Bilddaten | Executions mit Bildern sind über MCP nicht lesbar |
| Widersprüchliche Prompt-Anweisungen | das Bildmodell folgt der stärkeren, nicht der gemeinten |

Der letzte Punkt ist der häufigste Fehler und steckte bereits dreimal im selben Prompt:
Logo-Ecke gegen Bildaufteilung, Änderungswunsch gegen „behalte alles", Preis-Badge gegen
Layout. **Regel:** Wenn zwei Anweisungen kollidieren können, muss eine ausdrücklich Vorrang
bekommen — und Flächen gehören in Prozent, nicht als „Ecke".
