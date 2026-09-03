# Fix: "Bild extrahieren" bricht ab - Invalid image file or mode for image 1

**Workflow:** Pizzarello Bot (`B7LuGXIaNnPC5ulk`)
**Fehler vom:** 03.09.2026, 07:30:41 UTC = 09:30:41 Uhr Berlin (Zeitstempel 1788420641195) - also exakt der taegliche Auto-Post um 09:30 Uhr, nicht eine Telegram-Eingabe
**Meldung:** `Die Bild-KI hat keinen Bilddatensatz geliefert. Details: {"error":{"message":"Bad request - please check your parameters", ... "description":"Invalid image file or mode for image 1 ..."}}`

## Was wirklich passiert ist

Die Fehlermeldung kam aus dem Node **Bild extrahieren**, die Ursache lag aber zwei
Nodes davor. Der betroffene Pfad:

```
Taeglich 09:30 -> Tagespost-Auftrag -> ... -> Post-Agent -> Post aufbereiten
   -> Bild-Modus            (waehlt post.archiv_foto_url als Bildgrundlage)
   -> Logo laden
   -> Mit Basisfoto?        (true, weil ein Archiv-Foto gewaehlt wurde)
   -> Basisfoto laden       (laedt die Archiv-URL als Binary "basis")
   -> Bild-Request bauen (Foto)
   -> GPT Bild (Foto)       POST https://api.openai.com/v1/images/edits
   -> Bild extrahieren      <- hier ist der Flow abgebrochen
```

`GPT Bild (Foto)` steht auf `onError: continueRegularOutput`. Der Node ist also
nicht selbst rot geworden, sondern hat die Fehlerantwort von OpenAI als normales
Item weitergereicht. Erst `Bild extrahieren` hat daraus einen Abbruch gemacht -
mit dem generischen Satz "Die Bild-KI hat keinen Bilddatensatz geliefert".

Die eigentliche Aussage von OpenAI steckte in `description`:

> Invalid image file or mode for image 1

Das ist die Antwort von `/v1/images/edits`, wenn die im Multipart-Feld `image[]`
hochgeladene Datei nicht als Bild gelesen werden kann. Drei Dinge loesen das aus,
und alle drei waren im Flow moeglich:

1. **Format wird nicht unterstuetzt.** `/v1/images/edits` akzeptiert nur PNG, JPEG
   und WEBP. Die Archiv-Fotos landen ueber den *Pizzarello Foto-Archiv Indexer*
   aus einem OneDrive-Ordner bei imgbb - und dort wird das Originalformat
   behalten. GIF, BMP, TIFF, HEIC (iPhone-Standard) oder AVIF kommen so
   unveraendert bis zu OpenAI durch und werden abgelehnt.
2. **Kein Dateiname / kein Content-Type im Multipart-Teil.** `Basisfoto laden`
   holt die Datei mit `responseFormat: file`. Leitet n8n aus der URL keinen
   Dateinamen ab (kein `Content-Disposition`, keine Endung im Pfad), geht der
   Upload ohne `filename` und mit `application/octet-stream` raus. OpenAI kann das
   Format dann nicht bestimmen und antwortet mit genau dieser Meldung.
3. **Der Link liefert gar kein Bild.** Steht im Bildarchiv statt des direkten
   Bild-Links eine Vorschauseite (`ibb.co/...` statt `i.ibb.co/...`), kommt eine
   HTML-Seite mit Status 200 an. `Basisfoto laden` laeuft sauber durch, OpenAI
   bekommt HTML und lehnt ab.

Zusaetzlich hat `Bild extrahieren` alle Fehlerarten in denselben Satz gepackt.
Deshalb war aus der Telegram-Meldung nicht zu erkennen, dass es am Basisfoto lag
und nicht an der Bild-KI.

## Der Fix

Vier Aenderungen, alle im Workflow *Pizzarello Bot*:

| # | Node | Aenderung |
|---|------|-----------|
| 1 | **Basisfoto pruefen** (neu, Code) | Prueft die geladene Datei an den Magic Bytes. Kein Bild (HTML/JSON/leer) oder HEIC/AVIF -> Abbruch mit Klartext-Meldung inklusive der Quell-URL, statt eines unverstaendlichen OpenAI-Fehlers. |
| 2 | **Basisfoto normalisieren** (neu, Edit Image) | Rechnet das Basisfoto verlustfrei in ein PNG um und begrenzt es auf max. 1536 px Kantenlaenge. Damit werden GIF/BMP/TIFF/WEBP-Archivfotos zu einem Format, das die Bild-KI sicher annimmt, und zu grosse OneDrive-Originale schrumpfen auf ein sinnvolles Mass. `onlyIfLarger` laesst kleinere Bilder unangetastet - der Aenderungswunsch-Pfad (1024x1536) verliert also keine Qualitaet. |
| 3 | **Bild-Request bauen (Foto)** (geaendert) | Setzt auf dem Binary `image0` jetzt explizit `fileName` (`basisfoto.png`), `fileExtension` und `mimeType`, nachdem es das Format nochmal an den Magic Bytes geprueft hat. Damit geht der Multipart-Teil `image[]` immer mit gueltiger Endung und korrektem Content-Type raus. Der Prompt-Aufbau ist unveraendert (Zeile fuer Zeile identisch mit vorher). |
| 4 | **Bild extrahieren** (geaendert) | Unterscheidet jetzt Moderation, ungueltiges Basisfoto, Rate-Limit und Timeout und meldet jeden Fall im Klartext - beim Basisfoto-Fehler samt der Bildquelle, die ihn ausgeloest hat. |

## Anwenden

Der n8n-MCP-Zugang kann nur ganze Workflows als SDK-Code ersetzen, nicht einzelne
Nodes patchen - und laut `Pizzarello_status.md` (Abschnitt 5, Kritische Lektionen)
wirft `update_workflow` dabei die HTTP-Credentials ab und setzt den Workflow auf
Draft zurueck. Fuer eine Aenderung an drei Nodes waere das ein unnoetiges Risiko
fuer den laufenden Bot. Darum diese vier Schritte im n8n-Editor:

1. **Neue Nodes einfuegen:** `neue-nodes.json` komplett kopieren und im geoeffneten
   Workflow *Pizzarello Bot* auf die Canvas einfuegen (Strg+V). Es erscheinen
   *Basisfoto pruefen* und *Basisfoto normalisieren*, bereits miteinander
   verbunden, oberhalb von *Basisfoto laden*.
2. **Umhaengen:** Die Verbindung *Basisfoto laden -> Bild-Request bauen (Foto)*
   loeschen und stattdessen verbinden:
   `Basisfoto laden -> Basisfoto pruefen -> Basisfoto normalisieren -> Bild-Request bauen (Foto)`
3. **Code ersetzen:** Inhalt von `bild-request-bauen-foto.js` in den Node
   *Bild-Request bauen (Foto)* und Inhalt von `bild-extrahieren.js` in den Node
   *Bild extrahieren* einsetzen (jeweils den kompletten bisherigen Code ersetzen).
4. **Speichern und testen:** Workflow speichern, dann den Zweig *Taeglich 09:30*
   einmal manuell ausfuehren.

`neue-nodes.json` wird aus `basisfoto-pruefen.js` erzeugt - nach einer Aenderung am
JS neu bauen mit:

```
node build-nodes-json.mjs
```

## Was danach noch passieren kann - und was die Meldung dann heisst

| Meldung im Telegram | Bedeutung | Was zu tun ist |
|---|---|---|
| "Der Bild-Link liefert kein Bild, sondern etwas anderes" | Im Bildarchiv steht eine Vorschauseite statt des direkten Links | In `pizzarello_fotos` den `i.ibb.co/...`-Link eintragen |
| "Das Basisfoto ist ein HEIC/AVIF-Bild" | iPhone-Foto im OneDrive-Ordner | Foto als JPG/PNG neu ablegen und den Foto-Archiv-Indexer nochmal laufen lassen |
| "Die Bild-KI konnte das Basisfoto nicht lesen" | OpenAI lehnt trotz Normalisierung ab | Genannte Bildquelle pruefen - meist ein defektes Original |
| "Die Bild-KI hat das Motiv abgelehnt (Moderation)" | Prompt/Motiv wurde blockiert | Motiv anders beschreiben |

## Empfehlung fuers Bildarchiv

Der *Pizzarello Foto-Archiv Indexer* uebernimmt bisher jedes Format, das OneDrive
liefert (`Nur Bilder` filtert nur auf `image/*`). Sinnvoll waere dort dieselbe
Einschraenkung wie hier: nur `image/png`, `image/jpeg` und `image/webp` ins Archiv
aufnehmen. Dann kommen unpassende Formate gar nicht erst in die Tabelle.
