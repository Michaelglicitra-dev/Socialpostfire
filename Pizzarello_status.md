# Pizzarello Marketing-Automation — Handoff / Projektstand

> ⚠️ **VERALTET (Stand 22.07.2026).** Diese Datei beschreibt eine **frühere Architektur**
> (Workflow-IDs `I7H3jZEfSEFjE6Q6` / `NFQX1gO8ajKkAypC`, Claude als Text-KI, Freigabe per
> Telegram-Buttons). Diese Workflows sind **nicht mehr die aktiven**.
>
> 👉 **Aktueller Stand: [`Pizzarello_Handover.md`](./Pizzarello_Handover.md)**
> (Workflows `tzRlOxsLZ8eyCdgT` + `pNFLlk3GPQO3lcjS`, OpenAI-only, Freigabe in der Web-App)
>
> Weiter relevant sind hier nur noch die **KRITISCHEN LEKTIONEN** in Abschnitt 5
> (MCP-Fallstricke) — die gelten unverändert.

> Übergabedokument, damit eine neue Claude-Code-Session (z. B. vom iPhone/Cloud) sofort weiterarbeiten kann.
> Voraussetzung: Der **n8n-MCP-Server** muss in der Environment verfügbar sein (Test: „Liste meine n8n-Workflows").
> Stand: 22.07.2026

## 1. Überblick
Restaurant-Social-Media-Automatisierung für die **Pizzeria Pizzarello** (Oberhausen, https://www.pizzarello.net).
Der Besitzer schickt per Telegram formlos ein **Angebot/Event (Text)** oder ein **Foto** → KI (Claude) erstellt einen Post-Text, KI (Bildmodell) erzeugt ein gebrandetes Bild → Freigabe per Telegram-Buttons → Veröffentlichung via Buffer.

## 2. n8n-Instanz & Zugänge
- Instanz: `https://n8n.srv964622.hstgr.cloud` — self-hosted **v2.18.5**, `binaryDataMode: filesystem`
- Telegram-Chat-ID (Besitzer): `7582948490`
- Sende-Bot: `@aicolormemarketing_bot` (ID 8731599524)
- **WICHTIG:** Telegram-file_ids sind **bot-spezifisch** → Trigger-Bot = Download-Bot = Sende-Bot müssen dasselbe Credential nutzen.

## 3. Die zwei Workflows
### A) Pizzarello Marketing Agent — ID `I7H3jZEfSEFjE6Q6` (Haupt-Flow)
- Läuft täglich 09:30 (Säulen-Rotation angebote/saisonal/community) ODER als Sofort-Lauf (Angebot/Foto) via Sub-Workflow-Trigger `Bei Angebot-Eingang`.
- Kette: Config → Angebote/Fotos/Website laden → Kontext → Claude-Prompt → Claude Ideation → Antwort parsen → Bildgenerierung → Logo-Komposition → imgbb → Telegram-Foto+Freigabe (2h-Fenster) → Buffer + Log. Ablehnen → „Neu generieren"-Schleife.
- **ACHTUNG: Der Flow wurde zuletzt weiterentwickelt** (neue Nodes: `GPT-Request Kombi`, `GPT Bild Kombi`, Logo-Overlay per Edit-Image `Logo skalieren`/`Logo einfuegen`, `Bild und Logo buendeln`, `Finalbild extrahieren`, `Bestaetigung senden`, `layouts` in der Config). **Draft ≠ Active** — es gibt unveröffentlichte Änderungen. Vor jeder Änderung `get_workflow_details` frisch ziehen und klären, ob auf Active oder Draft aufgebaut wird!

### B) Pizzarello Telegram-Eingang — ID `NFQX1gO8ajKkAypC`
- Telegram-Trigger, konversationeller Eingang: fragt nach bis Ziel/Zeit/Preis/Foto-Absicht + Layout klar sind, speichert in Data Tables, startet dann den Haupt-Flow.

## 4. Data Tables (Projekt `MdSYddo2rRuyFLoo`)
- `pizzarello_angebote`: `dVJNivQbpA7YUwAm`
- `pizzarello_fotos`: `x7QjV9d9CI0ZgrBz`
- `pizzarello_post_log`: `HAaLrktmGAA8IddT`

## 5. KRITISCHE LEKTIONEN (unbedingt beachten)
- **MCP `update_workflow` zerstört Nicht-ASCII im jsCode** → alle Umlaute als Unicode-Escapes schreiben (`\u00e4`=ä, `\u00f6`=ö, `\u00fc`=ü, `\u00df`=ß, `\u00c4/\u00d6/\u00dc`=Ä/Ö/Ü).
- `update_workflow` **ersetzt den kompletten Workflow** und **wirft HTTP-Credentials ab** → immer ALLE Nodes/Zweige mitgeben; nach dem Update alle HTTP-Credentials (Anthropic, OpenAI, imgbb, Buffer, Gemini) neu anhängen.
- **Draft ≠ Active**: nach `update_workflow` ist es nur Draft → `publish_workflow` nötig, sonst läuft Produktion weiter auf der alten Version.
- **Telegram-Send-Nodes**: NICHT mit `resource:'chat'`+`messageType` bauen (Importer wirft `text` weg). Nur `chatId`/`text`/`additionalFields{parse_mode:'HTML'}`.
- **`getBinaryDataBuffer` muss direkt nach dem Telegram-Download** laufen — ein IF/Set dazwischen bricht im filesystem-Modus die Binär-Referenz.
- **Modelle:** `gemini-2.5-flash` ist für neue Nutzer abgeschaltet → `gemini-flash-latest`. Bild-Generierung wurde testweise auf **`gpt-image-1`** umgestellt (teurer, ~4x); Bild-Modell `gemini-2.5-flash-image` läuft offiziell bis 02.10.2026, Nachfolger `gemini-3.1-flash-image-preview`.
- **Claude (Sonnet 5)** hat adaptive Thinking per Default → im Request `thinking:{type:'disabled'}` setzen; Antwort-Parser sammelt ALLE `text`-Blöcke.
- **Data-Table-Date-Spalten** kommen als UTC-ISO → mit Luxon nach `Europe/Berlin` konvertieren (Off-by-one!).

## 6. Deliverables / Referenzen (OneDrive)
- `OneDrive/Pizzarello/Pizzarello_Workflow_Spec.md`
- `OneDrive/Pizzarello/Pizzarello_Doku_NeuerKunde.md`
- Logo: `OneDrive/Pizzarello/assets/logo_pizzarello.png`

---
*Nächster sinnvoller Einstieg: den Telegram-Bug (5.1) anhand echter Execution-Daten fixen, dann die zwei Feedback-Punkte (5.2 Textvariation, 5.3 hellerer/fröhlicher Bildstil) umsetzen.*
