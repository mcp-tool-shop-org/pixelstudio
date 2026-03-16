<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="../../assets/logo.png" alt="GlyphStudio MCP Server" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/glyphstudio/actions"><img src="https://img.shields.io/github/actions/workflow/status/mcp-tool-shop-org/glyphstudio/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/MCP-53%20tools-blueviolet?style=flat-square" alt="53 MCP Tools">
  <img src="https://img.shields.io/badge/tests-100%20passing-brightgreen?style=flat-square" alt="Tests">
</p>

# @glyphstudio/mcp-sprite-server

Server MCP che espone l'editor di sprite di GlyphStudio come una superficie programmabile per i modelli linguistici di grandi dimensioni (LLM). Crea documenti, disegna pixel, gestisci fotogrammi e livelli, controlla la riproduzione: tutto tramite strumenti del [Model Context Protocol](https://modelcontextprotocol.io/) che interagiscono con la logica e lo stato reali. Nessuna implementazione rasterizzata, nessun universo parallelo.

## Perché

I modelli linguistici di grandi dimensioni (LLM) possono descrivere gli sprite, ma non possono disegnarli. Questo server colma questa lacuna: un agente chiama `sprite_draw_pixels` con coordinate e colori, e il motore GlyphStudio reale applica questi valori a un buffer di pixel reale, con funzionalità di annullamento, livelli e isolamento dei fotogrammi. Il risultato è un file `.glyph` che puoi aprire nell'editor desktop e continuare a modificare manualmente.

## Guida rapida

### Claude Desktop / Claude Code

Aggiungi alla tua configurazione MCP (`claude_desktop_config.json` o `.mcp.json`):

```json
{
  "mcpServers": {
    "glyphstudio": {
      "command": "npx",
      "args": ["tsx", "packages/mcp-sprite-server/src/cli.ts"],
      "cwd": "/path/to/glyphstudio"
    }
  }
}
```

### stdio (diretto)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Inventario degli strumenti (53 strumenti)

### Sessione (3)

| Strumento | Descrizione |
|------|-------------|
| `sprite_session_new` | Crea una nuova sessione di editing |
| `sprite_session_list` | Elenca le sessioni attive |
| `sprite_session_close` | Elimina una sessione e libera la sua memoria |

### Documento (5)

| Strumento | Descrizione |
|------|-------------|
| `sprite_document_new` | Crea un documento vuoto (nome, larghezza, altezza) |
| `sprite_document_open` | Carica un file `.glyph` da JSON |
| `sprite_document_save` | Serializza il documento come JSON `.glyph` |
| `sprite_document_close` | Chiudi il documento senza eliminare la sessione |
| `sprite_document_summary` | Ottieni un riepilogo strutturato del documento (fotogrammi, livelli, dimensioni) |

### Fotogramma (4)

| Strumento | Descrizione |
|------|-------------|
| `sprite_frame_add` | Aggiungi un nuovo fotogramma dopo il fotogramma attivo |
| `sprite_frame_remove` | Rimuovi un fotogramma per ID |
| `sprite_frame_set_active` | Imposta il fotogramma attivo tramite indice |
| `sprite_frame_set_duration` | Imposta la durata del fotogramma in millisecondi |

### Livello (5)

| Strumento | Descrizione |
|------|-------------|
| `sprite_layer_add` | Aggiungi un nuovo livello vuoto al fotogramma attivo |
| `sprite_layer_remove` | Rimuovi un livello per ID |
| `sprite_layer_set_active` | Imposta il livello attivo per il disegno |
| `sprite_layer_toggle_visibility` | Attiva/disattiva la visibilità del livello |
| `sprite_layer_rename` | Rinomina un livello |

### Palette (4)

| Strumento | Descrizione |
|------|-------------|
| `sprite_palette_set_foreground` | Imposta l'indice del colore di primo piano |
| `sprite_palette_set_background` | Imposta l'indice del colore di sfondo |
| `sprite_palette_swap` | Inverti i colori di primo piano e di sfondo |
| `sprite_palette_list` | Elenca tutti i colori della palette con i valori RGBA |

### Disegno / Raster (5)

| Strumento | Descrizione |
|------|-------------|
| `sprite_draw_pixels` | Disegna in batch pixel — array `[{x, y, rgba}]`, crea una copia del buffer |
| `sprite_draw_line` | Linea di Bresenham tra due punti |
| `sprite_fill` | Riempimento continuo da un pixel seme |
| `sprite_erase_pixels` | Elimina in batch i pixel per renderli trasparenti |
| `sprite_sample_pixel` | Leggi i valori RGBA di un pixel in una coordinata (senza modifiche) |

### Selezione / Clipboard (9)

| Strumento | Descrizione |
|------|-------------|
| `sprite_selection_set_rect` | Crea una selezione rettangolare |
| `sprite_selection_clear` | Cancella il contorno di selezione (i pixel non vengono modificati) |
| `sprite_selection_get` | Ottieni il rettangolo e le dimensioni della selezione corrente |
| `sprite_selection_copy` | Copia la selezione nel buffer degli appunti |
| `sprite_selection_cut` | Taglia la selezione (copia e poi elimina i pixel) |
| `sprite_selection_paste` | Incolla gli appunti come selezione fluttuante in (0,0) |
| `sprite_selection_flip_horizontal` | Inverti orizzontalmente il contenuto della selezione |
| `sprite_selection_flip_vertical` | Inverti verticalmente il contenuto della selezione |
| `sprite_selection_commit` | Applica la selezione fluttuante al livello attivo |

### Impostazioni dello strumento (10)

| Strumento | Descrizione |
|------|-------------|
| `sprite_tool_set` | Cambia strumento (matita / gomma / riempimento / contagocce / selezione) |
| `sprite_tool_get` | Ottieni la configurazione corrente dello strumento |
| `sprite_tool_set_brush_size` | Imposta il diametro del pennello (1–64) |
| `sprite_tool_set_brush_shape` | Imposta la forma del pennello (quadrato / cerchio) |
| `sprite_tool_set_pixel_perfect` | Attiva/disattiva la modalità di disegno pixel-perfect |
| `sprite_onion_set` | Configura l'effetto "onion skin" (abilitato, numero di fotogrammi precedenti/successivi, opacità) |
| `sprite_onion_get` | Ottieni la configurazione corrente dell'effetto "onion skin" |
| `sprite_canvas_set_zoom` | Imposta il livello di zoom (1–64) |
| `sprite_canvas_set_pan` | Imposta l'offset di panoramica |
| `sprite_canvas_reset_view` | Ripristina lo zoom e la panoramica predefiniti |

### Riproduzione — Configurazione autorizzata (2)

| Strumento | Descrizione |
|------|-------------|
| `sprite_playback_get_config` | Ottieni l'impostazione di loop e le durate dei singoli fotogrammi |
| `sprite_playback_set_config` | Imposta la modalità di loop (persistente nel documento) |

### Riproduzione — Anteprima temporanea (6)

| Strumento | Descrizione |
|------|-------------|
| `sprite_preview_play` | Avvia l'anteprima dell'animazione |
| `sprite_preview_stop` | Interrompi l'anteprima dell'animazione |
| `sprite_preview_get_state` | Ottieni lo stato dell'anteprima (in riproduzione, indice del fotogramma, in loop) |
| `sprite_preview_set_frame` | Sposta il cursore su un indice di fotogramma specifico |
| `sprite_preview_step_next` | Avanza di un fotogramma |
| `sprite_preview_step_prev` | Indietreggia di un fotogramma |

## Risorse

| Modello URI | Descrizione |
|-------------|-------------|
| `sprite://session/{id}/document` | Riepilogo completo del documento (fotogrammi, livelli, dimensioni, tavolozza) |
| `sprite://session/{id}/state` | Stato della sessione compresso (strumento, selezione, riproduzione, anteprima, flag "modificato") |

## Formato del risultato

Ogni strumento restituisce un involucro JSON coerente:

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

Codici di errore: `no_session`, `no_document`, `no_frame`, `no_layer`, `no_selection`, `out_of_bounds`, `invalid_input`, `empty_clipboard`.

## Esempio: Crea un'animazione a 2 fotogrammi

```text
1. sprite_session_new
   → { ok: true, sessionId: "session_1" }

2. sprite_document_new { sessionId: "session_1", name: "Hero", width: 16, height: 16 }
   → { ok: true, documentId: "...", frameCount: 1, layerCount: 1 }

3. sprite_draw_pixels { sessionId: "session_1", pixels: [
     { x: 7, y: 0, rgba: [255, 0, 0, 255] },
     { x: 8, y: 0, rgba: [255, 0, 0, 255] },
     { x: 7, y: 1, rgba: [200, 0, 0, 255] },
     { x: 8, y: 1, rgba: [200, 0, 0, 255] }
   ]}
   → { ok: true, bounds: { minX: 7, minY: 0, maxX: 8, maxY: 1, pixelCount: 4 } }

4. sprite_fill { sessionId: "session_1", x: 7, y: 8, rgba: [0, 100, 200, 255] }
   → { ok: true, filled: 42 }

5. sprite_frame_add { sessionId: "session_1" }
   → { ok: true, frameId: "...", frameCount: 2, activeFrameIndex: 1 }

6. sprite_draw_line { sessionId: "session_1", x0: 0, y0: 0, x1: 15, y1: 15, rgba: [255, 255, 255, 255] }
   → { ok: true, bounds: { minX: 0, minY: 0, maxX: 15, maxY: 15, pixelCount: 16 } }

7. sprite_playback_set_config { sessionId: "session_1", isLooping: true }
   → { ok: true }

8. sprite_document_save { sessionId: "session_1" }
   → { ok: true, json: "..." }
```

## Principi di progettazione

1. **Logica reale** — Ogni strumento chiama `@glyphstudio/domain` e `@glyphstudio/state`. Nessuna implementazione raster parallela, nessun algoritmo di riempimento "flood fill" reimplementato, nessun stato delle ombre.

2. **Disegno in batch** — `sprite_draw_pixels` accetta un array di elementi `{x, y, rgba}`. Il buffer viene clonato una volta, tutti i pixel vengono applicati e quindi il buffer viene salvato. Una chiamata, un solo aggiornamento dello stato.

3. **Configurazione vs. temporaneo** — La configurazione della riproduzione (loop, durata dei fotogrammi) è uno stato persistente salvato nel documento. I controlli dell'anteprima (play/stop/scrub) sono uno stato dell'interfaccia utente temporaneo che non modifica mai il file salvato.

4. **Isolamento della sessione** — Ogni sessione ottiene una propria istanza indipendente dello store Zustand. Le sessioni non possono vedere o interferire l'una con l'altra.

5. **Formato del risultato standard** — `{ ok: true, ...data }` oppure `{ ok: false, code, message }`. Nessuna eccezione grezza, nessuna stringa non strutturata.

## Architettura

```text
┌─────────────────────────────────────────────┐
│  MCP Client (Claude, etc.)                  │
└──────────────┬──────────────────────────────┘
               │ stdio / JSON-RPC
┌──────────────▼──────────────────────────────┐
│  MCP Server (server.ts)                     │
│  ├─ Tool handlers (53 tools)                │
│  ├─ Resource handlers (2 resources)         │
│  └─ Session manager (multi-session)         │
├─────────────────────────────────────────────┤
│  Store Adapter (storeAdapter.ts)            │
│  Headless Zustand store per session         │
├─────────────────────────────────────────────┤
│  @glyphstudio/state    @glyphstudio/domain  │
│  Raster ops, stores    Types, contracts     │
└─────────────────────────────────────────────┘
```

## Sicurezza

Questo server viene eseguito localmente tramite stdio. Non effettua richieste di rete, non accetta connessioni in entrata e non accede ai file, a meno che il client non invii esplicitamente il contenuto dei file tramite le chiamate agli strumenti.

- **Nessuna uscita di rete** per impostazione predefinita
- **Nessuna telemetria**
- **Nessun accesso al file system** — i documenti vengono passati in entrata e in uscita come stringhe JSON
- Le tracce dello stack non vengono mai esposte — vengono visualizzati solo risultati di errore strutturati

Consultare [SECURITY.md](../../SECURITY.md) per la segnalazione di vulnerabilità.

## Licenza

[MIT](../../LICENSE)

---

Creato da <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
