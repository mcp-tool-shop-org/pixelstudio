# Trigger Graph — GlyphStudio Event Handler Audit

Generated: 2026-03-17 | Stage 63

## Legend

```
[trigger] → (handler) → {state} → <side-effect> → «visible outcome»
```

---

## 1. Canvas Tool Pipeline

### Drawing Tools (pencil, eraser, sketch-brush, sketch-eraser)
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool, primaryColor}
    → <invoke:begin_stroke>
      → {isDrawingRef = true}

[pointerMove on canvas]
  → (handlePointerMove) reads {isDrawingRef}
    → <invoke:stroke_points>
      → {setFrame()} → «pixels appear on canvas»

[pointerUp on canvas]
  → (handlePointerUp)
    → <invoke:end_stroke>
      → {setFrame(), syncLayers(), markDirty()}
        → «stroke committed, undo stack updated»
```

### Shape Tools (line, rectangle, ellipse)
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool}
    → {shapeStartRef, isShapeDraggingRef = true}

[pointerMove on canvas]
  → (handlePointerMove) reads {isShapeDraggingRef}
    → {shapeEndRef updated}
      → <render()> → «preview overlay drawn on canvas»

[pointerUp on canvas]
  → (handlePointerUp)
    → compute points (bresenham/rectOutline/ellipseOutline)
      → <invoke:begin_stroke → stroke_points → end_stroke>
        → {setFrame(), syncLayers(), markDirty(), isShapeDraggingRef = false}
          → «shape committed to pixel layer»
```

### Fill Tool
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='fill', primaryColor}
    → <invoke:flood_fill(x, y, r, g, b, a)>
      → {setFrame(), syncLayers(), markDirty()}
        → «flood-filled region appears, undo entry created»
```

### Color Select (Eyedropper)
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='color-select'}
    → <invoke:read_pixel(x, y)>
      → {setPrimaryColor(pixel)}
        → «color swatch in ToolRail updates»
```

### Marquee Selection
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='marquee'}
    → {selStartRef set, isDraggingSelection = true}

[pointerMove]
  → (handlePointerMove) reads {isDraggingSelection}
    → <render()> → «marching ants rectangle preview»

[pointerUp]
  → (handlePointerUp)
    → {setSelection(bounds)}
      → <invoke:set_selection_rect>
        → «selection committed, transform tools activate»
```

### Lasso Selection
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='lasso'}
    → {isLassoDraggingRef = true, lassoPointsRef = [start]}

[pointerMove]
  → (handlePointerMove) reads {isLassoDraggingRef}
    → {lassoPointsRef.push(point)}
      → <render()> → «dashed freehand path preview»

[pointerUp]
  → (handlePointerUp)
    → compute bounding rect from lassoPointsRef
      → {setSelection(bounds)}
        → <invoke:set_selection_rect>
          → «rectangular selection from lasso bounds»
```

### Magic Select
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='magic-select'}
    → <invoke:magic_select(x, y)>
      → returns {x, y, width, height, pixel_count}
        → {setSelection(bounds)}
          → <invoke:set_selection_rect>
            → «selection around contiguous color region»
```

### Move / Transform
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='move'|'transform', selection}
    → <invoke:begin_selection_transform>
      → {transformActive = true, dragStartRef set}

[pointerMove]
  → (handlePointerMove) reads {transformActive}
    → <invoke:move_selection_preview(dx, dy)>
      → «selection floats with pointer»

[pointerUp]
  → (handlePointerUp)
    → <invoke:commit_selection_transform>
      → {setFrame(), markDirty(), transformActive = false}
        → «pixels moved to new position»
```

### Socket (Anchor Placement)
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='socket'}
    → <invoke:create_anchor('custom', x, y)>
      → {anchorStore.sync()}
        → <render()> → «anchor circle + label at zoom >= 4»
```

### Slice (Export Region)
```
[pointerDown on canvas]
  → (handlePointerDown) reads {activeTool='slice'}
    → {isSliceDraggingRef = true, sliceStartRef set}

[pointerMove]
  → (handlePointerMove) reads {isSliceDraggingRef}
    → {sliceEndRef updated}
      → <render()> → «orange dashed rectangle preview»

[pointerUp]
  → (handlePointerUp)
    → {sliceRegions.push({name, bounds}), isSliceDraggingRef = false}
      → <render()> → «permanent orange rect with 'slice_N' label»
```

### Measure
```
[click on canvas (1st)]
  → (handlePointerDown) reads {activeTool='measure'}
    → {measureStartRef = point}
      → <render()> → «red marker at start point»

[click on canvas (2nd)]
  → (handlePointerDown) reads {measureStartRef exists}
    → {measureEndRef = point}
      → <render()> → «green marker + dashed line + distance label»
```

---

## 2. Keyboard Flows

### Undo/Redo
```
[Ctrl+Z]
  → (Canvas keydown handler)
    → pause playback if active
      → <invoke:undo>
        → {setFrame(), syncLayers()}
          → «previous state restored»

[Ctrl+Shift+Z / Ctrl+Y]
  → (Canvas keydown handler)
    → pause playback if active
      → <invoke:redo>
        → {setFrame(), syncLayers()}
          → «undone state re-applied»
```

### Selection Transform Keyboard
```
[Enter] → <invoke:commit_selection_transform> → «pixels committed»
[Escape] → <invoke:cancel_selection_transform> → «pixels return to original»
[Arrows] → <invoke:nudge_selection(±1 or ±8)> → «selection shifts»
[H] → <invoke:flip_selection_horizontal> → «selection mirrored»
[V] → <invoke:flip_selection_vertical> → «selection flipped»
[R] → <invoke:rotate_selection_90_cw> → «selection rotated»
[Shift+R] → <invoke:rotate_selection_90_ccw> → «selection rotated CCW»
[Delete] → <invoke:delete_selection> → «selected pixels erased»
```

### Clipboard
```
[Ctrl+C] → <invoke:copy_selection> → {clipboard populated}
[Ctrl+X] → <invoke:cut_selection> → {clipboard + pixels removed}
[Ctrl+V] → <invoke:paste_selection> → {new transform started with clipboard content}
```

### Frame Navigation
```
[,] → pause playback → select previous frame → {setFrame()} → «canvas shows prev frame»
[.] → pause playback → select next frame → {setFrame()} → «canvas shows next frame»
[Space] → toggle playback RAF loop → «animation plays/pauses»
```

---

## 3. Timeline/Layer Flows (BottomDock)

```
[click: + frame button] → <invoke:create_frame> → {timeline updated} → «new frame appears»
[click: frame thumbnail] → <invoke:select_frame> → {canvas switches} → «frame content shown»
[drag: frame] → <invoke:reorder_frame> → {timeline reordered} → «frame position changes»
[dblclick: layer name] → <invoke:rename_layer> → «layer name editable»
[click: eye icon] → <invoke:set_layer_visibility> → «layer shown/hidden»
[click: lock icon] → <invoke:set_layer_lock> → «layer locked/unlocked»
[slider: opacity] → <invoke:set_layer_opacity> → «layer transparency changes»
```

---

## 4. Project Flows (AppShell)

```
[Ctrl+S] → <invoke:save_project> → {markClean()} → «title bar dirty indicator clears»
[File > New] → <invoke:new_project> → {reset all state} → «blank canvas»
[File > Open] → <invoke:open_project> → {load all state} → «project loaded»
```

---

## 5. Scene Compositor Flows

```
[drag instance] → <invoke:move_scene_instance> → «sprite moves on stage»
[click: add instance] → <invoke:add_scene_instance> → «new sprite placed»
[camera pan] → <invoke:set_scene_camera_position> → «viewport shifts»
[camera zoom] → <invoke:set_scene_camera_zoom> → «viewport scales»
[seek slider] → <invoke:seek_scene_tick> → «scene advances to tick»
```
