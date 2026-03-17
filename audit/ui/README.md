# GlyphStudio UI Audit

> Audited 2026-03-17 | Method: code-driven surface analysis | 55 components, 9 modes, 75+ stores

## Audit Scope

5 primary surfaces examined:
1. **Canvas** (Canvas.tsx — 1300 lines, 17 tool behaviors)
2. **ToolRail** (ToolRail.tsx — 15 primary + 2 sketch tools)
3. **Timeline/Layers** (BottomDock.tsx + LayerPanel.tsx — frame management + layer management)
4. **Inspector** (RightDock.tsx — 22 panel components across 9 modes)
5. **Export Flow** (ExportPreviewPanel.tsx — 960 lines, scope/layout/preview/export/bundle)

## Measurement Dimensions

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
| Affordance Truth | D | 2 hardcoded badges lie about validation and color mode |
| Workflow Hierarchy | B | Core draw loop works, but color picking requires 8-tab navigation |
| Discoverability | C | 37 shortcuts with no help system; features buried behind double-clicks and abbreviations |
| State Legibility | D | Zoom, canvas size, cursor position, undo depth all invisible |
| Interaction Density | C | 10 tabs in edit mode RightDock; 17 text-only tool buttons |
| Command Consistency | C | Dual shortcut systems; error handling patterns inconsistent |
| Spatial Composition | B | Grid layout works well; mode-switching layout shifts are disorienting |
| Feedback Quality | C | Save/transform feedback good; most errors silently logged |
| Edge States | C | Single-frame export blocked; Save As silently fails |
| Visual System | C | No icons; mixed Unicode/emoji; abbreviations inconsistent |

## Finding Summary

| Priority | Count | Theme |
|----------|-------|-------|
| P0 | 4 | Lying UI + missing core affordances |
| P1 | 10 | Missing state readouts + error visibility + workflow gaps |
| P2 | 12 | Polish, discoverability, visual density |
| P3 | 8 | Dead code, monoliths, architectural debt |
| **Total** | **34** | |

## Artifacts

| # | Artifact | File |
|---|----------|------|
| 1 | Surface Inventory | [1-surface-inventory.md](1-surface-inventory.md) |
| 2 | Workflow Map (Top 10) | [2-workflow-map.md](2-workflow-map.md) |
| 3 | Buried & Misleading UI | [3-buried-misleading-ui.md](3-buried-misleading-ui.md) |
| 4 | State Visibility Matrix | [4-state-visibility-matrix.md](4-state-visibility-matrix.md) |
| 5 | Consistency Matrix | [5-consistency-matrix.md](5-consistency-matrix.md) |
| 6 | Remediation Ledger | [6-remediation-ledger.md](6-remediation-ledger.md) |

## Top 5 Findings (Start Here)

1. **TopBar lies** — "Valid" and "RGB" badges are hardcoded strings, not derived from state
2. **No status bar** — zoom level, canvas size, cursor position, and undo depth are all invisible
3. **Color picker buried** — changing colors requires navigating to the 8th tab of 10 in RightDock
4. **Single-frame export blocked** — ExportPreviewPanel only renders when frame count > 1
5. **SpriteEditor dead code** — 8 components with conflicting shortcuts, never rendered from AppShell
