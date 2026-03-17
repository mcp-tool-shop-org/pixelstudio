# UI Consistency Matrix

> Cross-surface consistency of patterns, affordances, and conventions.

## Shortcut Systems

| System | Location | Bindings | Conflict? |
|--------|----------|----------|-----------|
| SHORTCUT_MANIFEST | domain/shortcutManifest.ts | 37 bindings, derived lookups | **Source of truth** |
| Canvas.tsx keydown | Canvas.tsx | Uses TOOL_KEY_MAP + TOOL_SHIFT_KEY_MAP from manifest | Consistent |
| SpriteEditor.tsx TOOL_SHORTCUTS | SpriteEditor.tsx:13-19 | `m:select, b:pencil, e:eraser, g:fill, i:eyedropper` | **CONFLICT** — M=select vs M=marquee |
| AppShell.tsx Ctrl+S | AppShell.tsx | Ctrl+S save | In manifest |
| BottomDock shortcuts | Displayed in button titles | ,/. prev/next, Space play | In manifest |

**VERDICT**: Two incompatible shortcut systems coexist. SpriteEditor's map is a hazard if it's ever re-enabled.

## Button Patterns

| Pattern | Where Used | Consistent? |
|---------|-----------|-------------|
| Text label buttons | ToolRail, TopBar mode tabs | Yes |
| Unicode symbol buttons | BottomDock frame mgmt (+ ⎘ ✕ ← →), LayerPanel (◉ ○ 🔒 🔓 ×) | Mixed — some panels use emoji, others use Unicode |
| "Sz"/"Op"/"OS"/"Sil" abbreviations | SketchSettings, BottomDock | Inconsistent — some spell out, others abbreviate |
| Primary action button | ProjectHome (.btn-primary), ExportPreviewPanel (.export-action-btn) | Different classes |

## Panel Header Patterns

| Panel | Header | Add Button | Consistency |
|-------|--------|-----------|-------------|
| LayerPanel | "Layers" + S+ and + buttons | Right-aligned | OK |
| ExportPreviewPanel | "Export Preview" | None | Different pattern |
| CopilotPanel | Context bar (no title) | None | Different pattern |
| BottomDock | No header | Inline controls | Different pattern |

**VERDICT**: No consistent panel header pattern. Each panel invents its own header layout.

## State Feedback Patterns

| State Change | Feedback Type | Consistent? |
|-------------|---------------|-------------|
| Tool selected | ToolRail button highlight (accent color) | Yes |
| Frame selected | Frame strip button highlight | Yes |
| Layer selected | Layer item highlight | Yes |
| Mode selected | TopBar tab highlight | Yes |
| Tab selected | RightDock tab highlight | Yes |
| Save status | TopBar badge transition | Yes |
| Transform active | TransformBar appears | Yes |
| Export complete | ExportPreviewPanel result summary | Yes |
| Error | Console log (many places) | **Inconsistent** — some show UI, many just console.log |

## Error Handling Patterns

| Component | Error Display | Pattern |
|-----------|--------------|---------|
| TransformBar | Inline error span | Good |
| ExportPreviewPanel | Inline error message | Good |
| CopilotPanel | Inline in chat | Good |
| Canvas mouse handlers | console.error only | **No UI feedback** |
| BottomDock frame ops | console.error only | **No UI feedback** |
| LayerPanel ops | console.error only | **No UI feedback** |
| AppShell save | console.error + setSaveStatus('error') | Mixed |

**VERDICT**: Approximately half of error paths show UI feedback. The other half silently log to console.

## Dirty Marking Patterns

| Component | Frontend | Backend | Both? |
|-----------|----------|---------|-------|
| Canvas (strokes) | markDirty() | invoke('mark_dirty') | Yes |
| LayerPanel | markDirty() + invoke('mark_dirty') | Yes | Yes |
| BottomDock (frames) | markDirty() + invoke('mark_dirty') | Yes | Yes |
| ExportPreviewPanel (pkg meta) | markDirty() + invoke('mark_dirty') | Yes | Yes |
| CopilotPanel (tool execution) | (via tool dispatcher) | (via tool dispatcher) | Unknown |

**VERDICT**: Consistent dual-dirty pattern. Good.
