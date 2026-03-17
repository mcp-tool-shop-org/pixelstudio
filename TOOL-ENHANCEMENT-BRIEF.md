# GlyphStudio — Canvas Tool Enhancement Brief

## What is GlyphStudio?
A **Tauri v2 + React + Rust** desktop pixel-art/sprite studio at `F:\AI\GlyphStudio`. It has an AI copilot shell (LLM-driven editing), but the core manual tools must work first. The app was dogfooded and the original verdict was: **"most of the buttons don't work."**

## Current Status (after Stage 62)
**15 of 17 tools now work.** Only 2 remain: `slice` and `socket` (Tier 3 metadata tools).

---

## Architecture

| Layer | Path | Role |
|-------|------|------|
| **ToolRail UI** | `apps/desktop/src/components/ToolRail.tsx` | Left sidebar — lists 15 tools + 2 sketch tools. Calls `useToolStore.setTool(id)` on click. |
| **Canvas handlers** | `apps/desktop/src/components/Canvas.tsx` | Main pixel canvas. `handlePointerDown/Move/Up` reads `activeTool` from `useToolStore` and branches on tool ID. **This is where all tool logic lives.** |
| **Rust backend** | `apps/desktop/src-tauri/src/commands/canvas.rs` | Pixel engine. Has: `begin_stroke`, `stroke_points`, `end_stroke`, `read_pixel`, `write_pixel`, `fill_rect`, `flood_fill`, `magic_select`, `render_template`. |
| **Rust selection** | `apps/desktop/src-tauri/src/commands/selection.rs` | Selection engine. Has: `set_selection_rect`, `clear_selection`, `begin_selection_transform`, `move_selection_preview`, `commit_selection_transform`, flip/rotate commands. |
| **Registered commands** | `apps/desktop/src-tauri/src/lib.rs` lines 29-78 | Every Tauri command must be registered here via `generate_handler![]`. |
| **Tool store** | `packages/state/src/toolStore.ts` | Zustand store: `activeTool`, `primaryColor`, `secondaryColor`, `setTool()`, `setPrimaryColor()`, `swapColors()` |
| **Domain types** | `packages/domain/src/tool.ts` | `ToolId` union type — all valid tool string IDs |
| **CSS** | `apps/desktop/src/styles/layout.css` | `.tool-rail`, `.tool-btn`, `.tool-label`, `.tool-shortcut` styles (lines 101-175) |

## Tool Status Map

### WORKING — Original (6):
| Tool ID | How it works |
|---------|-------------|
| `pencil` | Stroke pipeline: `begin_stroke` → `stroke_points` → `end_stroke` |
| `eraser` | Same pipeline, color = transparent |
| `marquee` | Drag rectangle selection → `set_selection_rect` |
| `move` | Drag selection → `begin_selection_transform` / `move_selection_preview` |
| `sketch-brush` | Rough brush with dab expansion + opacity |
| `sketch-eraser` | Same as sketch-brush, transparent color |

### WORKING — Added in Stage 61 (Tier 1, 7 tools):
| Tool ID | How it works |
|---------|-------------|
| `fill` (G) | Rust `flood_fill` command — scanline flood fill with undo patch tracking |
| `line` (L) | Drag-to-draw via `bresenhamLine` + stroke pipeline, live preview overlay |
| `rectangle` (U) | `rectangleOutline()` helper → stroke pipeline, live preview overlay |
| `ellipse` (O) | `ellipseOutline()` midpoint algorithm → stroke pipeline, live preview |
| `color-select` (Y) | Eyedropper: `invoke('read_pixel')` → `setPrimaryColor()` |
| `measure` (I) | Two-click overlay: red/green markers, dashed line, distance label |
| `transform` (T) | Aliases to `move` behavior for selection dragging |

### WORKING — Added in Stage 62 (Tier 2, 2 tools):
| Tool ID | How it works |
|---------|-------------|
| `lasso` (Q) | Freehand drag → dashed path preview → bounding rect selection on release |
| `magic-select` (W) | Rust `magic_select` command — flood fill algorithm that returns bounding rect → `set_selection_rect` |

### REMAINING — Tier 3 (2 tools):
| Tool ID | Shortcut | What it should do | Implementation approach |
|---------|----------|-------------------|----------------------|
| `slice` | K | **Slice tool.** Define named rectangular regions for sprite sheet export. | Needs new state (slice regions array stored in project metadata). Draw rects on canvas, show labels, store as metadata. The `ExportPreviewPanel.tsx` already exists and could consume slice data. |
| `socket` | S | **Socket/anchor point.** Place named attachment points on sprite. | `AnchorPanel.tsx` and `apps/desktop/src-tauri/src/engine/anchor.rs` already exist with full anchor CRUD. The tool just needs to: on click → create anchor at pixel position, or if near existing anchor → select it for editing. Wire to existing `useAnchorStore` or the Rust anchor commands. |

## Key Implementation Patterns

### Stroke pipeline (pencil, eraser, line, rect, ellipse):
```typescript
await invoke('begin_stroke', { input: { tool, r, g, b, a } });
await sendStrokePoints(points); // invoke('stroke_points', { input: { points } })
const f = await invoke<CanvasFrameData>('end_stroke');
setFrame(f); syncLayersFromFrame(f); markDirty();
```

### Shape tools preview (line, rect, ellipse):
- `shapeStartRef` / `shapeEndRef` track drag endpoints
- `isShapeDraggingRef` gates pointer events
- `render()` callback draws preview overlay using `ctx.fillRect` at pixel positions
- On pointerUp: compute final points → commit via stroke pipeline

### Selection tools (marquee, lasso, magic-select):
- All output `{ x, y, width, height }` bounding rects
- Call `setSelection(bounds)` (Zustand) + `invoke('set_selection_rect', { input: bounds })`
- No pixel mask support — selection is always rectangular

### Rust commands pattern:
```rust
#[command]
pub fn my_command(input: MyInput, state: State<'_, ManagedCanvasState>) -> Result<CanvasFrame, AppError> {
    let mut guard = state.0.lock().unwrap();
    let canvas = guard.as_mut().ok_or_else(|| AppError::Internal("No canvas".into()))?;
    // ... do work ...
    Ok(build_frame(canvas))
}
```
Register in `lib.rs` → `generate_handler![..., canvas::my_command]`

## Verification Commands
```bash
# TypeScript
cd F:\AI\GlyphStudio && npx tsc --noEmit -p apps/desktop/tsconfig.json

# Rust (needs cargo PATH)
export PATH="$PATH:/c/Users/mikey/.cargo/bin"
cd F:/AI/GlyphStudio/apps/desktop/src-tauri && cargo check

# All tests
cd F:/AI/GlyphStudio && pnpm -r test

# Launch app
cd F:/AI/GlyphStudio/apps/desktop && pnpm tauri dev
```

## Rules
- **Commit per slice**: each tool = its own git commit + push
- **Tests ship with code**: every new handler needs test coverage
- **No dead buttons**: if a tool can't be fully implemented, show a toast/status message
- Canvas.tsx is ~1050 lines — keep additions surgical, don't refactor unrelated code
- The `ToolId` type in `packages/domain/src/tool.ts` must include any new tool IDs

## What NOT to Touch
- Don't modify the AI copilot system (`aiToolRegistry.ts`, `aiToolDispatcher.ts`, `CopilotPanel.tsx`)
- Don't change the template/animation pipeline (Stages 53-60, already working)
- Don't restructure the ToolRail component itself
- Don't add new dependencies

## Coordination Note
This brief tracks a multi-Claude collaboration. Claude 1 mapped the architecture, implemented Tiers 1+2 (Stages 61-62), and maintains this document. Claude 2 should read this before any GlyphStudio work. The remaining Tier 3 tools (`slice`, `socket`) are lower priority — the next major work may be dogfooding, polish, or new features rather than finishing these two.

## Change Log
- **Stage 61** (Claude 1): Implemented fill, line, rect, ellipse, eyedropper, measure, transform. Added `flood_fill` Rust command. 6→13 working tools.
- **Stage 62** (Claude 1): Implemented lasso, magic-select. Added `magic_select` Rust command with bounding rect output. Lasso uses freehand drag → bounding rect. 13→15 working tools.
