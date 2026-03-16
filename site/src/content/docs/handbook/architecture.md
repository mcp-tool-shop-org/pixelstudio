---
title: Architecture
description: How GlyphStudio's frontend and backend fit together
sidebar:
  order: 3
---

GlyphStudio separates concerns cleanly between the React frontend and the Tauri/Rust backend.

## Responsibility boundary

### Frontend owns

- Workspace UI, layout, and dock system
- Canvas view state (zoom, pan, overlays)
- Tool state and interaction handling (stroke lifecycle, Bresenham interpolation)
- Optimistic intent dispatch
- AI candidate acceptance/rejection UI
- Provenance and history display

### Backend owns

- **Pixel buffer** — authoritative RGBA storage per layer, row-major
- **Layer management** — create, delete, rename, reorder, visibility, lock, opacity
- **Stroke transactions** — begin/append/end with before/after pixel patches
- **Undo/redo** — stroke-level (one drag gesture = one undo step)
- **Compositing** — alpha-correct layer blending, bottom to top
- Project file I/O and authoritative serialization
- Deterministic image transforms (quantize, remap, transform)
- Validation engines
- Export pipelines
- AI process orchestration (Ollama, ComfyUI)
- Locomotion analysis services
- Background job execution
- Durable provenance records
- Autosave and crash recovery

## Transport model

- **Tauri commands** for request/response (typed, versionable)
- **Tauri events** for progress updates, job completion, autosave notifications

## Command loop

The core editing loop flows through Rust at every step:

```
pointer event → tool resolves color + active layer
  → begin_stroke (Rust validates layer is editable)
  → stroke_points with Bresenham interpolation (Rust records before/after patches)
  → end_stroke (Rust commits to undo stack, returns composited frame)
  → canvas re-renders from authoritative frame data
```

The frontend never holds pixel truth. Every pixel mutation goes through Rust and returns the full composited frame.

## State model

The frontend uses 17 Zustand stores organized by domain, plus a canvas frame store for rendering:

| Store | Responsibility |
|-------|---------------|
| appShell | Global UI: modals, command palette, notifications |
| project | Identity, save status, color mode, canvas size |
| workspace | Active mode, dock tabs, layout preferences |
| canvasView | Zoom (1x–32x steps), pan, 8 overlay toggles |
| tool | Active tool, primary/secondary RGBA colors, palette popup |
| selection | Selection geometry, mode, transform preview state |
| layer | Layer graph synced from Rust truth after every command |
| palette | Palette definitions, contracts, ramps, remap preview |
| timeline | Frame list, active frame, playback, onion skin settings |
| ai | Job queue, candidates, results tray |
| locomotion | Analysis results, plans, preview mode, overlays |
| validation | Reports, issues, repair previews |
| provenance | Operation log with deterministic/probabilistic badges |
| export | Preset selection, readiness, preview state |
| character | Active build, selected slot, validation issues, dirty flag, equip/unequip/replace actions |
| scenePlayback | Scene clock, camera resolver, keyframes, shot derivation, selected keyframe, camera timeline lane projection |
| sceneEditor | Scene instances + camera keyframes (authoritative frontend state), scene undo/redo history stacks, rollback-aware undo/redo actions, persisted provenance log + drilldown captures |
| canvasFrame | Shared frame data from Rust for Canvas and LayerPanel rendering |

## Reducer patterns

**Deterministic edit** — tool intent, stroke transaction via Rust, composited frame returned, layer store synced, canvas re-renders.

**Probabilistic AI** — form, queue job, candidates stored outside layer graph, user accepts, insert editable artifact, provenance, validation invalidated.

**Analysis** — request, async result in locomotion/validation slice, no project mutation unless user applies.

**Repair** — issue selected, repair preview, apply mutates content, provenance, validation reruns on narrowed scope.

## Backend command surface

166 implemented Tauri commands across:
- **Canvas** (13): init, get state, write/read pixel, stroke lifecycle, undo/redo, layer management
- **Project** (13): new, open, save, info, dirty, recents, export PNG, autosave, check/restore/discard recovery, export frame sequence, export sprite strip
- **Selection** (16): set/clear/get selection, copy/cut/paste/delete, begin/move/nudge/commit/cancel transform, flip H/V, rotate CW/CCW
- **Timeline** (11): get timeline, create/duplicate/delete/select/rename frame, reorder, insert at, duplicate at, set duration, onion skin frames
- **Motion** (11): begin/generate/get/accept/reject/cancel session, commit/undo/redo commit, list/apply templates
- **Anchor** (15): create/update/delete/list/move/validate anchors, bind/clear/resize bounds, copy to frame/all, propagate updates, set/clear parent, set falloff
- **Sandbox** (7): begin/get/close sandbox session, analyze motion, get anchor paths, apply timing, duplicate span
- **Secondary Motion** (3): list/apply secondary motion templates, check readiness (wind, sway, swing, rustle)
- **Presets** (10): save/list/delete/rename/get/apply motion presets, batch apply (span/all), check compatibility, preview apply
- **Clips** (10): create/list/update/delete/validate clip definitions, set/clear pivot, set/add/remove tags (named frame spans for sprite-sheet export)
- **Export** (5): preview sprite-sheet layout, export clip sequence, export clip sheet, export all clips sheet, export clip sequence with manifest
- **Asset Catalog** (6): list assets, get/upsert/remove catalog entry, refresh catalog, generate thumbnail (file-backed index separate from projects)
- **Bundle Packaging** (4): preview/export asset bundle, preview/export catalog bundle (multi-asset with per-asset subfolders)
- **Package Metadata** (2): get/set asset package metadata (name, version, author, description, tags — persisted with project)
- **Scene** (36): new/open/save/save_as/get_info/get_instances + add/remove/move instance, set layer/visibility/opacity/clip/parallax, set playback fps/loop, get playback state, list source clips, get source asset frames, export scene frame, get/set/reset camera (position/zoom), get timeline summary, seek tick, camera keyframe CRUD (list/add/update/delete), get camera at tick, unlink/relink instance, restore instances (undo/redo backend sync), get/sync scene provenance
- Plus stubs for palette, validation, AI, locomotion analysis

## Camera timeline lane

The scene timeline includes a dedicated camera lane (`CameraTimelineLane`) that projects camera keyframe and shot data as a visual editing surface.

### Architecture rules

- The lane is a **projection surface**, not a separate data model. All visuals derive from `cameraKeyframes[]` and `deriveShotsFromCameraKeyframes()` — the same source of truth used by the Camera Keyframe Panel.
- No `deriveCameraTimelineSpans` helper exists because `deriveShotsFromCameraKeyframes()` already provides shot span data. One derivation path, no duplicates.
- Selection state is shared: `selectedKeyframeTick` in `scenePlaybackStore` is the single selection for both the lane and the dock panel.

### Lane components

| Element | Source | Behavior |
|---------|--------|----------|
| Keyframe markers | `deriveCameraTimelineMarkers(keyframes)` | Diamond (linear) or square (hold) at tick position; click selects + seeks |
| Shot bars | `deriveShotsFromCameraKeyframes(keyframes, totalTicks)` | Span from keyframe to next keyframe (or End); click selects source keyframe + seeks |
| Playhead | `currentTick` from store | Red vertical line at current position |
| Current shot | `findCurrentCameraShotAtTick(shots, tick)` | Displayed in lane header |

### Lane actions

| Action | Behavior |
|--------|----------|
| Add key at playhead | Inserts keyframe at `currentTick` with current camera position |
| Delete selected | Removes keyframe at `selectedKeyframeTick` |
| Previous / Next key | Navigates to adjacent keyframe in sorted order |
| Jump to selected | Seeks playhead to `selectedKeyframeTick` |

## Scene undo/redo history

GlyphStudio has two separate undo/redo systems that coexist without interference:

- **Canvas undo/redo** — stroke-level, backend-owned in Rust, operates on pixel patches
- **Scene undo/redo** — snapshot-level, frontend-owned in TypeScript state, operates on scene instance arrays

These are intentionally distinct mechanisms. Canvas undo reverses pixel strokes; scene undo reverses document-level scene edits (instance placement, transforms, character operations). They do not share stacks or interact.

### Architecture

Scene history uses a three-layer architecture in `@glyphstudio/state`:

| Layer | Module | Responsibility |
|-------|--------|---------------|
| Contract | `sceneHistory.ts` | Operation kinds, snapshot types, entry creation, no-op detection |
| Engine | `sceneHistoryEngine.ts` | Pure-function stack mechanics (push, undo, redo, max-entries) |
| Store | `sceneEditorStore.ts` | Zustand store binding engine to mutable state + rollback actions |

All three layers are pure TypeScript with no framework dependency except the store layer (Zustand).

### History model

Scene history uses **full-snapshot** storage. Each history entry records:

- `before`: complete `SceneAssetInstance[]` at the moment before the edit
- `after`: complete `SceneAssetInstance[]` after the edit
- `kind`: which operation produced the edit
- `metadata`: optional instance ID, camera data, or override details
- `timestamp`: when the edit occurred
- `camera` (optional): `SceneCamera` snapshot when the edit is a camera operation

Undo restores the stored `before` snapshot exactly. Redo restores the stored `after` snapshot exactly. No recomputation or re-derivation occurs.

### Camera authoring parity

Camera edits (pan, zoom, reset) enter the same lawful seam as instance edits. Every persisted camera mutation routes through `applyEdit` so that history, provenance, and drilldown all fire in a single atomic step.

| Concern | Camera path | Instance path |
|---------|-------------|---------------|
| Entry point | `applyEdit(kind, instances, metadata, nextCamera)` | `applyEdit(kind, nextInstances, metadata)` |
| History | Snapshot includes `camera` field | Snapshot includes `instances` only |
| Provenance | Entry appended with `set-scene-camera` kind | Entry appended with instance kind |
| Drilldown | `beforeCamera` / `afterCamera` captured from exact edit values | `beforeInstance` / `afterInstance` extracted by `instanceId` |
| Undo/redo | Result includes `camera` for caller to restore to backend + playback | Result includes `instances` for caller to restore |
| No-op guard | Same reference-identity check applies | Same reference-identity check applies |

#### Camera vs playback boundary

Camera state lives in two stores that serve different purposes:

| Store | Owns | Purpose |
|-------|------|---------|
| `scenePlaybackStore` | Live camera (cameraX, cameraY, cameraZoom) | Real-time rendering — updated during drag, wheel, tick interpolation |
| `sceneEditorStore` | Camera history snapshots | Persistence — stores before/after camera for undo/redo/drilldown |

During a pan drag, `scenePlaybackStore` updates on every mousemove (transient). On mouseup, `sceneEditorStore.applyEdit` commits the final position (one history entry). Undo restores the camera from the history snapshot back to both the backend and `scenePlaybackStore`.

### Operations that produce history

These scene edits are routed through `applyEdit` and create history entries:

| Operation kind | Description |
|----------------|-------------|
| `add-instance` | Place a new asset or character instance |
| `remove-instance` | Delete an instance from the scene |
| `move-instance` | Change instance position (x, y) |
| `set-instance-visibility` | Toggle instance visible/hidden |
| `set-instance-opacity` | Change instance opacity |
| `set-instance-layer` | Change instance z-order |
| `set-instance-clip` | Assign or clear clip |
| `set-instance-parallax` | Change parallax depth factor |
| `reapply-character-source` | Refresh character snapshot from source build |
| `unlink-character-source` | Sever source relationship |
| `relink-character-source` | Restore source relationship |
| `set-character-override` | Set a per-slot local override |
| `remove-character-override` | Clear a single slot override |
| `clear-all-character-overrides` | Clear all overrides on an instance |
| `set-scene-camera` | Change scene camera position/zoom |
| `set-scene-playback` | Change playback settings (FPS, loop) |

Identical (no-op) edits are automatically detected and skipped — no history entry is created.

### What does NOT create history

- Backend load/refresh (`loadInstances`) — periodic sync from backend
- Selection changes — component-local `useState`, not scene state
- Panel open/close — workspace layout state
- Typing/focus/hover — transient UI state
- Playback state — clock tick, play/pause
- Error state changes — ephemeral notifications

Non-scene UI state is not part of scene history.

### Undo/redo semantics

- Undo restores the stored `before` snapshot; redo restores the stored `after` snapshot
- A new forward edit after undo clears the redo stack
- Undo/redo requires successful backend sync via `restore_scene_instances`
- On backend sync failure, the local store and history stacks roll back to their exact prior state
- The rollback closure captures pre-undo/redo instances and history by reference, ensuring perfect restoration

### Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z | Redo |
| Ctrl/Cmd+Y | Redo (alternative) |

Shortcuts are suppressed when focus is in an `<input>`, `<textarea>`, or `contentEditable` element.

### Current limitations

- Scene history is session-local — it resets on scene change or app restart (provenance persists separately)
- No metadata-bearing scene export/import yet
- History covers instances, camera, and keyframes — not a generalized project-wide undo system
- Canvas and scene editors use different undo mechanisms by design

## Scene provenance (persisted)

Scene provenance is an append-only activity log that records successful forward scene edits. It persists with the scene document, surviving save/load cycles. It exists alongside scene history but serves a fundamentally different purpose.

### Three systems

| System | Purpose | Persists? | Mutates state? |
|--------|---------|-----------|----------------|
| **History** | Reversible session-local undo/redo snapshots | No | Yes (stack navigation) |
| **Provenance** | Persisted scene activity log | Yes | No (read-only log) |
| **Drilldown** | Focused inspection of one persisted or live provenance entry | Yes | No (derived view) |

History reverses edits. Provenance records edits. Drilldown explains one edit. The three systems share type definitions but never share state.

### History vs provenance

| Aspect | Scene history | Scene provenance |
|--------|--------------|-----------------|
| **Purpose** | Reversal (undo/redo) | Inspection (what happened) |
| **Model** | Before/after snapshot pairs | Ordered entry log with label + metadata |
| **Persistence** | Session-local only | Persists with scene document |
| **Mutability** | Entries move between past/future stacks | Append-only, never modified |
| **Trigger** | Forward edits via `applyEdit` | Same — appended at the same seam |
| **Undo/redo** | Navigates stacks | Does not create entries |
| **Load/refresh** | Does not create entries | Does not create entries |
| **No-op edits** | Skipped (identical instances) | Skipped (same guard) |
| **Failed edits** | Never recorded | Never recorded |
| **Reset** | `resetHistory` clears stacks | `resetHistory` clears provenance and resets sequence |

### Architecture

Provenance is built on two layers in `@glyphstudio/state`:

| Layer | Module | Responsibility |
|-------|--------|---------------|
| Contract | `sceneProvenance.ts` | Entry type, label enrichment, sequence counter |
| Store | `sceneEditorStore.ts` | Append provenance at the `applyEdit` seam, store in `provenance[]` |

Provenance reuses the same `SceneHistoryOperationKind` and `SceneHistoryOperationMetadata` types from the history contract. The two systems share type definitions but never share state.

### Persistence model

Provenance and drilldown persist as optional fields on `SceneDocument`:

| Field | Type | Description |
|-------|------|-------------|
| `provenance` | `PersistedSceneProvenanceEntry[]` | Ordered activity entries — absent in legacy scenes |
| `provenanceDrilldown` | `PersistedSceneProvenanceDrilldownMap` | Captured before/after slices keyed by sequence (string keys for JSON) — absent in legacy scenes |

Persisted types are defined in `@glyphstudio/domain` and mirror the state-layer types. The persistence layer never depends on state internals.

#### Save path

`sync_scene_provenance` IPC writes frontend provenance and drilldown to the in-memory `SceneDocument` before `save_scene` serializes to `.pscn`.

#### Load path

`get_scene_provenance` IPC returns the persisted payload. The frontend calls `hydrateProvenancePayload()` to convert string-keyed drilldown map to numeric sequence keys, then `loadPersistedProvenance()` to hydrate the store and set the sequence counter to `max(persisted sequences) + 1`.

#### Sequence continuity

After load, new edits continue from where the persisted sequence left off. Restored and newly created entries share one coherent Activity timeline.

### Backward compatibility

Scenes with missing provenance fields load cleanly:

- Absent `provenance` → empty Activity panel, sequence starts at 1
- Absent `provenanceDrilldown` → timeline rows render, drilldown shows honest fallback
- Partial camera metadata → fallback to metadata-only display
- String-keyed drilldown maps → converted to numeric keys during hydration

**Pinned law:** Absence of provenance is not an error. Absence of drilldown data is not permission to invent fake detail.

### Append mechanics

Provenance entries are appended inside `applyEdit` in `sceneEditorStore`, using history reference identity to detect whether a real edit occurred:

- If `result.history !== history` (reference changed), a history entry was recorded → append provenance
- If references are identical, the edit was a no-op or occurred during undo/redo replay → skip provenance

This ensures provenance only records actual forward edits without duplicating the no-op detection logic.

### Entry model

Each `SceneProvenanceEntry` contains:

- `sequence` — monotonically increasing 1-based counter (continues from persisted max after load)
- `kind` — the `SceneHistoryOperationKind` that produced the entry
- `label` — human-readable description, enriched with metadata (instance ID, slot ID, changed fields)
- `timestamp` — ISO 8601 timestamp
- `metadata` — optional `SceneHistoryOperationMetadata` identifying the edit target

### UI surface

The **Activity** tab in the scene mode RightDock renders provenance entries newest-first. Each row shows the label, formatted timestamp, and metadata summary. Restored and newly created entries appear as one unified timeline. Clicking a row opens the **drilldown pane** showing the captured change for that entry.

### Provenance drilldown

Drilldown is a read-only inspection view for a selected provenance entry. It shows what changed in one specific edit using data captured at the time of the edit — not derived from current scene state. Drilldown source slices persist alongside provenance entries.

#### Capture architecture

Drilldown is built on three layers in `@glyphstudio/state`:

| Layer | Module | Responsibility |
|-------|--------|---------------|
| Contract | `sceneProvenanceDrilldown.ts` | Diff types (16 discriminated union variants), derivation, description |
| Capture | `sceneProvenanceDrilldown.ts` | `captureProvenanceDrilldownSource` — extract focused before/after slices at edit seam |
| Store | `sceneEditorStore.ts` | Store captured slices in `drilldownBySequence`, keyed by provenance sequence |

The capture step runs inside `applyEdit` at the same seam as provenance append. It extracts only the targeted instance (by metadata `instanceId`) from the before and after instance arrays — not the full scene. Camera operations capture exact `beforeCamera` and `afterCamera` values from the edit seam. Playback operations capture `beforePlayback` and `afterPlayback` `ScenePlaybackConfig` values (FPS, looping). All captured values are shallow copies — never aliased to live state.

#### Diff derivation

`deriveProvenanceDiff` takes a captured source and produces a typed diff:

- **Lifecycle** — instance added/removed with name and position
- **Move** — before/after position coordinates
- **Property** — visibility (Visible/Hidden), opacity (percentage), layer, clip path, parallax
- **Source relationship** — unlink/relink/reapply with link mode transitions and slot-level changes
- **Override** — set/remove/clear-all with slot, mode, and replacement details
- **Camera** — changed fields list with exact before/after camera coordinates (Pan X, Pan Y, Zoom)
- **Playback** — before/after FPS and looping values (or honest fallback for legacy entries)

Each diff type is a discriminated union variant keyed by `type`, enabling type-safe rendering in specialized family components.

#### Selection model

Selection is keyed by provenance `sequence` number (stable, monotonically increasing), not array index (which shifts with newest-first rendering). Selection survives appended entries. Selection clears automatically when the selected entry is removed by `resetHistory`.

### Durability boundaries

| Concern | Persists? | Notes |
|---------|-----------|-------|
| Provenance entries | Yes | Saved with scene document |
| Drilldown source slices | Yes | Saved with scene document |
| Undo/redo history | No | Session-local, resets on scene change or app restart |
| Playback state | No | Not included in provenance, history, or drilldown |
| Restore-from-entry | No | Does not exist — drilldown is read-only inspection |
| Generic raw diff | No | Does not exist — drilldown shows operation-aware focused diffs only |

### Authored operation parity

All 20 authored scene operation kinds participate equally in history, provenance, drilldown, UI rendering, and persistence. No operation kind falls through to generic labeling or silent no-ops.

| Domain | Ops | History | Provenance | Drilldown | UI | Persistence |
|--------|-----|---------|------------|-----------|-----|-------------|
| Instance (8) | add/remove/move/visibility/opacity/layer/clip/parallax | Yes | Yes | Yes | Yes | Yes |
| Character source (3) | reapply/unlink/relink | Yes | Yes | Yes | Yes | Yes |
| Character overrides (3) | set/remove/clear-all | Yes | Yes | Yes | Yes | Yes |
| Camera (1) | set-scene-camera | Yes | Yes | Yes (pan/zoom/reset) | Yes | Yes |
| Authored playback config (1) | set-scene-playback (FPS/looping) | Yes | Yes | Yes | Yes | Yes |
| Keyframes (4) | add/remove/move/edit | Yes | Yes | Yes (tick/position/zoom/interpolation) | Yes | Yes |

**Intentional exclusions (transient preview state):**

| Concern | In law? | Reason |
|---------|---------|--------|
| Current tick position | No | Runtime playhead, not authored truth |
| Play/pause state | No | Preview control, not persisted config |
| Scrub head position | No | Transient UI interaction |
| Camera resolver output | No | Derived from keyframes at runtime |
| Shot derivation | No | Computed from keyframe positions |

`set-scene-playback` is the authored playback configuration (FPS, looping) — it persists with the scene document and flows through the lawful seam. Tick, play/pause, and scrub are transient preview state that remains outside.

Keyframe drilldown sources include `beforeKeyframe` and `afterKeyframe` slices containing `tick`, `x`, `y`, `zoom`, `interpolation`, and optional `name`.

### Current limitations

- No restore-from-entry or jump-to-state action
- No generic raw scene diff viewer — drilldown shows operation-aware focused diffs only
- Provenance is scene-only, not project-wide
- Camera drilldown shows exact before/after values with structured labels (Pan X, Pan Y, Zoom); keyframe drilldown shows tick, position, zoom, and interpolation; playback drilldown shows FPS and looping before/after when captured, with honest fallback for legacy entries
- Undo/redo history does not persist — it resets on scene change or app restart

### Parity closeout (Stage 22)

Authored scene operation parity is complete across all six domains: instances (8 ops), character source relationships (3 ops), character overrides (3 ops), camera (1 op), authored playback configuration (1 op), and keyframes (4 ops). All 20 operation kinds share the same treatment: history, provenance, drilldown, UI rendering, and persistence. No operation kind falls through to generic labeling, silently drops state, or produces fake detail.

Transient preview state (current tick, play/pause, scrub head, camera resolver output, shot derivation) remains intentionally outside the law. This boundary is load-bearing — blurring it would pollute the provenance log with noise that isn't authored truth.

### Diff-depth closeout (Stage 23)

Stage 23 audited drilldown depth across all 20 operation kinds and found parity already complete. The one shallow family (playback — empty payload with no before/after values) was deepened to carry real FPS and looping config. Camera and keyframe renderers were moved onto shared field-config contracts for stable labels and ordering. Keyframe-moved was tightened to show only the tick transition. Legacy or partial persisted entries degrade honestly. Coverage did not change; legibility improved.

### Structured value summary contract (Stage 23)

The `structuredValueSummary` module provides reusable helpers for multi-field before/after summaries in drilldown rendering. Pre-defined field configs exist for camera (`CAMERA_FIELD_CONFIGS`), keyframe (`KEYFRAME_FIELD_CONFIGS`), position (`POSITION_FIELD_CONFIGS`), and playback (`PLAYBACK_FIELD_CONFIGS`). Changed-field extraction produces stable, config-ordered results. Unknown or partial payloads degrade to an honest fallback summary.

### Diff depth (Stage 23)

Coverage parity was already complete before Stage 23. Stage 23 improves explanation depth — how clearly each drilldown entry communicates what changed — without adding new operation kinds or altering coverage.

| Concern | Status | Stage |
|---------|--------|-------|
| Coverage parity (all 20 ops) | Complete | Stage 22 |
| Diff depth (structured rendering) | Improved | Stage 23 |
| Fallback behavior (legacy/partial) | Honest | All stages |

Structured diff summaries now drive three drilldown families:

- **Playback authored config** — `PlaybackDiff` carries `before`/`after` `ScenePlaybackConfig` (FPS, looping). The store tracks `playbackConfig` and passes it through `applyEdit`. Legacy entries without captured config fall back to "Playback settings changed."
- **Camera field labeling** — `CameraDiffView` uses `CAMERA_FIELD_CONFIGS` via `extractChangedFields` for stable label order (Pan X, Pan Y, Zoom) instead of ad-hoc inline checks. Legacy entries without `before`/`after` camera fall back to metadata-only display.
- **Keyframe editing** — `KeyframeDiffView` for edited keyframes uses `KEYFRAME_FIELD_CONFIGS` for stable changed-field extraction. Keyframe-moved now shows only the tick transition, suppressing unchanged x/y/zoom/interpolation noise.

#### Authored playback vs transient playback

Only authored playback configuration gets deep drilldown:

| Playback concept | In drilldown? | Why |
|-----------------|---------------|-----|
| FPS (authored) | Yes | Persisted scene config, changed via `set-scene-playback` |
| Looping (authored) | Yes | Persisted scene config, changed via `set-scene-playback` |
| Current tick | No | Runtime playhead, transient preview state |
| Play/pause | No | Preview control, not authored truth |
| Scrub position | No | Transient UI interaction |

#### Legacy fallback behavior

Persisted playback entries created before Stage 23 have no captured `beforePlayback`/`afterPlayback`. These entries degrade honestly:

- Drilldown shows "Playback settings changed." (generic note, no fake detail)
- Camera entries without captured before/after fall back to metadata-only field names
- The system never invents values that were not captured at the edit seam

**Pinned law:** Absence of captured config is not permission to guess. Older entries remain truthful by showing less, not by fabricating detail.

### Drilldown rendering rules

Drilldown renderers are keyed by `data-family` attribute:

| Family | `data-family` | Structured? | Config used |
|--------|---------------|-------------|-------------|
| Camera | `camera` | Yes | `CAMERA_FIELD_CONFIGS` (Pan X, Pan Y, Zoom) |
| Playback | `playback` | Yes | `PLAYBACK_FIELD_CONFIGS` (FPS, Looping) |
| Keyframe edited | `keyframe` | Yes | `KEYFRAME_FIELD_CONFIGS` (X, Y, Zoom, Interpolation, Name) |
| Keyframe moved | `keyframe` | Tick-only | Suppresses unchanged position/zoom/interpolation |
| Instance/character/override | various | Direct | Field-specific inline rendering |

All structured renderers use `extractChangedFields` from `structuredValueSummary.ts`, which returns fields in config-defined order. This guarantees stable, predictable label ordering regardless of which fields changed.

## Character workflow

GlyphStudio treats characters as a first-class concept above raw layers. A character is not "some layers that happen to look like a person" — it is a structured build with named slots, typed parts, and validation rules.

### Why characters are first-class

The app already has layers, anchors, sockets, presets, and clips. But without an explicit character model, users assemble characters by manually juggling anonymous layers. The character workflow makes assembly intentional: equip parts into slots, validate the build, save and reuse compositions.

### Terminology

The character system uses a consistent vocabulary:

| Term | Meaning |
|------|---------|
| **Build** | A named character composition — slots mapped to equipped parts |
| **Slot** | A body region where exactly one part can be equipped |
| **Part** | A concrete asset/preset reference occupying a slot |
| **Preset** | A catalog entry (part with name, description, metadata) available for equipping |
| **Compatible** | A preset whose declared slot matches and all requirements are met |
| **Warning** | A preset whose slot matches but has unmet socket/anchor requirements |
| **Incompatible** | A preset whose declared slot does not match the target |
| **Valid build** | A build with zero errors (warnings are allowed) |

### Slot vocabulary

Characters are built from parts equipped into body-region slots:

| Slot | Required | Description |
|------|----------|-------------|
| head | yes | Head shape and structure |
| face | no | Facial features, expressions |
| hair | no | Hair style |
| torso | yes | Body / chest |
| arms | yes | Arm structure |
| hands | no | Hand detail, gauntlets |
| legs | yes | Leg structure |
| feet | no | Footwear |
| accessory | no | Earrings, belts, capes |
| back | no | Wings, backpacks, shields |
| weapon | no | Primary weapon |
| offhand | no | Secondary weapon, shield, tool |

One part per slot. Equipping replaces the existing occupant.

### Part references

Each equipped part (`CharacterPartRef`) carries:
- Source preset/asset ID
- Target slot
- Optional variant ID
- Optional tags for filtering
- Required/provided sockets and anchors for compatibility

### Preset application

Parts are selected from a catalog of `CharacterPartPreset` entries. When equipping:

1. The picker filters presets to those targeting the selected slot
2. Each candidate is classified into a compatibility tier:
   - **Compatible** — slot matches, all socket/anchor requirements satisfied
   - **Warning** — slot matches, but some requirements are unmet by the current build
   - **Incompatible** — slot does not match (hidden by default, togglable)
3. Compatible and warning-tier presets are sorted (compatible first) and shown with tier badges
4. Warning-tier presets can still be equipped — warnings inform but do not block
5. Equipping replaces any existing occupant and auto-revalidates the build

Socket/anchor checks exclude the target slot's current occupant since the preset would replace it, but include what the preset itself provides (self-satisfied requirements are valid).

### Validation

Validation derives typed issues from a build:
- `missing_required_slot` (error) — head, torso, arms, or legs unequipped
- `slot_mismatch` (error) — part declares a different slot than it occupies
- `missing_required_socket` (warning) — part needs a socket role no other part provides
- `missing_required_anchor` (warning) — part needs an anchor kind no other part provides

A build is **valid** when it has zero errors. Warnings inform but do not block.

### Slot health states

Each slot in the builder UI shows its current health at a glance:

| State | Meaning | Visual |
|-------|---------|--------|
| Missing | Required slot with no part | Red "Missing" badge |
| Error | Slot has error-severity issues | Red "Error" badge |
| Warning | Slot has warning-severity issues | Yellow "Warning" badge |
| Ready | Part equipped, no issues | Green "Ready" badge |
| Empty | Optional slot with no part | No badge |

### Builder UI structure

The Character Builder panel provides:

1. **Header** — build name (double-click to rename), dirty indicator, build status (New/Saved/Modified), save/save-as/revert/new/clear actions
2. **Validation summary** — error/warning counts, distinct "Valid build" state with success styling
3. **Slot list** — 12 slots in canonical order with health badges, equipped part IDs
4. **Selected slot detail** — part info, remove/replace actions, per-slot issues with related-slot references, required-slot guidance
5. **Preset picker** — inline part selection with compatibility classification, current occupant marker, incompatible toggle
6. **Issue list** — grouped by severity (errors first, then warnings), each with slot badge
7. **Build Library** — saved builds list with load/duplicate/delete, active build marker, timestamps

### Persistence workflow

Character builds are persisted to a **Build Library** stored in localStorage. The persistence layer uses strict type coercion on load to survive schema drift or corruption.

#### Identity model

Three distinct identity concepts prevent confusion:

| Identity | Purpose | Where |
|----------|---------|-------|
| `activeCharacterBuild.id` | Editor build identity | `characterStore` |
| `activeSavedBuildId` | Which saved artifact the editor derives from | `characterStore` |
| `selectedLibraryBuildId` | Which library row is highlighted in the UI | `characterStore` |

#### Save semantics

- **Save** overwrites the library entry matching `activeCharacterBuild.id`. Clears dirty flag, sets `activeSavedBuildId`.
- **Save As New** generates a new ID, forks the build, saves to library. The editor now tracks the new ID as its saved identity.
- **Revert** restores the last saved version from library (by `activeSavedBuildId`), clears dirty flag.

#### Dirty state

Any edit (name change, equip, unequip) sets `isDirty = true`. Save/load/revert clears it. Deleting the active saved build orphans the editor (clears `activeSavedBuildId`, marks dirty).

#### Load protection

When `isDirty` is true, loading a library build triggers an inline confirmation ("Discard changes? Yes/No") instead of immediately loading.

#### Library operations

All library operations are immutable — they return new library instances. The `onLibraryChange` callback notifies the parent for storage persistence.

| Operation | Behavior |
|-----------|----------|
| Save | Upsert by ID, prepend to list, refresh `updatedAt` |
| Duplicate | New ID, smart name ("Copy", "Copy 2", …), prepend |
| Delete | Remove by ID, orphan editor if active build deleted |
| Load | Copy saved build into editor, set `activeSavedBuildId` |

#### Storage format

```
localStorage key: glyphstudio_character_builds
Schema version: CHARACTER_BUILD_LIBRARY_VERSION (1)
Format: { schemaVersion, builds: SavedCharacterBuild[] }
```

Version mismatches or parse failures fall back to an empty library.

### Character → scene bridge

Character Builds can be placed into scenes as **Character Instances** — scene-level objects that carry a snapshot of their source build.

#### Core concepts

| Term | Meaning |
|---|---|
| **Character Build** | Reusable authoring artifact — slots mapped to equipped parts |
| **Character Instance** | Scene-level snapshot created from a build via placement |
| **Source Build** | The saved library build the instance was created from |
| **Snapshot** | Frozen record of slot assignments at placement time |
| **Link Mode** | Whether the instance participates in inheritance/reapply (`linked` or `unlinked`) |
| **Source Status** | Derived runtime classification: `linked`, `missing-source`, `unlinked`, or `not-character` |

#### Placement law

Placement creates an independent copy. The scene instance records:

- `instanceKind: 'character'` — marks it as character-derived
- `sourceCharacterBuildId` — which saved build it came from
- `sourceCharacterBuildName` — build name at placement time
- `characterSlotSnapshot` — frozen slot→part mapping with equipped count
- `characterLinkMode` — absent (defaults to `'linked'`) or `'unlinked'`

Future edits to the source build do **not** automatically propagate. The snapshot is independent.

#### Reapply law

Users can manually refresh a placed instance from its source build:

- **Reapply from Source** updates: build name, slot snapshot
- **Preserved**: position (x/y), z-order, visibility, opacity, parallax, instance ID, **local overrides**
- Source lookup uses `sourceCharacterBuildId` against the saved build library
- If the source build no longer exists, reapply is blocked (not silently skipped)
- After reapply, inherited slots reflect the new source; overridden slots keep their local override
- Clearing an override after reapply reveals the newly inherited part, not the old snapshot

There is no automatic live sync. Reapply is always manual and explicit.

#### Missing-source law

If a source build is deleted from the library after placement:

- The instance retains its `sourceCharacterBuildId` and existing snapshot
- The instance still works as scene content (it has its own snapshot data)
- Source status shows "Source missing"
- Reapply is disabled until the source is available again
- The source ID is never silently cleared

#### Link mode law

Link mode (`CharacterSourceLinkMode`) controls whether a character instance participates in source inheritance and reapply behavior. It is separate from source presence — an instance may remember its source build ID while being unlinked.

| Mode | Meaning |
|---|---|
| `'linked'` (default) | Instance tracks its source build. Reapply is available when source exists. Stale detection is active. |
| `'unlinked'` | Source relationship intentionally severed by operator. Reapply is blocked. Stale detection is suppressed. |

Key truths:
- `characterLinkMode` is optional — absent means `'linked'` (no migration needed)
- Unlinked is **not** the same as missing. Missing is an error state; unlinked is an intentional operator decision.
- An unlinked instance still stores its `sourceCharacterBuildId` — the memory is preserved, only the behavior changes.

Persistence contract:
- `characterLinkMode` survives save/load round-trips via the `.pscn` scene file format
- Absent field on load means linked (backward compatible with older scene files)
- Explicit `'unlinked'` is serialized and restored exactly
- Snapshot, overrides, and `sourceCharacterBuildId` are preserved through the unlinked state across save/load
- Unlink and relink operations set the backend dirty flag, ensuring the change is included in the next save
- Undo/redo for scene operations is implemented via `sceneEditorStore` with full-snapshot history; unlink/relink participate in the history stack

#### Source status derivation

Source status (`CharacterSourceStatus`) is derived at runtime from link mode + library lookup:

| Status | Condition | UI presentation |
|---|---|---|
| `'linked'` | Character instance, linked mode, source build exists in library | "Linked" |
| `'missing-source'` | Character instance, linked mode, source build **not** in library | "Source missing" |
| `'unlinked'` | Character instance, unlinked mode (regardless of source presence) | "Unlinked" |
| `'not-character'` | Not a character instance | (no character UI) |

Derivation rules:
- Unlinked takes priority over library lookup — an unlinked instance always reports `'unlinked'`, even if the source build still exists
- Stale detection (`isSnapshotPossiblyStale`) returns `false` for unlinked instances
- Stale is not a status value — it is a secondary indicator shown only on `'linked'` instances when the snapshot diverges from the current source build

#### Relationship operations

**Unlink** (`unlinkFromSource`) — sever the source relationship:
- Preserves snapshot exactly as-is
- Preserves all local overrides
- Preserves the remembered `sourceCharacterBuildId`
- Changes only `characterLinkMode` to `'unlinked'`
- After unlink: reapply is blocked, stale hint disappears

**Relink** (`relinkToSource`) — restore the source relationship:
- Clears `characterLinkMode` (restores default `'linked'` behavior)
- Does **not** mutate snapshot or overrides
- Derived status recalculates immediately after relink
- Stale hint may reappear if the source changed while the instance was detached

#### Reapply vs relink

These are different operations with different effects:

| Operation | When available | What it does | What it preserves |
|---|---|---|---|
| **Reapply from Source** | Linked + source exists | Refreshes snapshot from current source build | Local overrides, scene-local state |
| **Relink to Source** | Unlinked + source exists | Re-enables the relationship only | Snapshot, overrides, scene-local state |

Pinned laws:
- Reapply and Relink are mutually exclusive — they never both apply to the same instance
- Reapply updates inherited data; Relink only changes the relationship mode
- Relinking does not itself rewrite the snapshot — the operator must explicitly Reapply after relinking if they want fresh data

#### Missing-source + unlinked behavior

| State | Reapply | Relink | Snapshot |
|---|---|---|---|
| Linked + source exists | Available | N/A | Usable, may be stale |
| Linked + source missing | Blocked | N/A | Usable, preserved |
| Unlinked + source exists | Blocked | Available | Usable, stale suppressed |
| Unlinked + source missing | Blocked | Blocked | Usable, preserved |

In all cases the snapshot remains usable as scene content. Missing source never erases or invalidates the local snapshot.

#### Placeability rules

A build can be placed into a scene only when:

1. The build exists (is not null)
2. At least one slot is equipped
3. There are zero validation errors (warnings are allowed)

#### Scene-local state

These fields belong to the scene instance, not the source build:

`x`, `y`, `zOrder`, `visible`, `opacity`, `parallax`, `clipId`, `name`

Reapply never touches scene-local state.

#### Local overrides

Character instances support per-slot local overrides that layer on top of the inherited snapshot:

| Override mode | Effect |
|---|---|
| **Replace** | Swap the slot occupant with a different part |
| **Remove** | Hide/delete the slot from the effective composition |

Override rules:
- Overrides are scene-local — they do not mutate the source Character Build
- Overrides are preserved across reapply (they layer on top of the refreshed snapshot)
- The effective composition is always: snapshot + overrides
- Stale detection compares snapshot vs source, not overrides vs source
- An inline slot picker classifies candidates by compatibility tier (compatible, warning, incompatible)

The `CharacterSourceStatus` type (`'linked' | 'missing-source' | 'unlinked' | 'not-character'`) covers all current relationship states. Future states like `'conflicted'` can be added without breaking existing code.

#### Current limitations

The bridge does not currently support:

- Automatic live sync between builds and instances
- Source/instance diff viewer
- Scene-side source build mutation
- Per-slot transform/anchor/socket overrides (only part replacement and removal)
- Override conflict resolution (e.g. when a reapplied source removes a slot that has an override)

These are potential future extensions. The `sourceCharacterBuildId`, `instanceKind`, `characterLinkMode`, and `CharacterSourceStatus` fields provide clean seams for attaching them.
