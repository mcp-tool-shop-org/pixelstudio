# Top 10 Workflow Map

> Ranked by frequency and criticality for a sprite editor user.

## W1: Draw pixels on canvas (Core Loop)

```
ToolRail → select tool (click or shortcut) → Canvas mousedown → draw → mouseup → commit_stroke (Rust)
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Select tool | ToolRail | Text button + shortcut badge | OK — shortcut badges visible |
| 2. Set color | ToolRail (bottom) | Color swatch click = swap only | **No color picker.** Only swap FG/BG. Color must be set from palette panel. |
| 3. Draw | Canvas | Direct manipulation | OK |
| 4. Commit | (automatic on mouseup) | Hidden | OK |

**Friction**: No color picker accessible from the tool rail or canvas. User must switch to RightDock Palette tab to pick colors.

## W2: Create new project

```
ProjectHome → fill form → click Create → workflow executes → enters edit mode
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Set name | CreateForm | Text input | OK |
| 2. Set size | CreateForm | Number inputs | No presets — manual entry only |
| 3. Choose mode | CreateForm | Static/Animation toggle | OK |
| 4. Create | CreateForm | Primary button | OK |

**Friction**: No size presets. No "Open existing" button.

## W3: Navigate frames (animation)

```
BottomDock → click frame OR use ,/. keys → select_frame (Rust) → Canvas updates
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Select frame | BottomDock frame strip | Numbered buttons | OK |
| 2. Add frame | BottomDock + button | Unicode symbol | Tooltip-dependent |
| 3. Duplicate | BottomDock ⎘ button | Unicode symbol | Tooltip-dependent |
| 4. Reorder | BottomDock ←/→ buttons | Arrows | Only visible when >1 frame |

**Friction**: No drag-to-reorder. No thumbnail preview in frame strip.

## W4: Export sprite sheet

```
BottomDock (need >1 frame) → ExportPreviewPanel → set scope/layout → Preview → Export
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Access panel | BottomDock | Auto-appears when >1 frame | **Hidden for single-frame projects** |
| 2. Configure scope | ExportPreviewPanel | Dropdown | OK |
| 3. Preview | ExportPreviewPanel | Button → canvas render | OK — shows layout preview |
| 4. Export | ExportPreviewPanel | Export buttons | Good — Sequence/Sheet/GIF/Bundle |
| 5. Re-export | ExportPreviewPanel | "Export Again" button | Excellent — remembers last config |

**Friction**: Single-frame export has no dedicated path. ExportPreviewPanel only appears when frame count > 1.

## W5: Manage layers

```
RightDock → Layers tab → click layer / add / delete / rename / opacity
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Select layer | LayerPanel | Click row | OK |
| 2. Toggle visibility | LayerPanel | ◉/○ icon button | OK |
| 3. Toggle lock | LayerPanel | 🔒/🔓 icon button | OK |
| 4. Set opacity | LayerPanel | Range slider (active layer only) | OK |
| 5. Add layer | LayerPanel header | + button | OK |
| 6. Add sketch layer | LayerPanel header | S+ button | Niche but clear |
| 7. Delete | LayerPanel | × button (only when >1 layer) | OK |
| 8. Rename | LayerPanel | Double-click name | Discoverable? No visual hint. |
| 9. Reorder | — | **Not available** | **No drag-to-reorder** |

**Friction**: No layer reorder. Rename requires double-click with no affordance hint.

## W6: Use AI copilot

```
TopBar → AI mode (or) Edit mode → RightDock Copilot tab → type prompt → Send → Approve/Reject
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Access | TopBar mode tab or RightDock tab | Button | Two paths — confusing |
| 2. Check status | CopilotPanel | Connection indicator | Good — shows Ollama online/offline |
| 3. View context | CopilotPanel | Context summary bar | Good — shows canvas state |
| 4. Smart suggestions | CopilotPanel | Suggestion chips | Good — only when idle + empty |
| 5. Type prompt | CopilotPanel | Textarea | OK |
| 6. Review tools | CopilotPanel | Tool call display | Good — shows function name + args |
| 7. Approve/Reject | CopilotPanel | Approval bar | **Excellent** — human-in-the-loop |

**Friction**: AI mode gives access to Generate (ComfyUI) + AI Settings + Layers + Provenance + Copilot + Templates — but the Copilot tab is also available in Edit mode. User may not know when to use which.

## W7: Selection → Transform → Commit

```
ToolRail → marquee/lasso/magic → drag on Canvas → switch to Transform → drag/flip/rotate → Commit
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Select area | Canvas | Marquee/lasso drag | OK — marching ants |
| 2. Switch to transform | ToolRail (T key) | Tool button | OK |
| 3. TransformBar appears | TransformBar | Contextual toolbar | **Good** — only when transforming |
| 4. Manipulate | Canvas + TransformBar | Drag + buttons | OK — Flip H/V, Rot CW/CCW |
| 5. Commit/Cancel | TransformBar | Commit/Cancel buttons | OK — Enter/Esc shortcuts |

**Friction**: Minimal. This is well-implemented.

## W8: Undo/Redo

```
Ctrl+Z / Ctrl+Shift+Z → Canvas updates → slice regions reload
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Trigger | Keyboard | Ctrl+Z / Ctrl+Shift+Z | OK |
| 2. Visual feedback | Canvas re-render | Immediate | OK |
| 3. Slice regions | Auto-reload from Rust | Transparent | OK |

**Friction**: No visible undo count. No undo history panel. CopilotPanel shows undo depth, but it's buried.

## W9: Save / Autosave

```
Ctrl+S → save_project (Rust) → TopBar badge updates
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Save | Keyboard Ctrl+S | Shortcut | OK |
| 2. Feedback | TopBar badge | "Saving..." → "Saved" | OK |
| 3. Autosave | Background (30s) | No UI indicator | Recovery only — not the real file |
| 4. Dirty indicator | Window title + TopBar | • dot | OK |

**Friction**: "Save As" is logged but not wired (`console.log('Save As not yet wired')` in AppShell.tsx:51).

## W10: Switch workspace mode

```
TopBar → click mode tab → AppShell re-renders body
```

| Step | Surface | Affordance | Friction |
|------|---------|------------|----------|
| 1. Click tab | TopBar | Tab buttons | OK |
| 2. Layout changes | AppShell | Grid reconfigures | ToolRail disappears in some modes |
| 3. RightDock tab reset | RightDock | Tab resets to index 0 | Loses user's panel selection |

**Friction**: No keyboard shortcut for mode switching. Tab selection not preserved.
