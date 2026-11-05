# Einstieg für eine neue Claude-Code-Session

Diesen Text als erste Nachricht in eine frische Session geben. Er reicht, um sofort
arbeitsfähig zu sein.

---

## Was das hier ist

Ein Telegram-Bot, der für einen Betrieb täglich einen fertigen Social-Media-Post vorschlägt
(Text + gebrandetes Bild), ihn per Knopfdruck freigeben lässt und über Buffer ausspielt.
Gebaut als **ein n8n-Workflow mit 87 Nodes**. Produktiv für die Pizzeria Pizzarello.

Das Ziel ist ein **klonbares Produkt**: pro Kunde eine JSON-Datei, daraus erzeugt ein
Generator den fertigen Workflow.

## Zuerst lesen

| Datei | Inhalt |
|---|---|
| [`ARCHITEKTUR.md`](./ARCHITEKTUR.md) | Wie der Bot funktioniert, alle 87 Nodes, Datenmodell, Fallstricke |
| [`bot/README.md`](./bot/README.md) | Bildsprache v3: Guideline, Layouts, Formate, Prompt-Aufbau |
| [`LEGACY.md`](./LEGACY.md) | Welche Dateien **veraltet** sind — nicht darauf aufbauen |

Die Dateien `Pizzarello_Handover.md`, `Pizzarello_status.md`, `Prompt_Neuaufbau_Telegram.md`
und `workflows/*.ts` beschreiben **verworfene** Architekturen. Sie liegen nur noch zum
Nachschlagen im Repo.

## Verzeichnisse

```
ARCHITEKTUR.md                      maßgebliche Doku
bot/
  template/branchen/<branche>.json  Bildsprache: Guideline, Layouts  <- das Produkt
  template/formate.json             Leinwaende (branchenneutral)
  template/Restaurant-Konfiguration.template.js
  kunden/<kunde>.json               Stammdaten, Marke, Kanaele, Tabellen-IDs
  kunden/_vorlage.json              leere Kundendatei
  kunden/<kunde>/                   erzeugt: Import-JSON + Node-Dateien
  build-kunde.mjs                   Generator
  pruefe.mjs                        Tests
  preview.mjs                       rendert Bild-Prompts ohne n8n
  live/Pizzarello-Bot-v3.import.json  Vorlage, aus der generiert wird
  steckbrief/index.html             gefuehrte Einrichtungsstrecke fuer den Kunden
  nodes/                            gepflegte Einzel-Nodes (Pizzarello)
```

## Befehle

```bash
node bot/pruefe.mjs                  # alle Kunden pruefen (immer vor dem Commit)
node bot/build-kunde.mjs <kunde>     # Workflow fuer einen Kunden erzeugen
node bot/preview.mjs --tag 3         # Bild-Prompts, Wochentag 3
node bot/preview.mjs --foto          # Prompts des Foto-Pfads
node bot/build-workflow-json.mjs     # Pizzarello-Vorlage aus bot/nodes/ neu bauen
```

## Arbeitsweise, die sich bewährt hat

**Prompts ändern, ohne zu deployen.** `bot/preview.mjs` führt den echten Node-Code aus und
gibt den Prompt aus, den n8n an `gpt-image-1` schickt. Prompt in ChatGPT testen, Baustein
anpassen, neu rendern — erst wenn der Look sitzt, einspielen.

**Nie über MCP deployen.** `update_workflow` ersetzt den kompletten Workflow und wirft alle
Credentials ab. Geändert wird **Node für Node in der n8n-Oberfläche**; die Textdateien dafür
liegen unter `bot/kunden/<kunde>/nodes/`.

**Widersprüche im Prompt sind die häufigste Fehlerquelle.** Dreimal ist dasselbe passiert:
zwei Anweisungen kollidierten, und das Bildmodell folgte der stärkeren statt der gemeinten.
Wenn zwei Anweisungen kollidieren können, muss eine ausdrücklich Vorrang bekommen. Flächen
gehören in Prozent, nicht als „Ecke".

## Einen neuen Kunden aufsetzen

1. Kunden durch `bot/steckbrief/index.html` schicken (acht Schritte, erklaert jeden
   Dienst) → am Ende kopiert er die Kundendatei als JSON und schickt sie zurueck
2. Als `bot/kunden/<id>.json` ablegen
3. In n8n sechs Data Tables **leer** anlegen (Spalten: `ARCHITEKTUR.md`, Abschnitt 3), IDs eintragen
4. `node bot/build-kunde.mjs <id>`
5. Import-JSON in n8n importieren — **als neuen Workflow**
6. Credentials zuordnen; in den Einstellungen *Error Workflow* und MCP-Zugriff setzen
   (der Import überträgt beides **nicht**)
7. Telegram-Bot anlegen, Token hinterlegen
8. Speisekarte und Fotoarchiv über die Indexer-Workflows befüllen
9. Testnachricht, dann publishen

## Eine neue Branche aufnehmen

`bot/template/branchen/gastronomie.json` kopieren und die rund 30 gastronomiespezifischen
Begriffe ersetzen (Gericht, Kruste, Teig, Steinofen, Speisekarte). Struktur und Layouts
bleiben. Danach in der Kundendatei `"branche": "<neue-branche>"` setzen.

Nicht vergessen: die System Message des `Post-Agent` ist ebenfalls gastronomiegeprägt
(„Wirt", „Speisekarte", „Gericht") und gehört mittelfristig ins Branchen-Profil.

## Offene Punkte

- Die Agent-System-Message steckt noch in der Vorlage statt im Branchen-Profil
- Der `Pizzarello Fehler-Melder` ist ein eigener Workflow mit fest eingetragener Chat-ID;
  für einen zweiten Kunden braucht er entweder eine Kopie oder eine Fallunterscheidung
- `imgbb hochladen` schickt das Bild als Base64 in einem form-urlencoded Body. Es gab
  einmal einen 500er; eine Umstellung auf Multipart wäre robuster, ist aber unbelegt nötig
