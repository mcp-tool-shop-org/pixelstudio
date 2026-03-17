# GlyphStudio — Remediation Spec

Generated: 2026-03-17 | Derived from event handler audit (Stage 63)

---

## Diagnosis

The app has three truths right now:

1. **Core tool behavior is solid.** All 17 canvas tools work. The creative loop survived.
2. **The interaction layer is drifted.** Shortcut badges, key handling, docs, and focus behavior are out of sync. This is user-trust damage.
3. **Backend capability boundary is now documented.** Deep scan found 147/184 commands live (80%). 25 reserved, 5 internal, 7 dead. Full classification in `command-capability-manifest.json`.

This spec turns the audit into enforcement and product boundary cleanup.

---

## P0 — Fix Misleading Behavior at the Surface

These repairs are about trust. Ship as a single patch.

### P0-A: Resolve O key conflict

**Problem:** ToolRail displays `O → Ellipse`. Canvas.tsx binds `O → toggleOnionSkin`. Pressing O never activates ellipse.

**Fix:** Change the ellipse shortcut to `C` (unused in Canvas mode). Keep O for onion skin since it's already wired and used.

**Files:**
- `packages/domain/src/tool.ts` — no change (ToolId is fine)
- `apps/desktop/src/components/ToolRail.tsx` line 11 — change `shortcut: 'O'` to `shortcut: 'C'`
- `apps/desktop/src/components/Canvas.tsx` — add `C → setTool('ellipse')` in the new shortcut block (see P1-A)
- `TOOL-ENHANCEMENT-BRIEF.md` — update ellipse shortcut reference

### P0-B: Add focus guard to Canvas keyboard handler

**Problem:** Canvas.tsx line 1186 `handleKeyDown` fires globally. Typing `N` in copilot chat activates sketch-brush. Typing `O` toggles onion skin. Enter commits transforms instead of submitting forms.

**Fix:** Add early return at the top of `handleKeyDown`:

```typescript
// Canvas.tsx, inside handleKeyDown, first line:
const target = e.target as HTMLElement;
if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
```

**Files:**
- `apps/desktop/src/components/Canvas.tsx` line 1186 — insert guard after function signature
- `apps/desktop/src/components/Canvas.test.tsx` — add test: "does not fire shortcuts when input focused"

### P0-C: Decide slice region persistence

**Problem:** `sliceRegions` lives in `useState` — lost on unmount, frame change, project reload. Users think they're authoring export regions; the app silently discards them.

**Decision required — two options:**

**Option 1 (recommended): Promote to document state.**
- Add `sliceRegions` to the Rust canvas state (per-frame, like anchors)
- Add `create_slice_region` / `list_slice_regions` / `delete_slice_region` commands
- Persist with project save/load

**Option 2: Make ephemerality explicit.**
- Show a toast on first slice: "Slice regions are temporary and won't be saved"
- Add a "Copy regions" button that exports to clipboard as JSON
- Keep in React state

The spec assumes Option 1. If Option 2 is chosen, P0-C becomes P2.

### P0-D: Remove cosmetic-only shortcut badges

**Problem:** 14 tool shortcuts are displayed in ToolRail but have no keyboard handler. Users see them, try them, nothing happens.

**Interim fix (ships with P0):** Hide shortcut badges for any tool not yet wired in Canvas.tsx. This is a one-line change:

```typescript
// ToolRail.tsx line 50 — conditionally show shortcut
{tool.shortcut && WIRED_SHORTCUTS.has(tool.shortcut) && (
  <span className="tool-shortcut">{tool.shortcut}</span>
)}
```

Where `WIRED_SHORTCUTS` is a Set imported from the interaction manifest (P1-A). Until the manifest exists, hardcode: `new Set(['N', 'Shift+N'])` (the only two currently wired in Canvas.tsx).

**Permanent fix:** Replaced by P1-A (all shortcuts wired from manifest).

---

## P1-A — Interaction Manifest (Single Source of Truth)

### Schema

Create `packages/domain/src/shortcutManifest.ts`:

```typescript
export type ShortcutScope = 'canvas' | 'sprite-editor' | 'vector' | 'global';

export interface ShortcutBinding {
  /** The key or key combo: 'B', 'Ctrl+Z', 'Shift+N' */
  key: string;
  /** What this shortcut does */
  action: string;
  /** Which component owns the handler */
  owner: string;
  /** Which workspace modes this is active in */
  scopes: ShortcutScope[];
  /** The tool it activates (if tool shortcut) */
  toolId?: ToolId;
  /** Whether it requires an active condition */
  condition?: string;
  /** Whether it should be blocked when an input/textarea is focused */
  focusSafe: boolean;
  /** Test ID for CI verification */
  testId: string;
}

/**
 * Canonical shortcut manifest.
 * Rule: no shortcut may be displayed unless it appears here with a live handler.
 * Rule: no active shortcut may exist unless it is declared here.
 */
export const SHORTCUT_MANIFEST: ShortcutBinding[] = [
  // --- Tool activation (Canvas mode) ---
  { key: 'B', action: 'Pencil tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'pencil', focusSafe: true, testId: 'shortcut-b-pencil' },
  { key: 'E', action: 'Eraser tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'eraser', focusSafe: true, testId: 'shortcut-e-eraser' },
  { key: 'G', action: 'Fill tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'fill', focusSafe: true, testId: 'shortcut-g-fill' },
  { key: 'L', action: 'Line tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'line', focusSafe: true, testId: 'shortcut-l-line' },
  { key: 'U', action: 'Rectangle tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'rectangle', focusSafe: true, testId: 'shortcut-u-rect' },
  { key: 'C', action: 'Ellipse tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'ellipse', focusSafe: true, testId: 'shortcut-c-ellipse' },
  { key: 'M', action: 'Marquee tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'marquee', focusSafe: true, testId: 'shortcut-m-marquee' },
  { key: 'Q', action: 'Lasso tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'lasso', focusSafe: true, testId: 'shortcut-q-lasso' },
  { key: 'W', action: 'Magic Select tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'magic-select', focusSafe: true, testId: 'shortcut-w-magic' },
  { key: 'Y', action: 'Color Select tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'color-select', focusSafe: true, testId: 'shortcut-y-eyedrop' },
  { key: 'V', action: 'Move tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'move', focusSafe: true, testId: 'shortcut-v-move' },
  { key: 'T', action: 'Transform tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'transform', focusSafe: true, testId: 'shortcut-t-transform' },
  { key: 'K', action: 'Slice tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'slice', focusSafe: true, testId: 'shortcut-k-slice' },
  { key: 'S', action: 'Socket tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'socket', focusSafe: true, testId: 'shortcut-s-socket' },
  { key: 'I', action: 'Measure tool', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'measure', focusSafe: true, testId: 'shortcut-i-measure' },
  { key: 'N', action: 'Sketch Brush', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'sketch-brush', focusSafe: true, testId: 'shortcut-n-sketch' },
  { key: 'Shift+N', action: 'Sketch Eraser', owner: 'Canvas.tsx', scopes: ['canvas'], toolId: 'sketch-eraser', focusSafe: true, testId: 'shortcut-shift-n-sketch-erase' },
  { key: 'X', action: 'Swap colors', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: true, testId: 'shortcut-x-swap' },

  // --- Canvas operations ---
  { key: 'O', action: 'Toggle onion skin', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: true, testId: 'shortcut-o-onion' },
  { key: 'Space', action: 'Pan (drawing) / Play-Pause', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-space-pan' },
  { key: ',', action: 'Previous frame', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: true, testId: 'shortcut-comma-prev' },
  { key: '.', action: 'Next frame', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: true, testId: 'shortcut-period-next' },

  // --- Selection transform (conditional) ---
  { key: 'Enter', action: 'Commit transform', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: false, testId: 'shortcut-enter-commit' },
  { key: 'Escape', action: 'Cancel transform / Clear selection', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-esc-cancel' },
  { key: 'ArrowUp', action: 'Nudge selection up', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: false, testId: 'shortcut-arrow-nudge' },
  { key: 'ArrowDown', action: 'Nudge selection down', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: false, testId: 'shortcut-arrow-nudge' },
  { key: 'ArrowLeft', action: 'Nudge selection left', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: false, testId: 'shortcut-arrow-nudge' },
  { key: 'ArrowRight', action: 'Nudge selection right', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: false, testId: 'shortcut-arrow-nudge' },
  { key: 'H', action: 'Flip horizontal', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: true, testId: 'shortcut-h-flip' },
  { key: 'R', action: 'Rotate CW', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: true, testId: 'shortcut-r-rotate' },
  { key: 'Shift+R', action: 'Rotate CCW', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'transformActive', focusSafe: true, testId: 'shortcut-shift-r-rotate' },
  { key: 'Delete', action: 'Delete selection', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'selectionExists', focusSafe: false, testId: 'shortcut-del-selection' },

  // --- Clipboard ---
  { key: 'Ctrl+C', action: 'Copy selection', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'selectionExists', focusSafe: false, testId: 'shortcut-ctrl-c-copy' },
  { key: 'Ctrl+X', action: 'Cut selection', owner: 'Canvas.tsx', scopes: ['canvas'], condition: 'selectionExists', focusSafe: false, testId: 'shortcut-ctrl-x-cut' },
  { key: 'Ctrl+V', action: 'Paste', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-ctrl-v-paste' },
  { key: 'Ctrl+Z', action: 'Undo', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-ctrl-z-undo' },
  { key: 'Ctrl+Shift+Z', action: 'Redo', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-ctrl-shift-z-redo' },
  { key: 'Ctrl+Y', action: 'Redo (alt)', owner: 'Canvas.tsx', scopes: ['canvas'], focusSafe: false, testId: 'shortcut-ctrl-y-redo' },

  // --- Global ---
  { key: 'Ctrl+S', action: 'Save project', owner: 'AppShell.tsx', scopes: ['global'], focusSafe: false, testId: 'shortcut-ctrl-s-save' },
];

// --- Derived helpers ---

/** Set of shortcut keys that have live Canvas handlers. Used by ToolRail to gate badge display. */
export const WIRED_TOOL_SHORTCUTS = new Set(
  SHORTCUT_MANIFEST
    .filter((b) => b.toolId && b.scopes.includes('canvas'))
    .map((b) => b.key)
);

/** Map from single key → ToolId for the Canvas keyboard handler */
export const KEY_TO_TOOL = new Map<string, ToolId>(
  SHORTCUT_MANIFEST
    .filter((b) => b.toolId && b.scopes.includes('canvas') && !b.key.includes('+'))
    .map((b) => [b.key, b.toolId!])
);

/** Keys that should be ignored when an input/textarea is focused */
export const FOCUS_SAFE_KEYS = new Set(
  SHORTCUT_MANIFEST
    .filter((b) => b.focusSafe)
    .map((b) => b.key)
);
```

### ToolRail reads from manifest

```typescript
// ToolRail.tsx — replace hardcoded TOOLS array
import { SHORTCUT_MANIFEST, WIRED_TOOL_SHORTCUTS } from '@glyphstudio/domain';

// ... in render:
<span className="tool-shortcut">
  {WIRED_TOOL_SHORTCUTS.has(tool.shortcut) ? tool.shortcut : ''}
</span>
```

### Canvas reads from manifest

```typescript
// Canvas.tsx — replace ad-hoc key checks with manifest lookup
import { KEY_TO_TOOL, FOCUS_SAFE_KEYS } from '@glyphstudio/domain';

const handleKeyDown = async (e: KeyboardEvent) => {
  // P0-B: Focus guard
  const target = e.target as HTMLElement;
  const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
  if (inInput && !e.ctrlKey && !e.metaKey) return; // Allow Ctrl+S etc. in inputs

  // Tool activation from manifest
  if (!e.ctrlKey && !e.metaKey && !e.altKey) {
    const toolId = KEY_TO_TOOL.get(e.key.toUpperCase());
    if (toolId && !e.shiftKey) {
      e.preventDefault();
      setTool(toolId);
      return;
    }
  }

  // ... rest of existing handlers (Space, Enter, Escape, etc.) unchanged
};
```

### Tests

One test per manifest entry. Pattern:

```typescript
test.each(
  SHORTCUT_MANIFEST
    .filter((b) => b.toolId && b.scopes.includes('canvas'))
)('shortcut $key activates $toolId', ({ key, toolId }) => {
  seedStores({ activeTool: 'pencil' });
  render(<Canvas />);
  fireEvent.keyDown(window, { key });
  expect(useToolStore.getState().activeTool).toBe(toolId);
});
```

---

## P1-B — Command Capability Manifest

### Schema

Create `apps/desktop/src-tauri/src/command_manifest.rs` (compile-time doc, not runtime):

```rust
/// Command capability status.
/// Every command in generate_handler![] MUST have an entry here.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum CommandStatus {
    /// Wired from frontend, part of shipped product
    Live,
    /// Backend ready, UI planned for a named milestone
    Reserved,
    /// Internal infrastructure — not user-facing, valid without UI
    Internal,
    /// Abandoned or superseded — candidate for removal
    Dead,
}

pub struct CommandEntry {
    pub name: &'static str,
    pub module: &'static str,
    pub status: CommandStatus,
    pub frontend_callers: &'static [&'static str],
    pub notes: &'static str,
}
```

### Classification (initial pass)

| Module | Live | Reserved | Internal | Dead |
|--------|------|----------|----------|------|
| canvas (24) | 12 | 5 (fill_rect, write_pixel, read_pixel, get_canvas_state, render_template) | 0 | 0 |
| selection (16) | 8 | 8 (remaining transform ops) | 0 | 0 |
| project (13) | 6 | 4 (list_recent, check_recovery, get_project_info, export_frame_sequence) | 1 (autosave internals) | 2 (export_sprite_strip, get_asset_package_metadata) |
| timeline (11) | 5 | 6 | 0 | 0 |
| scene (36) | 15 | 15 (camera keyframes, playback, export) | 3 (provenance) | 3 (obsolete) |
| anchor (15) | 1 | 10 (CRUD wiring planned) | 2 (validate, propagate) | 2 |
| motion (11) | 0 | 11 (motion UI planned) | 0 | 0 |
| preset (10) | 0 | 10 (preset UI planned) | 0 | 0 |
| sandbox (7) | 1 | 6 (sandbox UI planned) | 0 | 0 |
| clip (10) | 2 | 8 (clip panel planned) | 0 | 0 |
| export (5) | 0 | 5 (export panel planned) | 0 | 0 |
| asset (6) | 0 | 4 (asset browser planned) | 0 | 2 |
| bundle (4) | 0 | 4 (bundle export planned) | 0 | 0 |
| analysis (3) | 0 | 3 (copilot integration) | 0 | 0 |
| secondary_motion (3) | 0 | 3 (motion V2) | 0 | 0 |
| ai (8) | 0 | 8 (AI panel planned) | 0 | 0 |

**Unregistered modules (decision needed):**

| Module | Recommendation |
|--------|---------------|
| layer.rs | Delete (empty, layer ops live in canvas.rs) |
| palette.rs | Delete (empty, palette lives in frontend) |
| validation.rs | Delete (empty, validate UI is frontend-only) |
| locomotion.rs | Delete (empty, no locomotion backend needed) |
| provenance.rs | Delete (scene provenance commands already in scene.rs) |

---

## P2 — CI Gate Rules

### Gate 1: Shortcut display requires live handler

```
Rule: For every entry in ToolRail TOOLS array where shortcut is non-empty,
      SHORTCUT_MANIFEST must contain a matching entry with scopes including 'canvas'.
Enforcement: Unit test in shortcutManifest.test.ts
Failure: "ToolRail displays shortcut '{key}' for {toolId} but no manifest entry exists"
```

### Gate 2: Live shortcut requires manifest entry

```
Rule: Every keydown handler branch in Canvas.tsx that calls setTool() or dispatches
      an action must reference a key that exists in SHORTCUT_MANIFEST.
Enforcement: Code review + manifest test that KEY_TO_TOOL covers all tool shortcuts
Failure: "Canvas handles key '{key}' but no manifest entry exists"
```

### Gate 3: Focus safety

```
Rule: Canvas.tsx handleKeyDown must early-return when activeElement is INPUT/TEXTAREA/contentEditable,
      except for Ctrl/Cmd-modified keys.
Enforcement: Unit test — render Canvas + input, focus input, fire key, assert no tool change
Failure: "Shortcut '{key}' fired while input was focused"
```

### Gate 4: No ephemeral user-authored state

```
Rule: Any state that represents user-authored work (slices, anchors, selections) must either:
      (a) persist to Rust backend / project file, or
      (b) display an explicit "temporary" indicator in the UI
Enforcement: Code review checklist item
Failure: "User-authored state '{name}' lives only in useState without persistence or warning"
```

### Gate 5: Frontend-visible command is documented

```
Rule: Every Tauri command with status=Live in the capability manifest must appear in
      TOOL-ENHANCEMENT-BRIEF.md or equivalent docs.
Enforcement: Script that parses manifest + docs, diffs
Failure: "Command '{name}' is Live but undocumented"
```

### Gate 6: New Rust command requires classification

```
Rule: Adding a command to generate_handler![] without a corresponding CommandStatus entry
      is a CI failure.
Enforcement: Rust compile-time check or test that counts generate_handler entries vs manifest entries
Failure: "Command '{name}' registered but not classified"
```

---

## Implementation Order

### Patch 1 (P0): Trust Repair — ~2 hours
1. Add focus guard to Canvas.tsx handleKeyDown (P0-B)
2. Change ellipse shortcut O → C in ToolRail.tsx (P0-A)
3. Hide unbound shortcut badges in ToolRail.tsx (P0-D interim)
4. Add test for focus guard
5. Commit + push

### Patch 2 (P1-A): Shortcut Manifest — ~3 hours
1. Create `packages/domain/src/shortcutManifest.ts` with full manifest
2. Wire Canvas.tsx to read tool shortcuts from `KEY_TO_TOOL`
3. Wire ToolRail.tsx to read badges from `WIRED_TOOL_SHORTCUTS`
4. Add `X → swapColors()` handler in Canvas.tsx
5. Add manifest-driven test suite (1 test per binding)
6. Remove P0-D interim hardcoded Set
7. Commit + push

### Patch 3 (P0-C): Slice Persistence — ~3 hours (if Option 1)
1. Add `SliceRegion` type to Rust canvas state
2. Add `create_slice_region` / `list_slice_regions` / `delete_slice_region` commands
3. Register in generate_handler
4. Wire Canvas.tsx to invoke on slice create/delete
5. Load slice regions on frame select
6. Persist with project save/load
7. Commit + push

### Patch 4 (P1-B): Command Classification — ~1 hour
1. Create command_manifest.rs with full classification
2. Delete 5 empty unregistered modules
3. Update TOOL-ENHANCEMENT-BRIEF.md with capability boundary section
4. Commit + push

### Patch 5 (P2): CI Gates — ~2 hours
1. Add shortcut parity test (Gate 1+2)
2. Add focus safety test (Gate 3)
3. Add manifest count test (Gate 6)
4. Commit + push

---

## What This Spec Does NOT Do

- Does not wire all 161 dormant commands to UI. That is fake progress.
- Does not refactor Canvas.tsx into smaller files. Accepted debt per project rules.
- Does not add pixel-mask lasso. Rect-only selection is a product decision, not a bug.
- Does not add a command palette. Nice-to-have, not trust-critical.
- Does not add workspace mode keyboard shortcuts (1-9). Separate feature request.

The goal is truthful product boundaries, not maximal feature wiring.
