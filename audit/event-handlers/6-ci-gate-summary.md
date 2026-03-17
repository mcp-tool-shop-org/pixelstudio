# CI Gate Summary — GlyphStudio Event Handler Audit

Generated: 2026-03-17 | Stage 63

---

## Audit Scorecard

| Metric | Value | Grade |
|--------|-------|-------|
| Total event handlers | 487 | — |
| Component handlers | 150 | — |
| Store actions | 280 | — |
| Rust commands registered | 211 | — |
| Keyboard bindings | 47 | — |
| Frontend → Rust utilization | 50/211 (24%) | D |
| Tool handler coverage | 17/17 (100%) | A |
| Keyboard shortcut parity | 1/12 (8%) | F |
| Critical conflicts | 1 (O key) | FAIL |
| High-severity issues | 2 (dead shortcuts, dead commands) | WARN |
| Medium-severity issues | 6 | WARN |
| Low-severity issues | 4 | INFO |
| Input safety gaps | 1 (shortcuts in text fields) | WARN |
| Dead Rust modules | 5 unregistered | WARN |
| Data loss risks | 1 (slice regions) | WARN |
| Race condition risks | 2 (rapid click, playback) | INFO |

---

## Gate Verdicts

### Gate A: Every UI-visible trigger has a working handler
**FAIL** — 14 tool shortcuts displayed in ToolRail have no keyboard handler in Canvas mode. O key conflict means ellipse shortcut is actively broken.

### Gate B: No dead handlers (registered but unreachable)
**FAIL** — 161 of 211 Rust commands have no frontend caller. 5 Rust command modules are defined but not registered. These compile and ship but do nothing.

### Gate C: No duplicated/conflicting handlers
**FAIL** — O key is both "ellipse tool" (ToolRail label) and "toggle onion skin" (Canvas handler). Only one wins at runtime.

### Gate D: State mutations are traceable
**PASS** — All state flows through Zustand stores or Tauri invoke. No direct DOM mutation. No global mutable state outside of managed Rust Mutex<> and Zustand stores.

### Gate E: Side effects are visible/reversible
**PARTIAL** — Drawing tools have full undo (stroke pipeline + flood_fill). Selection transforms have commit/cancel. But: slice regions have no undo, socket anchors have no undo from canvas (only panel delete), measure overlay has no undo (stateless overlay).

### Gate F: Docs match implementation
**PARTIAL** — Tool behaviors match docs 100%. Keyboard shortcuts have 83% drift (labels shown, handlers missing). Brief scope is limited to canvas tools; doesn't cover full app surface.

---

## Recommended Fix Priority

### P0 — Fix before next release
1. **Bind 14 tool shortcuts in Canvas.tsx** — Add a keyboard handler that maps B→pencil, E→eraser, G→fill, L→line, U→rectangle, M→marquee, Q→lasso, W→magic-select, V→move, T→transform, K→slice, S→socket, I→measure, X→swapColors
2. **Resolve O key conflict** — Decide: O = ellipse (move onion skin to another key) or O = onion skin (change ellipse shortcut label to something else)

### P1 — Fix soon
3. **Persist slice regions** — Either save to project file or show a warning that they're temporary
4. **Add rapid-click guard** for single-click async tools (fill, magic-select, socket, eyedropper) — simple `isBusyRef` flag
5. **Document transform shortcuts** — Show H/V/R hints when transform is active

### P2 — Clean up
6. **Audit 5 dead Rust modules** — Wire up or delete layer.rs, palette.rs, validation.rs, locomotion.rs, provenance.rs
7. **Triage 161 dormant commands** — Mark as "backend-ready, no UI" or remove from generate_handler to reduce binary size
8. **Add measure tool status messages** — "Click start" → "Click end" → "Npx"

### P3 — Nice to have
9. **Extract Canvas.tsx tool handlers** into per-tool modules to manage file size
10. **Add pixel mask support** to selection system for true lasso selection

---

## Test Baseline

| Suite | Count | Status |
|-------|-------|--------|
| JavaScript tests | 3,858 | All green |
| Rust tests | 298 | All green |
| Canvas cursor tests | 44 | All green (12 added in Stage 61-63) |

---

## Files in This Audit

```
audit/event-handlers/
├── 1-handler-registry.json    # Complete handler inventory (487 handlers)
├── 2-trigger-graph.md         # trigger → handler → state → effect → outcome flows
├── 3-surface-map.md           # Every entry point organized by input surface
├── 4-risk-report.md           # 12 risks: 1 critical, 2 high, 5 medium, 4 low
├── 5-docs-parity.md           # Brief vs code comparison, drift analysis
└── 6-ci-gate-summary.md       # This file — gates, scores, fix priorities
```
