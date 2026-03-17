# Surface Map — GlyphStudio Event Handler Audit

Generated: 2026-03-17 | Stage 63

Every entry point where behavior enters the system, organized by input surface.

---

## Surface 1: Canvas Pointer Events

| Tool | pointerDown | pointerMove | pointerUp | Cursor |
|------|------------|-------------|-----------|--------|
| pencil | begin_stroke | stroke_points | end_stroke | crosshair |
| eraser | begin_stroke | stroke_points | end_stroke | crosshair |
| fill | flood_fill | — | — | crosshair |
| line | start drag | preview overlay | commit stroke | crosshair |
| rectangle | start drag | preview overlay | commit stroke | crosshair |
| ellipse | start drag | preview overlay | commit stroke | crosshair |
| color-select | read_pixel → setPrimaryColor | — | — | copy |
| marquee | start rect | preview rect | set_selection_rect | crosshair |
| lasso | start path | collect points + preview | bounding rect → set_selection_rect | crosshair |
| magic-select | magic_select → set_selection_rect | — | — | crosshair |
| move | begin_selection_transform | move_selection_preview | commit_selection_transform | move |
| transform | begin_selection_transform | move_selection_preview | commit_selection_transform | move |
| socket | create_anchor | — | — | cell |
| slice | start drag | preview rect | add sliceRegion | crosshair |
| measure | set start/end point | — | — | crosshair |
| sketch-brush | begin_stroke (dab) | stroke_points (dab) | end_stroke | crosshair |
| sketch-eraser | begin_stroke (transparent) | stroke_points | end_stroke | crosshair |

**Entry file:** `Canvas.tsx` — handlePointerDown/Move/Up

---

## Surface 2: Keyboard (Global Window Listeners)

### Canvas.tsx Keyboard Surface
| Key | Action | Condition | Mode |
|-----|--------|-----------|------|
| Space | Pan / Play-Pause | isDrawing toggles | Pixel edit |
| Enter | Commit transform | transformActive | Pixel edit |
| Escape | Cancel transform / Clear selection | any | Pixel edit |
| Arrows | Nudge selection 1px (8px +Shift) | transformActive | Pixel edit |
| H | Flip horizontal | transformActive | Pixel edit |
| V (no mod) | Flip vertical | transformActive | Pixel edit |
| R / Shift+R | Rotate CW / CCW | transformActive | Pixel edit |
| Delete/Backspace | Delete selection pixels | selectionExists | Pixel edit |
| Ctrl+C | Copy selection | selectionExists | Pixel edit |
| Ctrl+X | Cut selection | selectionExists | Pixel edit |
| Ctrl+V | Paste | always | Pixel edit |
| Ctrl+Z | Undo | always | Pixel edit |
| Ctrl+Shift+Z / Ctrl+Y | Redo | always | Pixel edit |
| N | Sketch brush tool | no modifiers | Pixel edit |
| Shift+N | Sketch eraser tool | shift | Pixel edit |
| O | Toggle onion skin | no modifiers | Pixel edit |
| , | Previous frame | always | Pixel edit |
| . | Next frame | always | Pixel edit |

### SpriteEditor.tsx Keyboard Surface
| Key | Action | Mode |
|-----|--------|------|
| M | Select tool | Sprite edit |
| B | Pencil tool | Sprite edit |
| E | Eraser tool | Sprite edit |
| G | Fill tool | Sprite edit |
| I | Eyedropper tool | Sprite edit |
| Ctrl+S | Save | Sprite edit |
| Ctrl+Shift+S | Save As | Sprite edit |
| Ctrl+O | Open | Sprite edit |
| N | Add frame | Sprite edit |
| X | Swap colors | Sprite edit |
| Space | Play/Stop | Sprite edit |
| ,/. | Prev/Next frame | Sprite edit |
| +/= | Zoom in | Sprite edit |
| - | Zoom out | Sprite edit |
| # (Shift+3) | Grid toggle | Sprite edit |
| Shift+D | Duplicate frame | Sprite edit |

### VectorWorkspace.tsx Keyboard Surface
| Key | Action | Mode |
|-----|--------|------|
| V | v-select tool | Vector edit |
| R | v-rect tool | Vector edit |
| E | v-ellipse tool | Vector edit |
| L | v-line tool | Vector edit |
| P | v-polygon tool | Vector edit |
| Q | v-path tool | Vector edit |

### VectorCanvas.tsx Keyboard Surface
| Key | Action | Condition |
|-----|--------|-----------|
| Escape | Cancel polygon/path | Drawing path/polygon |
| Enter | Finalize open path | Path tool, 2+ points |
| Delete | Remove last point | Path tool, has points |

### AnchorPanel.tsx Keyboard Surface
| Key | Action | Condition |
|-----|--------|-----------|
| Arrows | Move anchor 1px | anchorSelected, !pixelTransformActive |
| Delete | Delete anchor | anchorSelected, !pixelSelectionActive |

### MotionPanel.tsx Keyboard Surface (container-scoped)
| Key | Action | Condition |
|-----|--------|-----------|
| ArrowLeft/, | Prev frame | Panel focused |
| ArrowRight/. | Next frame | Panel focused |
| Space | Play/stop | Panel focused |

### AppShell.tsx Keyboard Surface
| Key | Action |
|-----|--------|
| Ctrl+S | Save project |

---

## Surface 3: ToolRail Click Events

| Element | Action | State Change |
|---------|--------|-------------|
| Tool button (×17) | setTool(toolId) | activeTool in toolStore |
| Swap colors button | swapColors() | primary ↔ secondary in toolStore |
| Primary color swatch | opens color picker | primaryColor in toolStore |
| Secondary color swatch | opens color picker | secondaryColor in toolStore |

**Entry file:** `ToolRail.tsx`

---

## Surface 4: Timeline/Layer UI (BottomDock)

| Element | Event | Tauri Command |
|---------|-------|---------------|
| + Frame button | click | create_frame |
| Frame thumbnail | click | select_frame |
| Frame drag handle | drag | reorder_frame |
| Duplicate frame button | click | duplicate_frame |
| Delete frame button | click | delete_frame |
| Duration input | change | set_frame_duration |
| Play/pause button | click | RAF loop toggle |
| + Layer button | click | create_layer |
| Layer name | dblclick | rename_layer |
| Eye icon | click | set_layer_visibility |
| Lock icon | click | set_layer_lock |
| Opacity slider | input | set_layer_opacity |
| Delete layer button | click | delete_layer |

**Entry file:** `BottomDock.tsx`

---

## Surface 5: Menu/Titlebar (AppShell)

| Element | Event | Action |
|---------|-------|--------|
| File > New | click | new_project |
| File > Open | click | open_project dialog |
| File > Save | click | save_project |
| File > Export PNG | click | export_png |
| File > Export GIF | click | export_animated_gif |

**Entry file:** `AppShell.tsx`

---

## Surface 6: Panel UI (Anchors, Motion, Copilot, Scene)

| Panel | Key Interactions | Handler Count |
|-------|-----------------|---------------|
| AnchorPanel | CRUD anchors, bind/unbind, copy, parent/child, falloff, arrow-key move | 24 |
| MotionPanel | Session CRUD, proposals, templates, frame nav, play/pause | 25+ |
| CopilotPanel | Enter to send, message history, tool execution | 5 |
| SceneEditor | Instance CRUD, camera, playback, keyframes, seek | 30+ |
| ClipPanel | Clip CRUD, pivot, tags | 10+ |
| ExportPanel | Preview layout, export sequences/sheets/bundles | 5+ |

---

## Surface 7: Tauri IPC (Rust Backend)

211 registered commands across 16 modules. Entry via `invoke()` from frontend.

| Module | Commands | Frontend Calls | Utilization |
|--------|----------|---------------|-------------|
| project | 13 | ~6 | 46% |
| canvas | 24 | ~12 | 50% |
| selection | 16 | ~8 | 50% |
| timeline | 11 | ~5 | 45% |
| analysis | 3 | 0 | 0% |
| motion | 11 | 0 | 0% |
| anchor | 15 | ~1 | 7% |
| sandbox | 7 | ~1 | 14% |
| secondary_motion | 3 | 0 | 0% |
| preset | 10 | 0 | 0% |
| export | 5 | 0 | 0% |
| clip | 10 | ~2 | 20% |
| asset | 6 | 0 | 0% |
| bundle | 4 | 0 | 0% |
| scene | 36 | ~15 | 42% |
| ai | 8 | 0 | 0% |
| **TOTAL** | **211** | **~50** | **24%** |
