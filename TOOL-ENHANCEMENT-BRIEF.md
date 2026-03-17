# GlyphStudio — Canvas Tool Enhancement Brief

## What is GlyphStudio?
A **Tauri v2 + React + Rust** desktop pixel-art/sprite studio at `F:\AI\GlyphStudio`. It has an AI copilot shell (LLM-driven editing), but the core manual tools must work first. The app was dogfooded and the verdict was: **"most of the buttons don't work."**

## Your Mission
Map out every dead tool button in the left toolbar, then implement working canvas handlers for each one. The goal is: every button in the ToolRail does something real when you click it and interact with the canvas.

---

## Architecture (Read These First)

| Layer | Path | Role |
|-------|------|------|
| **ToolRail UI** | `apps/desktop/src/components/ToolRail.tsx` | Left sidebar — lists 15 tools + 2 sketch tools. Calls `useToolStore.setTool(id)` on click. |
| **Canvas handlers** | `apps/desktop/src/components/Canvas.tsx` | Main pixel canvas. `handlePointerDown/Move/Up` reads `activeTool` from `useToolStore` and branches on tool ID. **This is where all new tool logic goes.** |
| **Rust backend** | `apps/desktop/src-tauri/src/commands/canvas.rs` | Pixel engine. Has: `begin_stroke`, `stroke_points`, `end_stroke`, `read_pixel`, `write_pixel`, `fill_rect`, `render_template`. |
| **Rust selection** | `apps/desktop/src-tauri/src/commands/selection.rs` | Selection engine. Has: `set_selection_rect`, `clear_selection`, `begin_selection_transform`, `move_selection_preview`, `commit_selection_transform`, flip/rotate commands. |
| **Registered commands** | `apps/desktop/src-tauri/src/lib.rs` lines 29-77 | Every Tauri command must be registered here via `generate_handler![]`. |
| **Tool store** | `packages/state/src/toolStore.ts` | Zustand store: `activeTool`, `primaryColor`, `secondaryColor`, `setTool()`, `swapColors()` |
| **Domain types** | `packages/domain/src/tool.ts` | `ToolId` union type — all valid tool string IDs |
| **CSS** | `apps/desktop/src/styles/layout.css` | `.tool-rail`, `.tool-btn`, `.tool-label`, `.tool-shortcut` styles (lines 101-175) |

## Tool Status Map

### WORKING (have canvas handlers):
| Tool ID | What it does |
|---------|-------------|
| `pencil` | Stroke pipeline: `begin_stroke` → `stroke_points` → `end_stroke` |
| `eraser` | Same pipeline, color = `{r:0,g:0,b:0,a:0}` |
| `marquee` | Drag rectangle selection → `set_selection_rect` |
| `move` | Drag selection payload → `begin_selection_transform` / `move_selection_preview` |
| `sketch-brush` | Rough brush with dab expansion + opacity |
| `sketch-eraser` | Same as sketch-brush, transparent color |

### DEAD (no canvas handler — need implementation):

| Tool ID | Shortcut | What it should do | Implementation approach |
|---------|----------|-------------------|----------------------|
| `fill` | G | **Flood fill** at clicked pixel. Replace all connected same-color pixels with primary color. | **Needs new Rust command** `flood_fill(x, y, r, g, b, a)` — scanline fill on active layer. No flood fill exists in Rust yet. `SpriteCanvasArea.tsx` has a JS flood fill you can reference but the real one must be in Rust for the main canvas. |
| `line` | L | **Draw straight line.** Click start point, drag to end, release to stamp. | Use existing stroke pipeline: on pointerDown record start pixel. On pointerUp, compute `bresenhamLine(start, end)` (function already exists in Canvas.tsx line 22), call `begin_stroke` → `stroke_points(allPoints)` → `end_stroke`. Show preview line during drag. |
| `rectangle` | U | **Draw rectangle outline.** Drag from corner to corner, release to stamp. | Same approach as line: compute 4 edges via bresenhamLine, union the points, send through stroke pipeline. Preview during drag. |
| `ellipse` | O | **Draw ellipse outline.** Drag bounding box, release to stamp. | Midpoint ellipse algorithm to generate pixel coords, send through stroke pipeline. Preview during drag. |
| `color-select` | Y | **Eyedropper.** Click pixel → set primaryColor to that pixel's color. | Call `invoke('read_pixel', { x, y })` → returns `{r,g,b,a}` → call `useToolStore.getState().setPrimaryColor(result)`. Check that `setPrimaryColor` exists in toolStore (or add it). |
| `lasso` | Q | **Freehand selection.** Draw freeform closed region, fill becomes selection mask. | Record all pointer positions during drag. On release, close the polygon. Convert to bounding rect + mask. This is complex — could stub as "freehand → bounding rect" initially. |
| `magic-select` | W | **Magic wand.** Click pixel → select all connected pixels of same/similar color. | Needs flood-fill-like algorithm but returns a selection mask instead of painting. Could reuse flood_fill logic in Rust but output a selection rect. |
| `transform` | T | **Free transform.** When selection exists, enter transform mode (same as move but with scale/rotate handles). | The move tool already does transform dragging. Transform could add resize handles at selection corners. Start simple: alias to move behavior, add scale later. |
| `slice` | K | **Slice tool.** Define named rectangular regions for sprite sheet export. | Needs new state (slice regions array). Draw rects on canvas, store as metadata. Lower priority. |
| `socket` | S | **Socket/anchor point.** Place named attachment points on sprite. | Similar to slice — metadata markers. `AnchorPanel.tsx` already exists. Wire tool to place anchors. |
| `measure` | I | **Measure distance.** Click two points, show pixel distance overlay. | Pure UI: track two points, render distance line + label on canvas overlay. No backend needed. |

## Implementation Priority

**Tier 1 — Core drawing (implement these first):**
1. `fill` (flood fill) — most-requested pixel art tool
2. `line` — fundamental shape tool
3. `rectangle` — fundamental shape tool
4. `ellipse` — fundamental shape tool
5. `color-select` (eyedropper) — essential for color workflow

**Tier 2 — Selection enhancement:**
6. `transform` — start as move alias, add handles later
7. `magic-select` — selection by color
8. `lasso` — freehand selection

**Tier 3 — Metadata tools:**
9. `measure` — distance overlay
10. `socket` — anchor placement
11. `slice` — sprite sheet regions

## How the Stroke Pipeline Works (Pattern to Follow)

```typescript
// In handlePointerDown:
await invoke('begin_stroke', { input: { tool: activeTool, r, g, b, a } });
isDrawingRef.current = true;
canvas.setPointerCapture(e.pointerId);

// In handlePointerMove:
const points = bresenhamLine(lastPixel, currentPixel);
sendStrokePoints(points); // calls invoke('stroke_points', { input: { points } })

// In handlePointerUp:
const frame = await invoke<CanvasFrameData>('end_stroke');
setFrame(frame);
syncLayersFromFrame(frame);
markDirty();
```

For **shape tools** (line, rect, ellipse), the pattern is different — you need a **preview during drag** and only commit on release:
1. On pointerDown: record startPixel, set a `shapeStartRef`
2. On pointerMove: compute shape points, render preview on the HTML canvas (not via Rust — just draw on the 2D context as an overlay)
3. On pointerUp: call `begin_stroke` → `stroke_points(finalPoints)` → `end_stroke` to commit

## Adding a New Rust Command (for flood_fill)

1. Add the command function in `apps/desktop/src-tauri/src/commands/canvas.rs`
2. Register it in `apps/desktop/src-tauri/src/lib.rs` inside `generate_handler![]`
3. Call from TypeScript: `invoke<CanvasFrameData>('flood_fill', { input: { x, y, r, g, b, a } })`

The Rust canvas engine uses:
- `state: State<'_, ManagedCanvasState>` — mutex-guarded canvas
- `canvas.layers` — vec of layers, each has a `buffer: PixelBuffer`
- `layer.buffer.get_pixel(x, y)` → `Color { r, g, b, a }`
- `layer.buffer.set_pixel(x, y, &color)`
- `layer.buffer.in_bounds(x, y)` → bool
- `canvas.width`, `canvas.height` — canvas dimensions
- `build_frame(canvas)` → `CanvasFrame` to return to frontend

## Preview Rendering for Shape Tools

Canvas.tsx has a `render` callback that draws the frame. To add shape previews:
1. Add refs like `shapeStartRef`, `shapeEndRef`, `isShapeDraggingRef`
2. In the `render` function (after main frame drawing), check if shape dragging is active
3. Draw preview pixels as colored squares at `(originX + px * zoom, originY + py * zoom)`
4. Use a distinct preview color or the current primaryColor with reduced opacity

## Verification Commands

```bash
# Type check (no build needed for Tauri)
cd F:\AI\GlyphStudio && pnpm -r exec tsc --noEmit

# Rust check
cd F:\AI\GlyphStudio\apps\desktop\src-tauri && cargo check

# Run tests
cd F:\AI\GlyphStudio && pnpm -r test

# Launch app
cd F:\AI\GlyphStudio\apps\desktop && pnpm tauri dev
```

## Rules
- **Commit per slice**: each tool implementation = its own git commit + push
- **Tests ship with code**: every new handler needs test coverage
- **No dead buttons**: if a tool can't be fully implemented, at minimum show a toast/status message saying "Tool not yet implemented" so the user knows it's intentional
- Canvas.tsx is ~800 lines — keep additions surgical, don't refactor unrelated code
- The `ToolId` type in `packages/domain/src/tool.ts` must include any new tool IDs
- CSS is in `apps/desktop/src/styles/layout.css` — the toolbar is already styled, no CSS changes needed for tool behavior

## What NOT to Touch
- Don't modify the AI copilot system (`aiToolRegistry.ts`, `aiToolDispatcher.ts`, `CopilotPanel.tsx`)
- Don't change the template/animation pipeline (Stages 53-60, already working)
- Don't restructure the ToolRail component itself — it's fine, just wire up the handlers in Canvas.tsx
- Don't add new dependencies

## Coordination Note
This brief was written by one Claude session and is meant to be picked up by another. The first Claude mapped the architecture, identified all dead tools, and documented the implementation approach. The second Claude should read this, then start implementing from Tier 1 down. If Rust commands are needed (flood_fill), write them following the existing patterns in canvas.rs.
