<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/GlyphStudio/readme.jpg" alt="GlyphStudio MCP Server" width="400" />
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@glyphstudio/mcp-sprite-server"><img src="https://img.shields.io/npm/v/@glyphstudio/mcp-sprite-server?style=flat-square&label=npm" alt="npm"></a>
  <a href="https://github.com/mcp-tool-shop-org/glyphstudio/actions"><img src="https://img.shields.io/github/actions/workflow/status/mcp-tool-shop-org/glyphstudio/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/MCP-75%20tools-blueviolet?style=flat-square" alt="75 MCP Tools">
  <img src="https://img.shields.io/badge/tests-156%20passing-brightgreen?style=flat-square" alt="Tests">
</p>

# @glyphstudio/mcp-sprite-server

MCP server that exposes the [GlyphStudio](../../README.md) sprite editor as a programmable surface for LLMs. Create documents, draw pixels, manage frames and layers, control playback — all through [Model Context Protocol](https://modelcontextprotocol.io/) tools that call the real domain and state logic. No reimplemented raster, no parallel universe.

Part of the [GlyphStudio monorepo](../../README.md) — a Tauri v2 desktop sprite studio with 32 shipped stages, 166 Rust commands, and 2,216 tests.

## Why

LLMs can describe sprites but can't draw them. This server bridges that gap: an agent calls `sprite_draw_pixels` with coordinates and colors, and the real GlyphStudio engine applies them to a real pixel buffer with real undo, real layers, and real frame isolation. The result is a `.glyph` file you can open in the desktop editor and keep working on by hand.

## Install

```bash
npm install @glyphstudio/mcp-sprite-server
```

## Quick Start

### Claude Desktop / Claude Code

Add to your MCP config (`claude_desktop_config.json` or `.mcp.json`):

```json
{
  "mcpServers": {
    "glyphstudio": {
      "command": "npx",
      "args": ["@glyphstudio/mcp-sprite-server"]
    }
  }
}
```

### stdio (direct)

```bash
npx @glyphstudio/mcp-sprite-server
```

### From source (development)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Tool Inventory (75 tools)

### Session (3)

| Tool | Description |
|------|-------------|
| `sprite_session_new` | Create a new editing session |
| `sprite_session_list` | List active sessions |
| `sprite_session_close` | Destroy a session and free its store |

### Document (5)

| Tool | Description |
|------|-------------|
| `sprite_document_new` | Create a blank document (name, width, height) |
| `sprite_document_open` | Load a `.glyph` file from JSON |
| `sprite_document_save` | Serialize document as `.glyph` JSON |
| `sprite_document_close` | Close document without destroying session |
| `sprite_document_summary` | Get structured document summary (frames, layers, dimensions) |

### Frame (6)

| Tool | Description |
|------|-------------|
| `sprite_frame_add` | Add a new frame after the active frame |
| `sprite_frame_remove` | Remove a frame by ID |
| `sprite_frame_set_active` | Set the active frame by index |
| `sprite_frame_set_duration` | Set frame duration in milliseconds |
| `sprite_frame_duplicate` | Duplicate active frame with all layers and pixel data |
| `sprite_frame_move` | Reorder a frame to a different position in the sequence |

### Layer (7)

| Tool | Description |
|------|-------------|
| `sprite_layer_add` | Add a blank layer to the active frame |
| `sprite_layer_remove` | Remove a layer by ID |
| `sprite_layer_set_active` | Set the active layer for drawing |
| `sprite_layer_toggle_visibility` | Toggle layer visibility |
| `sprite_layer_rename` | Rename a layer |
| `sprite_layer_duplicate` | Duplicate active layer with pixel data |
| `sprite_layer_move` | Reorder a layer in the stack (0 = bottom) |

### Palette (4)

| Tool | Description |
|------|-------------|
| `sprite_palette_set_foreground` | Set foreground color index |
| `sprite_palette_set_background` | Set background color index |
| `sprite_palette_swap` | Swap foreground and background |
| `sprite_palette_list` | List all palette colors with RGBA values |

### Drawing / Raster (5)

| Tool | Description |
|------|-------------|
| `sprite_draw_pixels` | Batch draw pixels — `[{x, y, rgba}]` array, one buffer clone |
| `sprite_draw_line` | Bresenham line between two points |
| `sprite_fill` | Contiguous flood fill from a seed pixel |
| `sprite_erase_pixels` | Batch erase pixels to transparent |
| `sprite_sample_pixel` | Read pixel RGBA at a coordinate (no mutation) |

### Selection / Clipboard (9)

| Tool | Description |
|------|-------------|
| `sprite_selection_set_rect` | Create a rectangular selection |
| `sprite_selection_clear` | Clear selection marquee (pixels unchanged) |
| `sprite_selection_get` | Get current selection rect and dimensions |
| `sprite_selection_copy` | Copy selection to clipboard buffer |
| `sprite_selection_cut` | Cut selection (copies then clears pixels) |
| `sprite_selection_paste` | Paste clipboard as floating selection at (0,0) |
| `sprite_selection_flip_horizontal` | Flip selection contents horizontally |
| `sprite_selection_flip_vertical` | Flip selection contents vertically |
| `sprite_selection_commit` | Blit floating selection onto the active layer |

### Tool Settings (10)

| Tool | Description |
|------|-------------|
| `sprite_tool_set` | Switch tool (pencil / eraser / fill / eyedropper / select) |
| `sprite_tool_get` | Get current tool config |
| `sprite_tool_set_brush_size` | Set brush diameter (1–64) |
| `sprite_tool_set_brush_shape` | Set brush shape (square / circle) |
| `sprite_tool_set_pixel_perfect` | Toggle pixel-perfect stroke mode |
| `sprite_onion_set` | Configure onion skin (enabled, before/after count, opacity) |
| `sprite_onion_get` | Get current onion skin config |
| `sprite_canvas_set_zoom` | Set zoom level (1–64) |
| `sprite_canvas_set_pan` | Set pan offset |
| `sprite_canvas_reset_view` | Reset to default zoom and pan |

### Playback — Authored Config (2)

| Tool | Description |
|------|-------------|
| `sprite_playback_get_config` | Get loop setting and per-frame durations |
| `sprite_playback_set_config` | Set loop mode (persisted in document) |

### Playback — Transient Preview (6)

| Tool | Description |
|------|-------------|
| `sprite_preview_play` | Start animation preview |
| `sprite_preview_stop` | Stop animation preview |
| `sprite_preview_get_state` | Get preview state (playing, frame index, looping) |
| `sprite_preview_set_frame` | Scrub to a specific frame index |
| `sprite_preview_step_next` | Step forward one frame |
| `sprite_preview_step_prev` | Step backward one frame |

### Render (3)

| Tool | Description |
|------|-------------|
| `sprite_render_frame` | Flatten visible layers into a composited PNG (returns base64 data URI + image) |
| `sprite_render_sheet` | Assemble all frames into a horizontal sprite sheet PNG |
| `sprite_render_overview` | Document overview with rendered thumbnail for each frame |

### History (4)

| Tool | Description |
|------|-------------|
| `sprite_history_get_summary` | Get undo/redo stack sizes, can-undo/redo flags, latest operation label |
| `sprite_history_undo` | Undo the last editing operation — restores document, buffers, and active frame/layer |
| `sprite_history_redo` | Redo a previously undone operation |
| `sprite_batch_apply` | Apply multiple drawing operations as a single undo step (draw, line, fill, erase) |

### Analysis (3)

| Tool | Description |
|------|-------------|
| `sprite_analyze_bounds` | Bounding box of non-transparent pixels per frame (minX/Y, maxX/Y, opaque count) |
| `sprite_analyze_colors` | Unique color count + frequency histogram sorted descending |
| `sprite_compare_frames` | Pixel-by-pixel diff between two frames (changed count, bounds, percentage) |

### Transform (3)

| Tool | Description |
|------|-------------|
| `sprite_flip_canvas` | Flip entire canvas (all frames/layers) horizontally or vertically |
| `sprite_rotate_canvas` | Rotate entire canvas clockwise (90°/180°/270°) — 90/270 swap dimensions |
| `sprite_resize_canvas` | Resize canvas (top-left anchor: shrink crops, grow extends with transparent) |

### Import / Export (5)

| Tool | Description |
|------|-------------|
| `sprite_import_sheet` | Import a horizontal sprite sheet PNG by slicing it into frames |
| `sprite_export_frame_png` | Export a single frame as PNG (base64) |
| `sprite_export_sheet_png` | Export all frames as a horizontal sprite sheet PNG (base64) |
| `sprite_export_gif` | Export the animation as an animated GIF (base64) |
| `sprite_export_metadata_json` | Export sprite sheet metadata JSON (frame positions, timing, layout) |

## Resources

| URI Pattern | Description |
|-------------|-------------|
| `sprite://session/{id}/document` | Full document summary (frames, layers, dimensions, palette) |
| `sprite://session/{id}/state` | Compact session state (tool, selection, playback, preview, dirty flag) |
| `sprite://session/{id}/frame.png` | Active frame rendered as PNG |
| `sprite://session/{id}/sheet.png` | Full sprite sheet as PNG |
| `sprite://session/{id}/metadata.json` | Sprite sheet metadata (frame positions, timing, layout) |

## Result Shape

Every tool returns a consistent JSON envelope:

```jsonc
// Success — shape varies per tool
{ "ok": true, "sessionId": "session_1" }
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error — always code + message
{ "ok": false, "code": "no_document", "message": "No document open" }
{ "ok": false, "code": "out_of_bounds", "message": "Pixel (20, 5) outside 16×16 canvas" }
```

Error codes: `no_session`, `no_document`, `no_frame`, `invalid_input`, `not_found`, `serialize_error`, `constraint_violation`, `batch_failed`.

## Example: Create a 2-Frame Sprite

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

8. sprite_render_frame { sessionId: "session_1", frameIndex: 0 }
   → { ok: true, frameIndex: 0, width: 16, height: 16 } + PNG image

9. sprite_export_sheet_png { sessionId: "session_1" }
   → { ok: true, width: 32, height: 16, frameCount: 2, pngBase64: "...", byteLength: 1234 }

10. sprite_export_metadata_json { sessionId: "session_1" }
    → { ok: true, metadata: { format: "glyphstudio-sprite-sheet", frameCount: 2, ... } }

11. sprite_document_save { sessionId: "session_1" }
    → { ok: true, json: "..." }
```

## Design Laws

1. **Real logic** — Every tool calls `@glyphstudio/domain` and `@glyphstudio/state`. No parallel raster implementations, no reimplemented flood fill, no shadow state.

2. **Batch drawing** — `sprite_draw_pixels` accepts an array of `{x, y, rgba}` entries. The buffer is cloned once, all pixels are applied, then the buffer is committed. One call, one state update.

3. **Authored vs transient** — Playback config (looping, frame durations) is authored state that persists in the document. Preview controls (play/stop/scrub) are transient UI state that never touches the saved file.

4. **Session isolation** — Each session gets its own headless Zustand store instance. Sessions cannot see or interfere with each other.

5. **Standard result shape** — `{ ok: true, ...data }` or `{ ok: false, code, message }`. No raw exceptions, no unstructured strings.

## Architecture

```text
┌─────────────────────────────────────────────┐
│  MCP Client (Claude, etc.)                  │
└──────────────┬──────────────────────────────┘
               │ stdio / JSON-RPC
┌──────────────▼──────────────────────────────┐
│  MCP Server (server.ts)                     │
│  ├─ Tool handlers (75 tools)                │
│  ├─ Resource handlers (5 resources)         │
│  └─ Session manager (multi-session)         │
├─────────────────────────────────────────────┤
│  Store Adapter (storeAdapter.ts)            │
│  Headless Zustand store per session         │
├─────────────────────────────────────────────┤
│  @glyphstudio/state    @glyphstudio/domain  │
│  Raster ops, stores    Types, contracts     │
└─────────────────────────────────────────────┘
```

## Dogfood Workflows

The `examples/` directory contains end-to-end workflow scripts that exercise the MCP tools through the real protocol. Each workflow produces artifacts (PNGs, metadata JSON, `.glyph` documents) and a manifest for regression verification.

### Running workflows

```bash
# Run all workflows
npx tsx packages/mcp-sprite-server/examples/run-workflows.ts

# Run a specific workflow
npx tsx packages/mcp-sprite-server/examples/run-workflows.ts walk-cycle

# Update golden fixtures after intentional changes
npx tsx packages/mcp-sprite-server/examples/run-workflows.ts --update-goldens

# Verify output against golden fixtures
npx tsx packages/mcp-sprite-server/examples/run-workflows.ts --verify
```

### Directory structure

```text
fixtures/
  inputs/       Checked-in test inputs (sprite sheets, .glyph files)
  golden/       Checked-in expected outputs (verified by CI)
  output/       Generated at runtime (.gitignored)
```

### How golden verification works

- **JSON and manifests** — exact byte equality via SHA-256
- **PNG images** — SHA-256 comparison (deterministic rendering)
- Missing golden files are warnings, not failures (non-strict by default)
- Run `--update-goldens` to promote current output to golden after intentional changes

## Related Packages

| Package | Description |
|---------|-------------|
| [`@glyphstudio/domain`](../domain/) | Types, contracts, and factory functions |
| [`@glyphstudio/state`](../state/) | State management, raster ops, analysis, transforms, history engine |
| [`@glyphstudio/api-contract`](../api-contract/) | Tauri IPC contract types |
| [GlyphStudio Desktop](../../apps/desktop/) | The full Tauri v2 desktop editor |

## Security

This server runs locally over stdio. It does not make network requests, accept inbound connections, or access files unless the client explicitly passes file content through tool calls.

- **No network egress** by default
- **No telemetry**
- **No filesystem access** — documents are passed in/out as JSON strings
- Stack traces are never exposed — structured error results only

See [SECURITY.md](../../SECURITY.md) for vulnerability reporting.

## License

[MIT](../../LICENSE)

---

Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
