# Altstand — nicht mehr in Betrieb

Diese Dateien beschreiben **frühere Architekturen** und laufen nicht mehr:

| Datei | Was | Status |
|---|---|---|
| `workflows/hauptflow.ts` | Marketing Agent v2 (`tzRlOxsLZ8eyCdgT`) | inaktiv, verworfen |
| `workflows/webapp.ts` | Web-App (`pNFLlk3GPQO3lcjS`) | inaktiv, verworfen |
| `Pizzarello_Handover.md` | Übergabe zur Web-App-Architektur | überholt |
| `Pizzarello_status.md` | noch ältere Architektur | überholt |
| `Prompt_Neuaufbau_Telegram.md` | Bau-Auftrag für den Telegram-Neubau | umgesetzt |
| `prompts/`, `tools/bildprompt_preview.mjs` | v3-Prompts gegen den Altstand | ersetzt durch `bot/` |

Die Web-App wurde verworfen; die Freigabe läuft wieder komplett über Telegram.
Zugangscode und VAPID-Schlüssel aus dem Handover werden nicht mehr gebraucht.

👉 **Aktueller Stand: [`bot/`](./bot/)** — Live-Workflow `Pizzarello Bot` (`B7LuGXIaNnPC5ulk`).

Der Altstand bleibt im Repo, weil die Bild-Guideline v3 dort entwickelt wurde und die
Prompt-Bausteine sich eins zu eins vergleichen lassen.
