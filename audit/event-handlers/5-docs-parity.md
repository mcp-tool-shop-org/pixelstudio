# Docs Parity Report — GlyphStudio Event Handler Audit

Generated: 2026-03-17 | Stage 63

Compares what TOOL-ENHANCEMENT-BRIEF.md documents vs what the code actually does.

---

## Brief vs Code: Tool Status

| Tool ID | Brief Says | Code Does | Parity |
|---------|-----------|-----------|--------|
| pencil | Stroke pipeline | Stroke pipeline | MATCH |
| eraser | Same pipeline, transparent | Same pipeline, transparent | MATCH |
| fill | Rust flood_fill, scanline | Rust flood_fill, scanline | MATCH |
| line | bresenhamLine + stroke pipeline + preview | bresenhamLine + stroke pipeline + preview | MATCH |
| rectangle | rectangleOutline + stroke pipeline + preview | rectangleOutline + stroke pipeline + preview | MATCH |
| ellipse | ellipseOutline midpoint + stroke pipeline + preview | ellipseOutline midpoint + stroke pipeline + preview | MATCH |
| color-select | read_pixel → setPrimaryColor | read_pixel → setPrimaryColor | MATCH |
| measure | Two-click overlay, red/green markers, distance | Two-click overlay, red/green markers, distance | MATCH |
| transform | Aliases to move behavior | Aliases to move behavior | MATCH |
| marquee | Drag rectangle → set_selection_rect | Drag rectangle → set_selection_rect | MATCH |
| lasso | Freehand → bounding rect | Freehand → bounding rect | MATCH |
| magic-select | Rust magic_select → bounding rect → set_selection_rect | Rust magic_select → bounding rect → set_selection_rect | MATCH |
| move | begin_selection_transform / move_selection_preview | begin_selection_transform / move_selection_preview | MATCH |
| socket | create_anchor at pixel, renders at zoom >= 4 | create_anchor at pixel, renders at zoom >= 4 | MATCH |
| slice | Drag to define named region, orange dashed rects | Drag to define named region, orange dashed rects | MATCH |
| sketch-brush | Rough brush with dab expansion + opacity | Rough brush with dab expansion + opacity | MATCH |
| sketch-eraser | Same as sketch-brush, transparent | Same as sketch-brush, transparent | MATCH |

**Result: 17/17 tools match documentation. No drift detected.**

---

## Brief vs Code: Keyboard Shortcuts

| Shortcut | Brief Says | Code Does | Parity |
|----------|-----------|-----------|--------|
| G (fill) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| L (line) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| U (rectangle) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| O (ellipse) | Listed | ToolRail label = ellipse, Canvas binds = onion skin | CONFLICT |
| Y (color-select) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| I (measure) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| T (transform) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| Q (lasso) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| W (magic-select) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| S (socket) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |
| K (slice) | Listed | ToolRail label only, NOT bound in Canvas | DRIFT |

**Result: 11 shortcut drifts + 1 conflict. The brief documents shortcuts as working, but they are UI labels only — no keyboard handler exists in the main Canvas mode.**

---

## Brief vs Code: Rust Commands

| Command | Brief Says | Code Does | Parity |
|---------|-----------|-----------|--------|
| flood_fill | Scanline fill with PixelPatch undo | Scanline fill with PixelPatch undo | MATCH |
| magic_select | Flood fill returning bounding rect | Flood fill returning bounding rect | MATCH |

**Result: Both new Rust commands match.**

---

## Brief vs Code: Architecture

| Claim | Brief Says | Reality | Parity |
|-------|-----------|---------|--------|
| Canvas.tsx is ~1050 lines | Yes | ~1050+ lines | MATCH |
| All tool logic in Canvas.tsx handlePointer* | Yes | Yes | MATCH |
| Selection is always rectangular | Yes | Yes | MATCH |
| No pixel mask support | Yes | Correct | MATCH |

---

## Undocumented Behaviors (in code but NOT in brief)

1. **Slice regions are ephemeral** — not mentioned that they vanish on unmount/frame change
2. **Transform keyboard shortcuts** (H, V, R, Shift+R) — not documented anywhere
3. **Measure tool third-click reset** — not documented
4. **5 unregistered Rust modules** (layer, palette, validation, locomotion, provenance) — not mentioned
5. **161 dormant Rust commands** — brief only documents the 17 canvas tools, not the broader backend surface
6. **SpriteEditor.tsx has its own independent shortcut set** — brief doesn't mention this parallel keyboard surface
7. **VectorWorkspace has its own tool shortcuts** (V, R, E, L, P, Q) — not in brief
8. **AnchorPanel arrow-key nudge** — not documented

---

## Summary

| Category | Total | Match | Drift | Conflict | Undocumented |
|----------|-------|-------|-------|----------|-------------|
| Tool behavior | 17 | 17 | 0 | 0 | 0 |
| Keyboard shortcuts | 12 | 1 (N) | 10 | 1 (O) | 8 |
| Rust commands | 2 | 2 | 0 | 0 | 0 |
| Architecture claims | 4 | 4 | 0 | 0 | 0 |
| Undocumented features | — | — | — | — | 8 |

**Overall: Tool implementations are 100% consistent with docs. Keyboard shortcuts have significant drift — labels exist in UI but handlers are missing in Canvas mode. Brief scope is narrow (canvas tools only) and doesn't cover the full app surface.**
