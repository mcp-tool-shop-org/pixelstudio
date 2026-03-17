# Risk Report — GlyphStudio Event Handler Audit

Generated: 2026-03-17 | Stage 63

---

## CRITICAL — Keyboard Shortcut Conflicts

### RISK-001: O key conflict (Ellipse vs Onion Skin) — RESOLVED
- **Severity:** ~~CRITICAL~~ RESOLVED in P0 patch
- **Location:** Canvas.tsx keyboard handler vs ToolRail.tsx label
- **Problem:** ToolRail displayed "O" as the shortcut for Ellipse tool. Canvas.tsx bound O to `toggleOnionSkin`.
- **Fix applied:** Ellipse shortcut changed to C (reserved, will be wired in P1-A). Badge hidden until bound. O remains onion skin. No tooltip drift.

### RISK-002: 14 Tool shortcuts shown in UI but not bound — RESOLVED
- **Severity:** ~~HIGH~~ RESOLVED in P0 patch
- **Location:** ToolRail.tsx (labels) vs Canvas.tsx (keyboard handler)
- **Problem:** ToolRail showed shortcut keys next to tools that had no keyboard handler.
- **Fix applied:** ToolRail now reads from `BOUND_SHORTCUTS` set. Badges and tooltips are only shown for shortcuts that have live handlers (currently N and Shift+N). All 14 unbound badges hidden. Swap colors (X) tooltip also cleaned. Full wiring deferred to P1-A manifest.

### RISK-003: X swap colors — tooltip but no handler — RESOLVED
- **Severity:** ~~MEDIUM~~ RESOLVED in P0 patch
- **Problem:** Tooltip said "Click to swap colors (X)" but X had no handler in Canvas.
- **Fix applied:** Tooltip changed to "Click to swap colors" (no X reference). X handler deferred to P1-A manifest.

---

## HIGH — Dead Backend Commands

### RISK-004: Backend capability boundary unclear — RECLASSIFIED in P1-B
- **Severity:** ~~HIGH~~ MEDIUM (reclassified after deep scan)
- **Location:** All Rust command modules
- **Problem (original):** Initial audit reported 161/211 commands (76%) never called from frontend. This was incorrect — the grep missed non-component callers (executor.ts, aiSettings.ts, animationSequenceGenerator.ts, etc.) and dynamic dispatch patterns (Canvas.tsx builds command names as strings for transform handlers).
- **Corrected picture (P1-B deep scan):** 184 registered commands. 147 live (80%), 25 reserved, 5 internal, 7 dead. The app's backend utilization is healthy. Truly dormant modules: motion (11), preset (10), export (5), asset (6), bundle (4), secondary_motion (3), analysis (3), ai (8) — these are backend-ready, no UI. 7 commands are removal candidates.
- **Impact:** Binary includes ~37 unused commands. Not a health crisis — these are intentional pre-builds for planned features.
- **Fix applied:** Full command capability manifest created (`command-capability-manifest.json`). Every command classified with reason, frontend callers, and removal candidacy.

### RISK-005: 5 Rust modules defined but never registered — RESOLVED
- **Severity:** ~~MEDIUM~~ RESOLVED in P1-B
- **Location:** `apps/desktop/src-tauri/src/commands/` — layer.rs, palette.rs, validation.rs, locomotion.rs, provenance.rs
- **Problem:** These .rs files existed as comment-only stubs with no actual `#[command]` functions. Not exported from `mod.rs`, not registered.
- **Fix applied:** All 5 deleted. `mod.rs` cleaned. `cargo check` passes.

---

## MEDIUM — Buried/Hidden Features

### RISK-006: Transform-only keyboard shortcuts undiscoverable
- **Severity:** MEDIUM
- **Location:** Canvas.tsx keyboard handler
- **Problem:** H (flip horizontal), V (flip vertical), R (rotate CW), Shift+R (rotate CCW) only work during active selection transforms. No UI affordance tells the user these exist. They must discover them by accident or documentation.
- **Impact:** Power-user features that 90%+ of users will never find.
- **Fix:** Show these shortcuts in a transform toolbar or tooltip when a transform is active.

### RISK-007: Measure tool two-click UX undiscoverable
- **Severity:** LOW
- **Location:** Canvas.tsx handlePointerDown for `measure` tool
- **Problem:** Measure requires two separate clicks (start point, end point). No instruction or tooltip explains this. Third click resets. Users may click once, see a red dot, and not understand they need a second click.
- **Fix:** Add a status bar message: "Click to set start point" → "Click to set end point" → "Distance: Npx"

### RISK-008: Slice regions are ephemeral (component state only)
- **Severity:** MEDIUM
- **Location:** Canvas.tsx — `sliceRegions` state
- **Problem:** Slice regions are stored in React component state (`useState`). They are lost on component unmount, frame change, or project reload. No persistence to Rust backend or file.
- **Impact:** Users define slice regions, switch frames, lose all regions. Silent data loss.
- **Fix:** Either persist slices to the project file (Rust-side) or warn users that regions are temporary.

---

## MEDIUM — Race Conditions & Async Risks

### RISK-009: Rapid pointer events during async invoke
- **Severity:** MEDIUM
- **Location:** Canvas.tsx — all async handlers
- **Problem:** `handlePointerDown` calls `await invoke(...)` for fill, magic-select, create_anchor. If the user clicks rapidly before the previous invoke resolves, multiple concurrent commands may fire. The Rust side uses `Mutex<>` which serializes access, but the frontend may process stale results.
- **Impact:** Potential double-fills, duplicate anchors, or selection state corruption under rapid clicking.
- **Mitigation:** The `isDrawingRef` guard helps for stroke tools but not for single-click tools (fill, eyedropper, magic-select, socket).

### RISK-010: Playback RAF loop vs frame operations
- **Severity:** LOW
- **Location:** BottomDock.tsx playback + Canvas.tsx keyboard frame nav
- **Problem:** Both BottomDock playback and keyboard (,/.) can trigger `select_frame`. If playback is running while user presses comma/period, both compete. Canvas.tsx does pause playback before frame nav, but there's a brief window where both could fire.
- **Impact:** Very unlikely in practice due to the pause-first pattern, but worth noting.

---

## MEDIUM — Input Focus Safety

### RISK-013: Keyboard shortcuts fire inside text inputs — RESOLVED
- **Severity:** ~~MEDIUM~~ RESOLVED in P0 patch
- **Problem:** Canvas.tsx keyboard handler fired globally without checking `activeElement`. Typing N/O/Enter etc. in text fields triggered canvas actions.
- **Fix applied:** Focus guard added at top of `handleKeyDown`: returns early when target is INPUT, TEXTAREA, or contentEditable, unless Ctrl/Cmd is held (so Ctrl+Z/S still work in inputs). 4 regression tests added.

---

## LOW — Style/Quality Issues

### RISK-011: Canvas.tsx is 1050+ lines and growing
- **Severity:** LOW
- **Location:** Canvas.tsx
- **Problem:** All 17 tool handlers, keyboard handlers, overlays, and rendering logic in one component. Each new tool adds ~30-60 lines.
- **Impact:** Harder to review, test, and maintain. Not a bug, but a code health concern.
- **Note:** The TOOL-ENHANCEMENT-BRIEF.md explicitly says "keep additions surgical, don't refactor unrelated code" — so this is accepted technical debt.

### RISK-012: Lasso outputs bounding rect, not pixel mask
- **Severity:** LOW
- **Location:** Canvas.tsx lasso handler + selection system
- **Problem:** Lasso tool draws freehand but the selection is always a bounding rectangle. Users expecting pixel-precise lasso selection will be surprised.
- **Impact:** Feature gap vs user expectations. Not a bug — the selection system is rect-only by design.

---

## Summary Table

| ID | Severity | Category | Component | Status |
|----|----------|----------|-----------|--------|
| RISK-001 | ~~CRITICAL~~ | Conflict | Canvas.tsx / ToolRail.tsx | RESOLVED — ellipse shortcut fixed, badge hidden |
| RISK-002 | ~~HIGH~~ | Dead UI | Canvas.tsx / ToolRail.tsx | RESOLVED — unbound badges hidden |
| RISK-003 | ~~MEDIUM~~ | Missing | Canvas.tsx | RESOLVED — stale tooltip removed |
| RISK-004 | ~~HIGH~~ MEDIUM | Capability boundary | Rust backend | RECLASSIFIED — 147/184 live (80%), 37 reserved/internal/dead |
| RISK-005 | ~~MEDIUM~~ | Dead code | Rust commands/ | RESOLVED — 5 stub modules deleted |
| RISK-006 | MEDIUM | Buried | Canvas.tsx | Transform shortcuts undiscoverable |
| RISK-007 | LOW | UX | Canvas.tsx | Measure tool no guidance |
| RISK-008 | MEDIUM | Data loss | Canvas.tsx | Slice regions not persisted |
| RISK-009 | MEDIUM | Race | Canvas.tsx | Rapid clicks during async invoke |
| RISK-010 | LOW | Race | BottomDock + Canvas | Playback vs frame nav |
| RISK-011 | LOW | Maintainability | Canvas.tsx | File size growing |
| RISK-012 | LOW | Feature gap | Canvas.tsx | Lasso → bounding rect only |
| RISK-013 | ~~MEDIUM~~ | Input safety | Canvas.tsx | RESOLVED — focus guard added |
