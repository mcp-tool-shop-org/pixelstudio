# @glyphstudio/mcp-sprite-server

MCP server exposing the GlyphStudio sprite editor as a programmable surface. All tools call the real domain/state logic — no reimplemented raster or parallel universe.

## Quick Start

```bash
# stdio transport (for Claude Desktop, etc.)
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Tool Inventory

### Session (3 tools)

| Tool | Description |
|------|-------------|
| `sprite_session_new` | Create a new editing session |
| `sprite_session_list` | List active sessions |
| `sprite_session_close` | Destroy a session |

### Document (5 tools)

| Tool | Description |
|------|-------------|
| `sprite_document_new` | Create a blank document (name, width, height) |
| `sprite_document_open` | Load a .glyph file from JSON |
| `sprite_document_save` | Serialize document as .glyph JSON |
| `sprite_document_close` | Close document without destroying session |
| `sprite_document_summary` | Get structured document summary |

### Frame (4 tools)

| Tool | Description |
|------|-------------|
| `sprite_frame_add` | Add frame after active frame |
| `sprite_frame_remove` | Remove a frame by ID |
| `sprite_frame_set_active` | Set active frame by index |
| `sprite_frame_set_duration` | Set frame duration in ms |

### Layer (5 tools)

| Tool | Description |
|------|-------------|
| `sprite_layer_add` | Add blank layer to active frame |
| `sprite_layer_remove` | Remove a layer by ID |
| `sprite_layer_set_active` | Set active layer |
| `sprite_layer_toggle_visibility` | Toggle layer visibility |
| `sprite_layer_rename` | Rename a layer |

### Palette (4 tools)

| Tool | Description |
|------|-------------|
| `sprite_palette_set_foreground` | Set foreground color index |
| `sprite_palette_set_background` | Set background color index |
| `sprite_palette_swap` | Swap foreground/background |
| `sprite_palette_list` | List all palette colors |

### Drawing / Raster (5 tools)

| Tool | Description |
|------|-------------|
| `sprite_draw_pixels` | Batch draw pixels with `[{x, y, rgba}]` |
| `sprite_draw_line` | Bresenham line between two points |
| `sprite_fill` | Contiguous flood fill |
| `sprite_erase_pixels` | Batch erase pixels to transparent |
| `sprite_sample_pixel` | Read pixel color (no mutation) |

### Selection / Clipboard (9 tools)

| Tool | Description |
|------|-------------|
| `sprite_selection_set_rect` | Create rectangular selection |
| `sprite_selection_clear` | Clear selection (no pixel change) |
| `sprite_selection_get` | Get current selection rect |
| `sprite_selection_copy` | Copy selection to clipboard |
| `sprite_selection_cut` | Cut selection (clears pixels) |
| `sprite_selection_paste` | Paste clipboard as selection at (0,0) |
| `sprite_selection_flip_horizontal` | Flip selection horizontally |
| `sprite_selection_flip_vertical` | Flip selection vertically |
| `sprite_selection_commit` | Blit selection onto layer |

### Tool Settings (10 tools)

| Tool | Description |
|------|-------------|
| `sprite_tool_set` | Switch tool (pencil/eraser/fill/eyedropper/select) |
| `sprite_tool_get` | Get current tool config |
| `sprite_tool_set_brush_size` | Set brush size |
| `sprite_tool_set_brush_shape` | Set brush shape (square/circle) |
| `sprite_tool_set_pixel_perfect` | Toggle pixel-perfect mode |
| `sprite_onion_set` | Update onion skin config |
| `sprite_onion_get` | Get onion skin config |
| `sprite_canvas_set_zoom` | Set zoom (1-64) |
| `sprite_canvas_set_pan` | Set pan offset |
| `sprite_canvas_reset_view` | Reset to 8x zoom, (0,0) pan |

### Playback — Authored Config (2 tools)

| Tool | Description |
|------|-------------|
| `sprite_playback_get_config` | Get looping + per-frame durations |
| `sprite_playback_set_config` | Set looping (authored state) |

### Playback — Transient Preview (6 tools)

| Tool | Description |
|------|-------------|
| `sprite_preview_play` | Start animation preview |
| `sprite_preview_stop` | Stop animation preview |
| `sprite_preview_get_state` | Get preview state |
| `sprite_preview_set_frame` | Scrub to frame index |
| `sprite_preview_step_next` | Step forward one frame |
| `sprite_preview_step_prev` | Step backward one frame |

**Total: 53 tools**

## Resources

| URI Pattern | Description |
|-------------|-------------|
| `sprite://session/{id}/document` | Document summary |
| `sprite://session/{id}/state` | Compact session state (doc, tool, selection, playback, preview) |

## Result Shape

All tools return JSON:

```json
// Success
{ "ok": true, "bounds": { "minX": 0, "minY": 0, "maxX": 7, "maxY": 0, "pixelCount": 8 } }

// Error
{ "ok": false, "code": "no_document", "message": "No document open" }
```

## Example: Draw a Sprite

```
1. sprite_session_new → { sessionId: "session_1" }
2. sprite_document_new { sessionId, name: "Hero", width: 16, height: 16 }
3. sprite_draw_pixels { sessionId, pixels: [
     { x: 7, y: 0, rgba: [255, 0, 0, 255] },
     { x: 8, y: 0, rgba: [255, 0, 0, 255] },
     ...
   ]}
4. sprite_fill { sessionId, x: 7, y: 8, rgba: [0, 100, 200, 255] }
5. sprite_frame_add { sessionId }
6. sprite_draw_line { sessionId, x0: 0, y0: 0, x1: 15, y1: 15, rgba: [255,255,255,255] }
7. sprite_playback_set_config { sessionId, isLooping: true }
8. sprite_document_save { sessionId } → { json: "..." }
```

## Design Laws

- **Real logic**: All tools call `@glyphstudio/domain` and `@glyphstudio/state` — no parallel raster
- **Batch drawing**: `sprite_draw_pixels` takes an array, not one pixel per call
- **Authored vs transient**: Playback config tools are strictly separate from preview tools
- **Session isolation**: Each session has its own Zustand store instance
