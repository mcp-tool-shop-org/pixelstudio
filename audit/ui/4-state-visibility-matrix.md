# State Visibility Matrix

> For each critical piece of state: where is it shown, and can the user read it?

## Legend
- **Visible**: State is rendered in an always-visible location
- **On-demand**: State is visible only in a specific tab/panel/mode
- **Hidden**: State exists but is never rendered to the user
- **Lying**: State indicator exists but shows wrong/hardcoded data

| State | Authoritative Owner | Visible Where | Visibility Rating |
|-------|-------------------|---------------|-------------------|
| Active tool | toolStore | ToolRail (highlighted button) | **Visible** |
| Primary color | toolStore | ToolRail (swatch) | **Visible** — but no RGB/hex readout |
| Secondary color | toolStore | ToolRail (swatch) | **Visible** — but no RGB/hex readout |
| Zoom level | canvasViewStore | **Nowhere** | **Hidden** |
| Pan position | canvasViewStore | **Nowhere** | **Hidden** |
| Canvas size | projectStore | ProjectHome create form only | **Hidden** after creation |
| Active frame | timelineStore | BottomDock frame strip (highlighted) | **Visible** |
| Frame count | timelineStore | BottomDock "N frames" label | **Visible** |
| FPS | timelineStore | BottomDock fps input | **Visible** |
| Playing | timelineStore | BottomDock play button state + "playing" label | **Visible** |
| Loop enabled | timelineStore | BottomDock loop button state | **Visible** |
| Active layer | layerStore | RightDock → Layers tab (highlighted) | **On-demand** |
| Layer count | layerStore | RightDock → Layers tab | **On-demand** |
| Layer opacity | layerStore | RightDock → Layers tab (slider on active) | **On-demand** |
| Layer visibility | layerStore | RightDock → Layers tab (◉/○ icons) | **On-demand** |
| Layer lock | layerStore | RightDock → Layers tab (🔒/🔓 icons) | **On-demand** |
| Onion skin | timelineStore | BottomDock "OS" button state | **Visible** — but unclear label |
| Show pixel grid | canvasViewStore | **No UI toggle** (only # shortcut in SpriteEditor) | **Hidden** |
| Silhouette mode | canvasViewStore | BottomDock "Sil" button | **Visible** — but unclear label |
| Selection bounds | selectionStore | Canvas (marching ants) | **Visible** |
| Is transforming | selectionStore | TransformBar appears | **Visible** |
| Transform preview | selectionStore | Canvas overlay | **Visible** |
| Undo depth | Canvas state (Rust) | CopilotPanel context bar only | **Hidden** (buried in AI panel) |
| Redo depth | Canvas state (Rust) | **Nowhere** | **Hidden** |
| Project name | projectStore | TopBar filename | **Visible** |
| Is dirty | projectStore | TopBar dot indicator + window title | **Visible** |
| Save status | projectStore | TopBar badge (Saving/Saved/Error) | **Visible** |
| File path | projectStore | TopBar (extracted filename) | **Visible** |
| Color mode | — | TopBar "RGB" badge | **Lying** — hardcoded |
| Validation status | — | TopBar "Valid" badge | **Lying** — hardcoded |
| Workspace mode | AppShell (local state) | TopBar active tab | **Visible** |
| Slice regions | Canvas state (Rust) | Canvas overlay rectangles | **Visible** |
| Hovered pixel coords | Canvas (local state) | **Nowhere** | **Hidden** |
| Clipboard contents | Rust clipboard | **Nowhere** | **Hidden** |
| Ollama connection | CopilotPanel (local) | CopilotPanel status | **On-demand** |
| Snapshot count | snapshotStore | RightDock → Snapshots tab | **On-demand** |
| Clip count | Backend | ExportPreviewPanel clip dropdown | **On-demand** (>1 frame only) |
| Brush size | brushSettingsStore | ToolRail (sketch tools only) | **On-demand** |
| Brush opacity | brushSettingsStore | ToolRail (sketch tools only) | **On-demand** |

## Critical Gaps

### Zoom level — no readout anywhere
The user can zoom in/out but has no idea what zoom level they're at. No "400%" or "1:1" indicator.

### Canvas size — invisible after creation
After creating a project, the user cannot see the canvas dimensions anywhere. Must check via CopilotPanel context bar.

### Undo/redo depth — invisible
No undo counter. User doesn't know how many undos are available. Redo state is completely invisible.

### Hovered pixel coordinates — invisible
Canvas tracks `hoveredPixel` state but never renders it. A pixel editor should show "X: 42, Y: 17" somewhere.

### Clipboard state — invisible
User can't tell if they have pixels on the clipboard. No "paste available" indicator.

### Color values — invisible
Primary/secondary colors are shown as swatches but with no hex/RGB readout. User can't read exact color values from the ToolRail.
