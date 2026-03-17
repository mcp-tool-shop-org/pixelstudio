# UI Audit Remediation Ledger

> Prioritized by user impact. P0 = blocks core workflow, P1 = degrades daily use, P2 = polish, P3 = debt.

## P0 — Blocks Core Workflow

| ID | Finding | Surface | Fix |
|----|---------|---------|-----|
| P0-01 | **LIE-01**: Hardcoded "Valid" badge claims document is valid regardless of state | TopBar | Derive from actual validation store, or remove until wired |
| P0-02 | **BURIED-02**: Color picker not accessible from ToolRail/Canvas | ToolRail | Add color picker popover to FG/BG swatches, or promote Palette tab |
| P0-03 | **BURIED-03**: Single-frame projects have no export path | BottomDock/ExportPreviewPanel | Show ExportPreviewPanel for single-frame projects (current_frame scope) |
| P0-04 | **LIE-03**: Save As silently fails with console.log | AppShell | Wire save_as dialog or show user-facing error |

## P1 — Degrades Daily Use

| ID | Finding | Surface | Fix |
|----|---------|---------|-----|
| P1-01 | **Zoom readout missing**: User cannot see current zoom level | Canvas/BottomDock | Add zoom % indicator to BottomDock or Canvas overlay |
| P1-02 | **Canvas size invisible**: No dimensions shown after project creation | BottomDock or TopBar | Show WxH in status bar |
| P1-03 | **Pixel coordinate readout missing**: hoveredPixel tracked but never displayed | Canvas/BottomDock | Show X,Y in status bar when hovering |
| P1-04 | **Undo/redo depth invisible**: No counter anywhere | BottomDock or TopBar | Show undo count (e.g., "↩ 12") |
| P1-05 | **LIE-02**: Hardcoded "RGB" badge | TopBar | Derive from actual color mode or remove |
| P1-06 | **BURIED-01**: Layer rename has no visual affordance | LayerPanel | Add edit icon or cursor change hint |
| P1-07 | **S-09**: 10 tabs in edit mode RightDock overflow | RightDock | Add tab overflow scroll or collapsible groups |
| P1-08 | **Error paths silent**: Canvas/BottomDock/LayerPanel errors go to console only | Multiple | Add toast/notification system for user-facing errors |
| P1-09 | **No layer reorder**: Layers can be added/deleted but not reordered | LayerPanel | Add move up/down buttons or drag-to-reorder |
| P1-10 | **S-15**: No "Open existing" button in ProjectHome | ProjectHome | Add Open Project button wired to file dialog |

## P2 — Polish

| ID | Finding | Surface | Fix |
|----|---------|---------|-----|
| P2-01 | **S-03**: All tools are text-label-only, no icons | ToolRail | Add tool icons (even simple SVG glyphs) |
| P2-02 | **S-10**: RightDock tab selection not preserved across mode switches | RightDock | Persist last active tab per mode |
| P2-03 | **BURIED-04**: "OS" abbreviation for onion skin unclear | BottomDock | Expand to "Onion" or add tooltip |
| P2-04 | **BURIED-05**: No shortcut cheat sheet / help | Global | Add ? key → shortcut overlay |
| P2-05 | **S-13**: Frame management buttons use Unicode symbols only | BottomDock | Add labels or icons |
| P2-06 | **S-14**: Export buttons "Seq"/"Strip" abbreviations | BottomDock | Expand or add icons |
| P2-07 | **S-16**: No canvas size presets in CreateForm | ProjectHome | Add preset buttons (32, 64, 128, 256) |
| P2-08 | **Color value readout missing**: No hex/RGB shown for active colors | ToolRail | Add hex code below swatches |
| P2-09 | **CONFUSE-01**: Two paths to Copilot (edit tab + AI mode) | RightDock/TopBar | Document or consolidate |
| P2-10 | **S-18**: 9 mode tabs may overflow on narrow windows | TopBar | Add responsive collapse or overflow menu |
| P2-11 | **No frame thumbnails**: Frame strip shows numbers only | BottomDock | Add thumbnail preview |
| P2-12 | **No drag-to-reorder frames**: Must use ←/→ buttons | BottomDock | Add drag-and-drop |

## P3 — Technical Debt

| ID | Finding | Surface | Fix |
|----|---------|---------|-----|
| P3-01 | **DEAD-01**: SpriteEditor subsystem (8 components) appears dead | SpriteEditor.tsx + 7 | Investigate and remove if dead, or integrate |
| P3-02 | **S-20**: Dual shortcut system (SpriteEditor vs SHORTCUT_MANIFEST) | domain + SpriteEditor | Remove SpriteEditor shortcuts or unify |
| P3-03 | **S-06**: Canvas.tsx is 1300-line monolith | Canvas.tsx | Extract tool handlers into per-tool modules |
| P3-04 | **DEAD-02**: Export mode tab is misleading | TopBar/AppShell | Remove Export mode or wire it to ExportPreviewPanel |
| P3-05 | **DEAD-03**: Locomotion placeholder in RightDock | RightDock | Wire to real panel or remove tab |
| P3-06 | **CONFUSE-02**: "Properties" tab semantically overloaded | RightDock | Rename to specific panel names |
| P3-07 | **S-11**: PanelContent if-chain in RightDock | RightDock | Refactor to registry pattern |
| P3-08 | **S-01**: ToolRail disappears in 4 modes (layout shift) | AppShell | Keep rail visible (dimmed) or add mode-specific left panels |

## Summary

| Priority | Count | Theme |
|----------|-------|-------|
| P0 | 4 | Lying UI + missing core affordances |
| P1 | 10 | Missing state readouts + error visibility + workflow gaps |
| P2 | 12 | Polish, discoverability, visual density |
| P3 | 8 | Dead code, monoliths, architectural debt |
| **Total** | **34** | |

## Recommended Execution Order

**Phase 1** (P0 — fix the lies first):
1. P0-01: Remove or wire the "Valid" badge
2. P0-04: Wire Save As or show error
3. P0-03: Enable ExportPreviewPanel for single-frame
4. P0-02: Add color picker access from ToolRail

**Phase 2** (P1 — status bar + error visibility):
5. P1-01 + P1-02 + P1-03 + P1-04: Build a status bar (zoom, canvas size, cursor position, undo count)
6. P1-08: Add toast notification system
7. P1-05: Fix RGB badge
8. P1-10: Add Open button to ProjectHome

**Phase 3** (P1 continued + P2):
9. P1-06 + P1-09: Layer panel improvements
10. P1-07: RightDock tab overflow
11. P2-01: Tool icons
12. P2-04: Shortcut help overlay
13. P2-07: Size presets

**Phase 4** (P3 — debt cleanup):
14. P3-01 + P3-02: SpriteEditor dead code audit
15. P3-03: Canvas.tsx decomposition
16. P3-04 + P3-05: Remove misleading modes
