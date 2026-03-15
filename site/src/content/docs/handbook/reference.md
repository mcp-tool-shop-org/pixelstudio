---
title: API Reference
description: Backend command and event reference for GlyphStudio
sidebar:
  order: 4
---

GlyphStudio's backend exposes Tauri commands organized by domain. Commands marked with **[live]** are fully implemented; others are planned stubs.

## Canvas commands [live]

| Command | Description |
|---------|------------|
| `init_canvas` | Initialize pixel buffer with width/height, creates default layer, returns composited frame |
| `get_canvas_state` | Return full composited RGBA frame + layer metadata + undo/redo state |
| `write_pixel` | Write a single pixel to a layer (legacy, outside stroke transactions) |
| `read_pixel` | Read pixel from composite or specific layer (for color picker) |

## Stroke commands [live]

| Command | Description |
|---------|------------|
| `begin_stroke` | Open a stroke transaction with tool name and RGBA color; validates layer is editable |
| `stroke_points` | Append pixel coordinates to active stroke; records before/after patches per pixel |
| `end_stroke` | Commit stroke to undo stack, clear redo stack, return composited frame |

## Undo/Redo commands [live]

| Command | Description |
|---------|------------|
| `undo` | Revert the last committed stroke (applies `before` patches), return composited frame |
| `redo` | Re-apply an undone stroke (applies `after` patches), return composited frame |

## Layer commands [live]

| Command | Description |
|---------|------------|
| `create_layer` | Add a new transparent layer, auto-name, set as active |
| `delete_layer` | Remove a layer (cannot delete the last one) |
| `rename_layer` | Set layer name |
| `select_layer` | Set active layer for editing |
| `set_layer_visibility` | Toggle layer visibility (hidden layers excluded from composite) |
| `set_layer_lock` | Toggle layer lock (locked layers reject stroke writes) |
| `set_layer_opacity` | Set layer opacity (0.0–1.0, affects compositing) |
| `reorder_layer` | Move layer to a new position in the stack |

## Project commands [live]

| Command | Description |
|---------|------------|
| `new_project` | Create a new blank project with name, canvas size, color mode; initializes canvas state |
| `open_project` | Load project from .pxs file, rehydrate canvas state |
| `save_project` | Serialize and persist project to .pxs file |
| `get_project_info` | Get current project metadata (id, name, path, dirty state) with frame |
| `mark_dirty` | Mark the project as dirty after mutations |
| `list_recent_projects` | Get recent project list from local storage |
| `export_png` | Export composited frame as PNG file |
| `export_frame_sequence` | Export all frames as numbered PNG files (name_0001.png, ...) |
| `export_sprite_strip` | Export all frames as a single horizontal or vertical PNG strip |

## Recovery commands [live]

| Command | Description |
|---------|------------|
| `autosave_recovery` | Write a recovery snapshot to the recovery directory |
| `check_recovery` | Detect recoverable projects from a previous unclean shutdown |
| `restore_recovery` | Restore a project from a recovery file, rehydrate canvas state |
| `discard_recovery` | Delete a recovery file without restoring |

## Selection commands [live]

| Command | Description |
|---------|------------|
| `set_selection_rect` | Set rectangular selection bounds (x, y, width, height) |
| `clear_selection` | Clear the current selection |
| `get_selection` | Get current selection bounds (or null) |
| `copy_selection` | Copy selected pixels from active layer to clipboard |
| `cut_selection` | Copy selected pixels then clear to transparent, return frame |
| `paste_selection` | Paste clipboard at selection origin (or top-left), return frame |
| `delete_selection` | Clear selected pixels to transparent, return frame |

## Transform commands [live]

| Command | Description |
|---------|------------|
| `begin_selection_transform` | Extract selected pixels into floating payload, clear source region |
| `move_selection_preview` | Move payload to absolute offset from source origin |
| `nudge_selection` | Nudge payload by relative delta (dx, dy) |
| `commit_selection_transform` | Stamp payload at final position, end session, return frame |
| `cancel_selection_transform` | Restore original pixels, end session, return frame |
| `flip_selection_horizontal` | Flip the floating payload horizontally |
| `flip_selection_vertical` | Flip the floating payload vertically |
| `rotate_selection_90_cw` | Rotate the floating payload 90° clockwise |
| `rotate_selection_90_ccw` | Rotate the floating payload 90° counter-clockwise |

Transform commands (except commit/cancel) return a `TransformPreview`:

```typescript
interface TransformPreview {
  sourceX: number;
  sourceY: number;
  payloadWidth: number;
  payloadHeight: number;
  offsetX: number;
  offsetY: number;
  payloadData: number[];  // RGBA flat array
  frame: CanvasFrame;     // Current canvas state (source cleared)
}
```

## Timeline commands [live]

| Command | Description |
|---------|------------|
| `get_timeline` | Get frame list, active frame, and canvas state |
| `create_frame` | Create a new blank frame with one layer, switch to it |
| `duplicate_frame` | Deep copy current frame (all layers), switch to copy |
| `delete_frame` | Delete frame by id (cannot delete last frame) |
| `select_frame` | Switch to frame by id, stash/restore layer data |
| `rename_frame` | Rename a frame by id |
| `reorder_frame` | Move frame to a new position in the timeline |
| `insert_frame_at` | Insert a blank frame at a specific position |
| `duplicate_frame_at` | Deep copy current frame to a specific position |
| `set_frame_duration` | Set or clear per-frame duration override (ms) |
| `get_onion_skin_frames` | Get composited previous/next frame data for onion skin overlay |

Timeline commands return a `TimelineState`:

```typescript
interface TimelineState {
  frames: FrameInfo[];
  activeFrameIndex: number;
  activeFrameId: string;
  frame: CanvasFrame;
}

interface FrameInfo {
  id: string;
  name: string;
  index: number;
  durationMs: number | null;  // per-frame timing override
}
```

`get_onion_skin_frames` returns an `OnionSkinData`:

```typescript
interface OnionSkinData {
  width: number;
  height: number;
  prevData: number[] | null;  // composited RGBA of previous frame
  nextData: number[] | null;  // composited RGBA of next frame
}
```

## Palette commands (planned)

| Command | Description |
|---------|------------|
| `get_palette_catalog` | List available palettes and contracts |
| `apply_palette_operation` | Update slots, create ramps, set contract, remap, quantize |
| `preview_palette_remap` | Non-destructive remap preview with pixel counts |

## AI orchestration commands (planned)

| Command | Description |
|---------|------------|
| `queue_ai_job` | Queue a generation/analysis job with prompt, palette mode, candidate count |
| `cancel_ai_job` | Cancel a running job |
| `get_ai_job` | Get job state and candidate references |
| `accept_ai_candidate` | Accept a candidate as new layer, draft layer, or draft track |
| `discard_ai_candidate` | Mark candidate for cleanup |

### AI job types

`region-draft` · `variant-proposal` · `cleanup` · `requantize` · `silhouette-repair` · `inbetween` · `locomotion-draft` · `workflow-run`

## Motion assistance commands [live]

| Command | Description |
|---------|------------|
| `begin_motion_session` | Start a motion session, capture source pixels from selection/anchor/frame |
| `generate_motion_proposals` | Generate deterministic motion proposals for the active session |
| `get_motion_session` | Get current motion session state (or null) |
| `accept_motion_proposal` | Select a proposal for later commit |
| `reject_motion_proposal` | Deselect the current proposal |
| `cancel_motion_session` | Cancel the session entirely, project unchanged |
| `commit_motion_proposal` | Commit selected proposal as real timeline frames (insert after active) |
| `undo_motion_commit` | Undo the last motion commit (remove inserted frames) |
| `redo_motion_commit` | Redo an undone motion commit (re-insert stashed frames) |
| `list_motion_templates` | List available motion templates with anchor requirements |
| `apply_motion_template` | Start a motion session using a template (auto-selects best anchor) |

Motion session commands return a `MotionSessionInfo`:

```typescript
interface MotionSessionInfo {
  sessionId: string;
  intent: string;           // idle_bob | walk_cycle_stub | run_cycle_stub | hop
  direction: string | null; // left | right | up | down
  targetMode: string;       // active_selection | anchor_binding | whole_frame
  outputFrameCount: number; // 2 or 4
  sourceFrameId: string;
  anchorKind: string | null; // head | torso | arm_left | ... (when anchor-targeted)
  proposals: MotionProposalInfo[];
  selectedProposalId: string | null;
  status: string;           // configuring | generating | reviewing | committing | error
}

interface MotionProposalInfo {
  id: string;
  label: string;
  description: string;
  previewFrames: number[][]; // RGBA flat arrays, one per generated frame
  previewWidth: number;
  previewHeight: number;
}
```

`commit_motion_proposal`, `undo_motion_commit`, and `redo_motion_commit` return a `MotionCommitResult`:

```typescript
interface MotionCommitResult {
  insertedFrameIds: string[];  // IDs of frames added to timeline
  activeFrameId: string;       // current active frame after operation
  activeFrameIndex: number;
}
```

## Anchor commands [live]

| Command | Description |
|---------|------------|
| `create_anchor` | Create an anchor on the active frame (kind, position, optional name) |
| `update_anchor` | Update anchor position, name, or kind |
| `delete_anchor` | Remove an anchor from the active frame |
| `list_anchors` | List all anchors on the active frame |
| `bind_anchor_to_selection` | Bind the current selection rectangle as an anchor's target region |
| `clear_anchor_binding` | Clear the bound region from an anchor |
| `move_anchor` | Move anchor to new position (for drag) |
| `resize_anchor_bounds` | Resize an anchor's bound region |
| `validate_anchors` | Check for duplicate names, out-of-canvas positions, empty bounds |
| `copy_anchors_to_frame` | Copy anchors to a specific target frame (by name matching) |
| `copy_anchors_to_all_frames` | Copy anchors to all other frames |
| `propagate_anchor_updates` | Push a single anchor's changes to matching anchors on all frames |
| `set_anchor_parent` | Set parent anchor by name (validates cycles, self-parenting, missing parent) |
| `clear_anchor_parent` | Clear parent, making anchor a root |
| `set_anchor_falloff` | Set falloff weight (clamped 0.1–3.0) for hierarchy-scaled motion |

Anchor commands return an `AnchorInfo`:

```typescript
interface AnchorInfo {
  id: string;
  name: string;
  kind: string;       // head | torso | arm_left | arm_right | leg_left | leg_right | custom
  x: number;
  y: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
  parentName: string | null;
  falloffWeight: number;       // 0.1–3.0, default 1.0
}
```

**Hierarchy behavior:**
- `delete_anchor` clears `parentName` on any children referencing the deleted anchor
- `update_anchor` with name change updates children's `parentName` to the new name
- `propagate_anchor_updates` includes `parentName` and `falloffWeight` in propagation
- Secondary-motion amplitude scales by `(1 + depth) * falloffWeight` — deeper anchors move more

## Sandbox commands [live]

| Command | Description |
|---------|------------|
| `begin_sandbox_session` | Open sandbox from a frame span — composites each frame, stores isolated previews. Never mutates project state. |
| `get_sandbox_session` | Return current sandbox session info (or null if none active) |
| `close_sandbox_session` | Close sandbox session, free preview data |
| `analyze_sandbox_motion` | Deterministic motion analysis — loop closure, drift, timing, issues. Requires active sandbox session. |
| `get_sandbox_anchor_paths` | Extract anchor paths across the sandbox frame span with per-frame coordinates, contact heuristics. Matches by name. |
| `apply_sandbox_timing` | Apply uniform duration to the sandbox span frames. Validates span still exists (stale-session check). Stays in sandbox after apply. |
| `duplicate_sandbox_span` | Deep-copy the sandbox span (layers, anchors, duration) and insert after the original. New IDs throughout. Jumps timeline to first new frame. |

Sandbox sessions return a `SandboxSessionInfo`:

```typescript
interface SandboxSessionInfo {
  sessionId: string;
  source: 'timeline_span' | 'motion_proposal';
  startFrameIndex: number;
  endFrameIndex: number;
  frameCount: number;
  previewFrames: number[][];  // composited RGBA per frame
  previewWidth: number;
  previewHeight: number;
}
```

Analysis returns a `SandboxMetricsSummary`:

```typescript
interface SandboxMetricsSummary {
  sessionId: string;
  frameCount: number;
  previewWidth: number;
  previewHeight: number;
  bboxes: (BBoxInfo | null)[];       // per-frame bounding box
  adjacentDeltas: number[];           // normalized frame-to-frame deltas
  loopDiagnostics: LoopDiagnostics;   // first/last frame similarity
  driftDiagnostics: DriftDiagnostics; // center-of-mass translation
  timingDiagnostics: TimingDiagnostics; // cadence and abruptness
  issues: DiagnosticIssue[];          // max 5, ordered by severity
}
```

Anchor paths return a `SandboxAnchorPathsResult`:

```typescript
interface AnchorPathInfo {
  anchorName: string;
  anchorKind: string;
  samples: AnchorPointSample[];  // per-frame {frameIndex, x, y, present}
  contactHints: ContactHint[];   // {frameIndex, label, confidence}
  totalDistance: number;
  maxDisplacement: number;
}
```

Apply timing returns a `SandboxTimingApplyResult`:

```typescript
interface SandboxTimingApplyResult {
  sessionId: string;
  framesAffected: number;
  durationMs: number | null;
}
```

Duplicate span returns a `SandboxDuplicateSpanResult`:

```typescript
interface SandboxDuplicateSpanResult {
  sessionId: string;
  newFrameIds: string[];
  insertPosition: number;
  firstNewFrameId: string;
}
```

## Secondary motion commands [live]

| Command | Description |
|---------|------------|
| `list_secondary_motion_templates` | List all environmental/secondary motion templates with hints and hierarchy metadata. |
| `apply_secondary_motion_template` | Begin a motion session using a secondary template with direction, strength, frame count, and phase offset. Amplitude scales by anchor hierarchy depth and falloff weight. |
| `check_secondary_readiness` | Check template readiness against current frame anchors. Returns tier (ready/limited/blocked), anchor summary, hierarchy status, and fix hints. |

Available templates: `wind_soft`, `wind_medium`, `wind_gust`, `idle_sway`, `hanging_swing`, `foliage_rustle`.

Parameters: `direction` (optional), `strength` (0.1–2.0), `frameCount` (2/4/6), `phaseOffset` (0–TAU).

Readiness returns a `SecondaryReadinessInfo`:

```typescript
interface SecondaryReadinessInfo {
  templateId: string;
  templateName: string;
  tier: 'ready' | 'limited' | 'blocked';
  totalAnchors: number;
  rootAnchors: string[];
  childAnchors: string[];
  hierarchyPresent: boolean;
  hierarchyBeneficial: boolean;
  notes: string[];
  fixHints: string[];
}
```

## Preset commands

| Command | Description |
|---------|------------|
| `save_motion_preset` | Save a new preset with name, kind (locomotion/secondary_motion), anchors, and motion settings. |
| `list_motion_presets` | List all saved presets (summary only — ID, name, kind, anchor count, hierarchy flag). |
| `get_motion_preset` | Get full preset document by ID (anchors, motion settings, timestamps). |
| `delete_motion_preset` | Delete a preset by ID. |
| `rename_motion_preset` | Rename a preset. Returns updated summary. |
| `apply_motion_preset` | Apply a preset to the current frame — creates missing anchors, updates existing by name, skips at 8-anchor limit. Accepts optional `overrides` (strength, direction, phaseOffset). Returns `PresetApplyResult`. |
| `apply_motion_preset_to_span` | Batch-apply a preset to a range of frames (inclusive, 0-based). Max 64 frames. Accepts optional `overrides`. Returns `BatchApplyResult`. |
| `apply_motion_preset_to_all_frames` | Batch-apply a preset to every frame. Accepts optional `overrides`. Returns `BatchApplyResult`. |
| `check_motion_preset_compatibility` | Check how well a preset matches the current frame. Returns tier (compatible/partial/incompatible), matching/missing/extra anchors, and notes. |
| `preview_motion_preset_apply` | Non-mutating preview — shows per-anchor diffs (create/update/skip), effective settings after overrides, and warnings. Accepts `scope` ("current"/"span"/"all"). |

Apply result:

```typescript
interface PresetApplyResult {
  createdAnchors: string[];
  updatedAnchors: string[];
  skipped: string[];
  warnings: string[];
  appliedSettings?: PresetMotionSettings;
}
```

Batch apply result:

```typescript
interface BatchApplyResult {
  totalFrames: number;
  appliedFrames: number;
  skippedFrames: number;
  perFrame: BatchFrameResult[];
  summary: string[];
  appliedSettings?: PresetMotionSettings;
}
```

Overrides (optional, does not modify saved preset):

```typescript
interface PresetApplyOverrides {
  strength?: number;    // 0.1–2.0
  direction?: string;   // left/right/up/down
  phaseOffset?: number; // 0–TAU
}
```

Preview result:

```typescript
interface PresetPreviewResult {
  presetName: string;
  presetKind: MotionPresetKind;
  anchorDiffs: PresetAnchorDiff[];
  effectiveSettings: PresetMotionSettings;
  warnings: string[];
  scopeFrames: number;
}
```

Compatibility result:

```typescript
interface PresetCompatibility {
  tier: 'compatible' | 'partial' | 'incompatible';
  matchingAnchors: string[];
  missingAnchors: string[];
  extraAnchors: string[];
  wouldExceedLimit: boolean;
  notes: string[];
}
```

Presets are persisted at `%LOCALAPPDATA%/GlyphStudio/presets/{id}.preset.json` (user-level, not project-embedded). Overrides are transient — they only affect the current apply and never mutate saved preset defaults.

## Locomotion analysis commands (planned)

| Command | Description |
|---------|------------|
| `analyze_locomotion` | Analyze weight class, cadence, stride, contact timing, CoM path |
| `plan_locomotion` | Propose motion plan with movement type and target feel |
| `generate_locomotion_draft_track` | Generate constrained draft frames from a plan |

## Validation commands (planned)

| Command | Description |
|---------|------------|
| `run_validation` | Run scoped or full validation across categories |
| `preview_validation_repair` | Non-destructive repair preview |
| `apply_validation_repair` | Apply a suggested repair |

## Response format

All canvas/layer/stroke commands return a `CanvasFrame`:

```typescript
interface CanvasFrame {
  width: number;
  height: number;
  data: number[];        // RGBA flat array (width × height × 4)
  layers: LayerInfo[];   // Layer metadata for the panel
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}
```

## Clip commands [live]

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `create_clip` | `name: string, startFrame: number, endFrame: number` | `ClipInfo` | Create a named clip spanning the given frame range |
| `list_clips` | — | `ClipInfo[]` | List all clips in the project with validation warnings |
| `update_clip` | `clipId: string, name?, startFrame?, endFrame?, loopClip?, fpsOverride?, tags?` | `ClipInfo` | Update any clip properties; broken ranges warn instead of silently clamping |
| `delete_clip` | `clipId: string` | `void` | Remove a clip definition |
| `validate_clips` | — | `ClipValidationResult` | Validate all clips against current frame topology without modifying anything |
| `set_clip_pivot` | `clipId: string, mode: PivotMode, customX?: number, customY?: number` | `ClipInfo` | Set or update a clip's pivot/origin point |
| `clear_clip_pivot` | `clipId: string` | `ClipInfo` | Remove a clip's pivot (revert to no pivot) |
| `set_clip_tags` | `clipId: string, tags: string[]` | `ClipInfo` | Replace all tags (normalized, deduped, max 16) |
| `add_clip_tag` | `clipId: string, tag: string` | `ClipInfo` | Add a single tag (normalized, deduped, rejects empty/over-limit) |
| `remove_clip_tag` | `clipId: string, tag: string` | `ClipInfo` | Remove a tag by value |

### ClipInfo

```typescript
type ClipValidity = 'valid' | 'warning' | 'invalid';
type PivotMode = 'center' | 'bottom_center' | 'custom';

interface PivotPoint { x: number; y: number; }

interface ClipPivot {
  mode: PivotMode;
  customPoint?: PivotPoint | null;  // pixel coords for custom mode
}

interface ClipInfo {
  id: string;
  name: string;
  startFrame: number;      // 0-based inclusive
  endFrame: number;        // 0-based inclusive
  frameCount: number;
  loopClip: boolean;
  fpsOverride: number | null;
  tags: string[];
  pivot: ClipPivot | null;  // clip-level pivot/origin
  warnings: string[];      // non-empty when range is questionable
  validity: ClipValidity;  // valid / warning / invalid
}

interface ClipValidationResult {
  totalClips: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  clips: ClipInfo[];
}
```

## Export commands [live]

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `preview_sprite_sheet_layout` | `scope: ExportScope, layout: ExportLayout` | `ExportPreviewResult` | Non-mutating layout preview — returns placement rects, dimensions, clip grouping, warnings |
| `export_clip_sequence` | `clipId: string, dirPath: string` | `ExportResult` | Export one clip as numbered PNG sequence; collision-safe naming |
| `export_clip_sheet` | `clipId: string, filePath: string, layout: ExportLayout, emitManifest?: boolean, manifestFormat?: ManifestFormat` | `ExportResult` | Export one clip as sprite sheet (strip or grid), optional manifest in chosen format; collision-safe naming |
| `export_all_clips_sheet` | `filePath: string, layout: ExportLayout, emitManifest?: boolean, manifestFormat?: ManifestFormat` | `ExportResult` | Export all valid clips into one combined sheet; invalid clips skipped with warning; collision-safe naming |
| `export_clip_sequence_with_manifest` | `clipId: string, dirPath: string, manifestFormat?: ManifestFormat` | `ExportResult` | Export one clip as numbered PNGs + JSON manifest in chosen format; collision-safe naming |

### ExportScope

```typescript
type ExportScope =
  | { type: 'current_frame' }
  | { type: 'selected_span'; start: number; end: number }
  | { type: 'current_clip'; clipId: string }
  | { type: 'all_clips' };
```

### ExportLayout

```typescript
type ExportLayout =
  | { type: 'horizontal_strip' }
  | { type: 'vertical_strip' }
  | { type: 'grid'; columns?: number | null };
```

### ManifestFormat

```typescript
type ManifestFormat = 'glyphstudio_native' | 'generic_runtime';
```

- **glyphstudio_native** (default): Rich manifest with export type, sheet dimensions, grid layout, generated timestamp, per-clip placements and files.
- **generic_runtime**: Lean runtime manifest with just frame dimensions, per-clip start index, count, loop flag, fps, tags, pivot, and placement/file data. No timestamps or sheet metadata — designed for game engines.

### ExportPreviewResult

```typescript
interface ExportPreviewResult {
  outputWidth: number;
  outputHeight: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  placements: ExportPreviewFramePlacement[];
  clipGroups: ExportPreviewClipGroup[];
  warnings: string[];
}
```

### ExportResult

```typescript
interface ExportResult {
  files: ExportedFileInfo[];
  manifest: ExportedFileInfo | null;
  frameCount: number;
  clipCount: number;
  skippedClips: number;    // invalid clips skipped (all-clips export)
  wasSuffixed: boolean;    // true if any filename was suffixed to avoid overwrite
  warnings: string[];
}

interface ExportedFileInfo {
  path: string;
  width: number;
  height: number;
}
```

### Export settings persistence

Export settings are persisted in localStorage (user-local, not in the project file):

- **Scope**, **layout**, **selected clip**, **span range**, **manifest toggle + format**, **last output directory/file**
- Restored on panel mount with graceful fallback: missing clips fall back to first available, out-of-bounds spans are clamped
- Export settings are never part of undo history or project data

### Export Again

The **Export Again** button re-runs the most recent export to the same output path without showing a save dialog.

- Only enabled when preview is fresh (not stale) and a previous export succeeded with a valid path
- If the previously exported clip no longer exists, blocks with a clear error
- Collision safety still applies — existing files are suffixed, never silently overwritten
- When preview is stale, the panel shows a compact last-export summary with a "Preview again to re-export" hint

## Asset catalog commands [live]

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `list_assets` | — | `AssetSummary[]` | List all catalog entries with file existence check |
| `get_asset_catalog_entry` | `assetId: string` | `AssetSummary` | Get a single catalog entry by ID |
| `upsert_asset_catalog_entry` | `id?: string, name: string, filePath: string, kind: AssetKind, tags?: string[], canvasWidth?: number, canvasHeight?: number, frameCount?: number, clipCount?: number, thumbnailPath?: string` | `AssetSummary` | Insert or update a catalog entry; creates new ID if none provided |
| `remove_asset_catalog_entry` | `assetId: string` | `boolean` | Remove from catalog (does NOT delete the project file) |
| `refresh_asset_catalog` | — | `AssetSummary[]` | Re-check file existence for all entries |
| `generate_asset_thumbnail` | — (uses current canvas) | `string` | Generate a 64×64 PNG thumbnail from the first frame of the open project; returns the thumbnail file path |

### AssetKind

```typescript
type AssetKind = 'character' | 'prop' | 'environment' | 'effect' | 'ui' | 'custom';
```

### AssetStatus

```typescript
type AssetStatus = 'ok' | 'missing';
```

### AssetSummary

```typescript
interface AssetSummary {
  id: string;
  name: string;
  filePath: string;
  kind: AssetKind;
  tags: string[];
  createdAt: string;   // ISO 8601
  updatedAt: string;   // ISO 8601
  canvasWidth: number;
  canvasHeight: number;
  frameCount: number;
  clipCount: number;
  thumbnailPath: string | null;
  status: AssetStatus;  // 'ok' or 'missing' based on file check
}
```

The catalog is stored at `{data_local_dir}/GlyphStudio/asset-catalog.json`, separate from project files. It is an index layer — removing a catalog entry never deletes the backing `.pxs` file.

### Lifecycle sync

The catalog is automatically updated during project lifecycle operations:

- **`save_project`** — upserts the current project's catalog entry with fresh metadata (name, canvas size, frame/clip counts, timestamps, thumbnail). User-managed fields (kind, tags) are preserved from existing entries.
- **`open_project`** — ensures the opened project exists in the catalog with current metadata and a fresh thumbnail.
- **New projects** are cataloged on their first save (no file path = no catalog entry yet).
- **Save As** (save with a new file path) creates or updates the entry for the new path. The old path entry remains independently.
- Catalog sync is best-effort — failures never block the actual save/open operation.

### Thumbnails

Thumbnails are 64×64 PNG images generated by nearest-neighbor downscale from the first composited frame. This preserves the crisp pixel-art look at small sizes. Thumbnails are stored at `{data_local_dir}/GlyphStudio/thumbnails/{frame-id}.png` with deterministic paths based on the first frame's ID.

Thumbnails are generated automatically during lifecycle sync (save/open) and can be requested explicitly via `generate_asset_thumbnail`. If generation fails, the existing thumbnail is preserved; if no thumbnail exists, the asset browser shows a kind-badge placeholder instead.

### Asset browser

The asset browser panel (mounted in the RightDock "Assets" tab) provides:

- **Thumbnail rendering** — each row shows the asset's thumbnail via `convertFileSrc` (Tauri local file → webview URL), with `image-rendering: pixelated` for crisp display. Falls back to a kind-badge placeholder (CHR, PRP, ENV, etc.) when no thumbnail is available or the image fails to load.
- **Search + filter + sort** — search by name/tag/kind, filter by kind or status, sort by recent/alpha/kind.
- **Selection + quick preview** — clicking a row selects it and opens a preview pane with larger thumbnail, full metadata (kind, canvas size, frames, clips, status, updated date, tags), file path, and an Open button. Clicking the same row toggles the preview closed. Selection persists across catalog refreshes (cleared only if the asset is removed).
- **Current-project highlight** — the open project is marked with an accent border and "Open" badge. Path comparison is slash-normalized for cross-platform correctness.
- **Auto-refresh** — the list refreshes after save/open lifecycle events.

## Bundle Packaging

### Commands

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `preview_asset_bundle` | `bundleName: string, exportAction: 'sequence' \| 'sheet' \| 'all_clips_sheet', clipId?: string, layout: ExportLayout, manifestFormat?: ManifestFormat, contents?: ExportBundleContents` | `BundlePreviewResult` | Preview bundle file list before export (authoritative) |
| `export_asset_bundle` | `outputPath: string, bundleName: string, format: 'folder' \| 'zip', exportAction, clipId?, layout, manifestFormat?, contents?` | `ExportBundleResult` | Export a portable asset bundle as folder or zip |
| `preview_catalog_bundle` | `assetIds: string[], includeManifest?: bool, includePreview?: bool` | `CatalogBundlePreviewResult` | Preview a multi-asset catalog bundle (per-asset status + file counts) |
| `export_catalog_bundle` | `assetIds: string[], outputPath: string, bundleName: string, format: 'folder' \| 'zip', includeManifest?, includePreview?, layout: ExportLayout, manifestFormat?` | `CatalogBundleExportResult` | Export a multi-asset catalog bundle with per-asset subfolders |

### ExportBundleContents

```typescript
interface ExportBundleContents {
  images: boolean;    // sprite sheet or sequence
  manifest: boolean;  // manifest JSON
  preview: boolean;   // 128×128 thumbnail
}
```

### BundlePreviewResult

```typescript
interface BundlePreviewResult {
  files: BundlePreviewFile[];
  estimatedBytes: number;
  warnings: string[];
}
```

### ExportBundleResult

```typescript
interface ExportBundleResult {
  outputPath: string;
  format: 'folder' | 'zip';
  files: string[];
  totalBytes: number;
  wasSuffixed: boolean;
  warnings: string[];
}
```

### Bundle structure

Bundles use a deterministic folder layout:

```
{bundle_name}/
  images/        — sprite sheets or frame sequences
  manifests/     — manifest JSON files
  preview/       — optional 128×128 thumbnail (thumbnail.png)
```

For zip bundles, the folder is compressed and the intermediate folder removed. Collision-safe naming applies to both folder and zip outputs.

Bundle export is outside undo history — it's a one-way output operation. The preview command is authoritative: what it lists is exactly what export will write.

### Catalog bundle structure

Multi-asset catalog bundles use per-asset subfolders:

```
{bundle_name}/
  assets/
    {asset_name}/
      images/        — sprite sheets or frame sequences
      manifests/     — manifest JSON files
      preview/       — optional thumbnail
    {asset_name_2}/
      ...
```

Each asset's .pxs file is loaded independently (does not affect the currently open project). Missing assets block export in the first pass. Selection is tracked by asset ID with stale-ID pruning on refresh.

### CatalogBundlePreviewResult

```typescript
interface CatalogBundlePreviewResult {
  assets: CatalogBundleAssetEntry[];  // per-asset status
  totalFiles: number;
  warnings: string[];
}

interface CatalogBundleAssetEntry {
  assetId: string;
  assetName: string;
  status: 'ok' | 'missing' | 'error';
  fileCount: number;
  warnings: string[];
}
```

### CatalogBundleExportResult

```typescript
interface CatalogBundleExportResult {
  outputPath: string;
  format: 'folder' | 'zip';
  assetCount: number;
  skippedCount: number;
  files: string[];
  totalBytes: number;
  wasSuffixed: boolean;
  warnings: string[];
}
```

### Multi-select mode

The asset browser supports an explicit multi-select toggle for catalog packaging. When active:
- Clicking an asset toggles its checkbox (no preview pane)
- Actions bar shows selected count, "All" (select all visible), "Clear"
- Hidden-by-filter count shown when filters hide selected assets ("3 selected (1 hidden)")
- Missing assets in selection show a warning with names and block export
- "Clear missing" button removes missing assets from selection without clearing valid ones
- Selection persists across catalog refresh (stale IDs pruned)
- Exiting multi-select clears all selections

### Package Again

Both single-asset and catalog packaging support a "Package Again" button:
- Enabled only when preview is fresh (not stale) and a previous export succeeded
- Re-exports to the same output directory without showing a file dialog
- Blocked when settings change — shows "preview again to package" hint
- Never bypasses validity checks or silently reuses outdated selection

### Persisted packaging settings

Packaging settings are persisted locally via `localStorage` (not in project files):
- Bundle format (folder/zip) — single-asset and catalog independently
- Include manifest / include preview toggles
- Last output directory
- Last packaging mode (single/catalog)

Asset multi-selection is **not** persisted across app restarts. Format and toggle settings restore on panel mount.

## Package Metadata

### Commands

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `get_asset_package_metadata` | — | `PackageMetadata` | Get the current project's package metadata |
| `set_asset_package_metadata` | `packageName?: string, version?: string, author?: string, description?: string, tags?: string[]` | `PackageMetadata` | Update package metadata (partial update, marks project dirty) |

### PackageMetadata

```typescript
interface PackageMetadata {
  packageName: string;  // defaults empty, UI defaults from project name
  version: string;      // defaults "0.1.0"
  author: string;       // optional
  description: string;  // optional, max 500 chars
  tags: string[];       // optional, max 20
}
```

### Persistence

Package metadata is stored in the project file (`.pxs`) alongside clip definitions and canvas data. Old projects without metadata open safely with default values via `serde(default)`. The `skip_serializing_if` guard keeps old-format files clean when metadata is at defaults.

### Manifest integration

When package metadata is set (non-default), a `package` block is included in all manifest outputs:

- **GlyphStudio Native manifests** — full `package` object with `packageName`, `version`, `author`, `description`
- **Generic Runtime manifests** — same `package` object (lean format still includes identity)
- **Bundle manifests** — same `package` object

If all metadata fields are at defaults (empty name, version `0.1.0`, no author/description), the `package` field is omitted entirely for clean output.

## Scene Composition

### Commands

| Command | Args | Returns | Description |
|---------|------|---------|-------------|
| `new_scene` | `name: string, width: number, height: number` | `SceneInfo` | Create a new empty scene |
| `open_scene` | `filePath: string` | `SceneInfo` | Open an existing .pscn scene file |
| `save_scene` | — | `SceneInfo` | Save scene to its known file path |
| `save_scene_as` | `filePath: string` | `SceneInfo` | Save scene to a new file path |
| `get_scene_info` | — | `SceneInfo` | Get info about the currently open scene |
| `get_scene_instances` | — | `SceneAssetInstance[]` | Get all instances in the current scene |
| `add_scene_instance` | `sourcePath: string, assetId?: string, name?: string, x?: number, y?: number, clipId?: string` | `SceneAssetInstance` | Add an asset instance to the scene (rejects missing sources) |
| `remove_scene_instance` | `instanceId: string` | `boolean` | Remove an instance from the scene |
| `move_scene_instance` | `instanceId: string, x: number, y: number` | `SceneAssetInstance` | Move an instance to integer coordinates |
| `set_scene_instance_layer` | `instanceId: string, zOrder: number` | `SceneAssetInstance` | Change instance z-order |
| `set_scene_instance_visibility` | `instanceId: string, visible: boolean` | `SceneAssetInstance` | Toggle instance visibility |
| `set_scene_instance_opacity` | `instanceId: string, opacity: number` | `SceneAssetInstance` | Set instance opacity (clamped 0.0–1.0) |
| `set_scene_instance_clip` | `instanceId: string, clipId?: string` | `SceneAssetInstance` | Assign a clip to an instance (null to clear) |
| `set_scene_playback_fps` | `fps: number` | `SceneInfo` | Set global scene FPS (clamped 1–60) |
| `set_scene_loop` | `looping: boolean` | `SceneInfo` | Set scene looping flag |
| `get_scene_playback_state` | — | `ScenePlaybackState` | Get full playback state with resolved clip info per instance |
| `list_source_clips` | `sourcePath: string` | `SourceClipInfo[]` | List clips available in a source .pxs project |
| `get_source_asset_frames` | `sourcePath: string, clipId?: string` | `SourceAssetFrames` | Load composited frame images for a clip (base64 PNGs) |
| `export_scene_frame` | `filePath: string, tick: number` | `SceneExportResult` | Export camera-aware composited scene frame as PNG |
| `set_scene_instance_parallax` | `instanceId: string, parallax: number` | `SceneAssetInstance` | Set per-instance parallax factor (clamped 0.1–3.0) |
| `get_scene_camera` | — | `SceneCamera` | Get current scene camera state |
| `set_scene_camera_position` | `x: number, y: number` | `SceneCamera` | Set camera center position |
| `set_scene_camera_zoom` | `zoom: number` | `SceneCamera` | Set camera zoom (clamped 0.1–10.0) |
| `reset_scene_camera` | — | `SceneCamera` | Reset camera to default (origin, zoom 1.0) |
| `get_scene_camera_at_tick` | `tick: number` | `SceneCamera` | Get resolved camera at a tick (evaluates keyframe interpolation) |
| `list_scene_camera_keyframes` | — | `SceneCameraKeyframe[]` | List all camera keyframes sorted by tick |
| `add_scene_camera_keyframe` | `tick, x, y, zoom, interpolation?, name?` | `SceneCameraKeyframe[]` | Add/replace keyframe at tick, returns all keyframes |
| `update_scene_camera_keyframe` | `tick, x?, y?, zoom?, interpolation?, name?` | `SceneCameraKeyframe[]` | Patch keyframe fields at tick |
| `delete_scene_camera_keyframe` | `tick: number` | `SceneCameraKeyframe[]` | Delete keyframe, returns remaining keyframes |
| `get_scene_timeline_summary` | — | `SceneTimelineSummary` | Get scene timeline span and timing info |
| `seek_scene_tick` | `tick: number` | `SceneTimelineSummary` | Validate seek target against timeline |
| `unlink_scene_instance_from_source` | `instanceId: string` | `SceneAssetInstance` | Sever source relationship — sets `characterLinkMode` to `'unlinked'`. Rejects non-character or already-unlinked instances |
| `relink_scene_instance_to_source` | `instanceId: string` | `SceneAssetInstance` | Restore source relationship — clears `characterLinkMode`. Rejects non-character or not-currently-unlinked instances |
| `restore_scene_instances` | `instances: SceneAssetInstance[]` | `SceneAssetInstance[]` | Replace all scene instances atomically (used by undo/redo backend sync). Sets scene dirty flag. |

### SceneAssetInstance

```typescript
interface SceneAssetInstance {
  instanceId: string;
  sourcePath: string;      // path to .pxs source
  assetId?: string;        // optional catalog ID
  name: string;            // display name
  clipId?: string;         // which clip to play
  x: number;               // scene position
  y: number;
  zOrder: number;          // higher = in front
  visible: boolean;
  opacity: number;         // 0.0–1.0
  parallax: number;        // 1.0 = normal, <1.0 = bg, >1.0 = fg
}
```

### SceneCamera

```typescript
interface SceneCamera {
  x: number;               // camera center X
  y: number;               // camera center Y
  zoom: number;            // 1.0 = 100%
  name?: string;           // optional label
}
```

### SceneCameraKeyframe

```typescript
interface SceneCameraKeyframe {
  tick: number;              // tick at which this key takes effect
  x: number;                 // camera X position
  y: number;                 // camera Y position
  zoom: number;              // zoom factor
  interpolation: 'hold' | 'linear';
  name?: string;             // optional shot/key label
}
```

### SceneCameraShot (frontend-derived)

```typescript
interface SceneCameraShot {
  name: string;              // from keyframe name, or "Shot N"
  startTick: number;         // inclusive
  endTick: number;           // exclusive (next shot start or scene end)
  durationTicks: number;
  interpolation: 'hold' | 'linear';
  keyframeIndex: number;     // index into sorted keyframes array
}
```

Derived via `deriveShotsFromCameraKeyframes(keyframes, totalTicks)` — each keyframe defines a shot segment that runs until the next keyframe.

### CameraTimelineMarker (frontend-derived)

```typescript
interface CameraTimelineMarker {
  tick: number;
  x: number;
  y: number;
  zoom: number;
  interpolation: 'hold' | 'linear';
  name: string | undefined;
  index: number;             // sorted position
}
```

Derived via `deriveCameraTimelineMarkers(keyframes)` — sorted marker positions for the camera timeline lane.

### Character → scene bridge helpers

Pure functions exported from `@glyphstudio/state` for the character scene bridge.

| Helper | Signature | Purpose |
|--------|-----------|---------|
| `placeCharacterBuild` | `(build, options?) → SceneAssetInstance` | Create a character scene instance from a build (snapshot-first) |
| `reapplyCharacterBuild` | `(instance, build) → SceneAssetInstance \| null` | Refresh character snapshot while preserving scene-local state |
| `checkPlaceability` | `(build, issues) → PlaceabilityResult` | Check if a build can be placed (errors block, warnings allowed) |
| `isCharacterInstance` | `(instance) → boolean` | Check if a scene instance is character-derived |
| `isSourceBuildAvailable` | `(instance, buildIds) → boolean` | Check if source build exists in library |
| `deriveSourceStatus` | `(instance, buildIds) → CharacterSourceStatus` | Classify as `'linked'`, `'missing-source'`, `'unlinked'`, or `'not-character'` |
| `sourceStatusLabel` | `(status) → string` | Human-readable status label |
| `instanceBuildName` | `(instance) → string` | Build name with "Unknown build" fallback |
| `snapshotSummary` | `(instance) → string` | Snapshot text (e.g. "4/12 equipped") |
| `isSnapshotPossiblyStale` | `(instance, sourceBuild?) → boolean` | Lightweight staleness check (count + name heuristic); returns false for unlinked |
| `createSlotSnapshot` | `(build) → CharacterSlotSnapshot` | Create a frozen slot snapshot from a build |
| `canReapplyFromSource` | `(instance, buildIds) → boolean` | True when linked + source exists (reapply is lawful) |
| `canRelinkToSource` | `(instance, buildIds) → boolean` | True when unlinked + source exists (relink is lawful) |
| `unlinkFromSource` | `(instance) → SceneAssetInstance` | Sever source relationship; preserves snapshot and overrides |
| `relinkToSource` | `(instance) → SceneAssetInstance` | Restore source relationship; does not mutate snapshot |
| `effectiveCompositionAsBuild` | `(instance) → CharacterBuild \| null` | Synthetic build from effective composition for compatibility checks |

### Character instance override helpers

| Helper | Signature | Purpose |
|--------|-----------|---------|
| `applyOverridesToSnapshot` | `(snapshot?, overrides?) → EffectiveSlotComposition` | Apply local overrides to a snapshot |
| `deriveEffectiveSlots` | `(instance) → EffectiveSlotComposition` | Effective slot composition (snapshot + overrides) |
| `deriveEffectiveCharacterSlotStates` | `(instance) → EffectiveCharacterSlotState[]` | Per-slot UI-ready state for all 12 canonical slots |
| `setSlotOverride` | `(instance, override) → SceneAssetInstance` | Set a local override (immutable) |
| `clearSlotOverride` | `(instance, slotId) → SceneAssetInstance` | Clear a single override (immutable) |
| `clearAllOverrides` | `(instance) → SceneAssetInstance` | Clear all overrides (immutable) |
| `hasOverrides` | `(instance) → boolean` | Check if any overrides exist |
| `getOverrideCount` | `(instance) → number` | Count of local overrides |
| `overrideSummary` | `(instance) → string` | Compact summary (e.g. "2 local overrides") |
| `effectiveSlotSummary` | `(instance) → string` | Effective slot count (e.g. "4/12 effective") |

### Camera timeline lane helpers

| Helper | Signature | Purpose |
|--------|-----------|---------|
| `deriveCameraTimelineMarkers` | `(keyframes) → CameraTimelineMarker[]` | Sorted markers for lane rendering |
| `deriveShotsFromCameraKeyframes` | `(keyframes, totalTicks) → SceneCameraShot[]` | Shot segments between keyframes |
| `findCurrentCameraShotAtTick` | `(shots, tick) → SceneCameraShot \| null` | Which shot contains the given tick |
| `findCameraKeyframeAtTick` | `(keyframes, tick) → { keyframe, index } \| null` | Exact keyframe at a tick |

All helpers are pure functions exported from `@glyphstudio/state`. The camera timeline lane uses these to project `cameraKeyframes[]` into visual elements without maintaining a separate data model.

### Scene history helpers

Pure functions and types exported from `@glyphstudio/state` for the scene undo/redo system.

#### Contract layer (`sceneHistory`)

| Export | Type | Purpose |
|--------|------|---------|
| `SceneHistoryOperationKind` | type | Union of 16 operation kind strings |
| `SceneHistorySnapshot` | type | `{ instances: SceneAssetInstance[] }` |
| `SceneHistoryEntry` | type | Before/after snapshots + kind + metadata + timestamp |
| `SceneHistoryOperationMetadata` | type | Optional instanceId, camera, override metadata |
| `ALL_SCENE_HISTORY_OPERATION_KINDS` | const | Array of all 16 operation kind strings |
| `describeSceneHistoryOperation` | fn | Human-readable label for an operation kind |
| `isSceneHistoryChange` | fn | Detect no-op (identical before/after instances) |
| `createSceneHistoryEntry` | fn | Build a history entry from before/after + kind + metadata |
| `captureSceneSnapshot` | fn | Create a snapshot from an instance array |

#### Engine layer (`sceneHistoryEngine`)

| Export | Type | Purpose |
|--------|------|---------|
| `SceneHistoryState` | type | Past/future stacks + maxEntries + isApplyingHistory |
| `createEmptySceneHistoryState` | fn | Fresh state with empty stacks |
| `canUndoScene` | fn | Whether undo is available |
| `canRedoScene` | fn | Whether redo is available |
| `recordSceneHistoryEntry` | fn | Push entry onto past, clear future |
| `undoSceneHistory` | fn | Pop past → return snapshot + push to future |
| `redoSceneHistory` | fn | Pop future → return snapshot + push to past |
| `finishApplyingHistory` | fn | Clear `isApplyingHistory` flag |
| `applySceneEditWithHistory` | fn | Detect no-op, record entry, return new state |

#### Store layer (`sceneEditorStore`)

| Export | Type | Purpose |
|--------|------|---------|
| `useSceneEditorStore` | Zustand store | Centralized scene instances + history |
| `SceneEditorState` | type | Store shape (instances, history, actions) |
| `SceneUndoRedoResult` | type | `{ instances: SceneAssetInstance[], rollback: () => void }` |

Store actions:

| Action | Signature | Description |
|--------|-----------|-------------|
| `loadInstances` | `(instances) → void` | Load from backend without history (refresh, initial load) |
| `applyEdit` | `(kind, nextInstances, metadata?) → void` | Record edit with history (captures before/after) |
| `undo` | `() → SceneUndoRedoResult \| undefined` | Undo with rollback closure for backend sync failure |
| `redo` | `() → SceneUndoRedoResult \| undefined` | Redo with rollback closure for backend sync failure |
| `resetHistory` | `() → void` | Clear history stacks (scene change / new scene) |

### SceneTimelineSummary

```typescript
interface SceneTimelineSummary {
  fps: number;
  looping: boolean;
  totalTicks: number;      // longest clip span, minimum 1
  totalDurationMs: number;
  contributingInstances: number;
  longestClipFrames: number;
}
```

### SceneInfo

```typescript
interface SceneInfo {
  sceneId: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  instanceCount: number;
  fps: number;
  looping: boolean;
  filePath: string | null;
  dirty: boolean;
}
```

### ScenePlaybackState

```typescript
interface ScenePlaybackState {
  fps: number;
  looping: boolean;
  instances: InstanceClipState[];
}

interface InstanceClipState {
  instanceId: string;
  clipId: string | null;
  clipName: string | null;
  frameCount: number;
  clipFps: number | null;    // clip FPS override, null = use scene FPS
  clipLoop: boolean;
  status: 'resolved' | 'no_clip' | 'missing_source' | 'missing_clip' | 'no_clips_in_source';
}
```

### SourceClipInfo / SourceAssetFrames / SceneExportResult

```typescript
interface SourceClipInfo {
  id: string; name: string; startFrame: number; endFrame: number;
  frameCount: number; loopClip: boolean; fpsOverride: number | null;
}

interface SourceAssetFrames {
  width: number; height: number;
  frames: string[];            // base64-encoded PNGs
  clipId: string | null; frameCount: number;
}

interface SceneExportResult {
  outputPath: string; width: number; height: number;
  warnings: string[];          // per-instance issues
}
```

### Clip resolution policy

| Instance state | Rendering behavior | Panel display |
|---|---|---|
| `resolved` | Animated frames from assigned clip | Clip name (green) |
| `no_clip` | Static first frame | "none" (italic) |
| `missing_source` | Warning placeholder with dashed border | "(source missing)" (orange) |
| `missing_clip` | First-frame fallback | "(missing)" (orange) |
| `no_clips_in_source` | Static first frame | "(no clips)" (orange) |

### Persistence

Scene files use the `.pscn` extension and are stored separately from `.pxs` sprite project files. Scenes reference assets by file path and optional catalog ID — they do not embed source asset content. Missing source files degrade gracefully (placeholder state, no crash).

### Design decisions

- Scenes are a separate artifact type from sprite projects
- Global scene clock first; per-instance offsets deferred
- Scene transforms in 10A: move, visibility, opacity, z-order only
- Scene export starts with current composited frame (PNG)
- Scene undo/redo uses full-snapshot history in TypeScript state, separate from canvas stroke undo in Rust
- Scene operations do not corrupt sprite project undo history
- Missing source assets render as placeholder boxes (no crash)
- Adding missing/non-loadable assets is rejected at command level
- Instance positions are integer-only
- New instances default to center of scene, topmost z-order
- Scene workspace has its own canvas, separate from sprite editor

### Scene workspace

The Scene tab in the top bar activates a dedicated workspace:
- **Scene canvas** — dark stage with grid overlay, scene bounds visible
- **Instance rendering** — animated frames composited by z-order, blob-URL cached per clip
- **Click to select** — shows selection outline
- **Drag to move** — integer coordinates, responsive local update with backend commit on mouse-up
- **Add Asset** — dropdown populated from asset catalog (missing assets filtered out)
- **Instances panel** — right dock shows all instances sorted by z-order with visibility toggle, bring forward/send backward, remove, opacity slider, clip picker, parallax depth control with BG/MG/FG presets
- **Camera controls** — pan (middle-click drag), zoom (scroll wheel or +/−/reset buttons), camera state persists in scene file
- **Undo/redo** — toolbar buttons and keyboard shortcuts (Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y); full-snapshot scene history with backend sync via `restore_scene_instances`; rollback on sync failure
- **Parallax depth** — per-instance parallax factor (0.1–3.0); camera movement reveals depth separation between layers
- **Playback controls** — stop/step-back/play-pause/step-forward/loop, FPS input, scrubber, tick/time readout
- **Scene scrubber** — draggable timeline scrubber with jump-to-start/end; scrubbing pauses playback, play resumes from scrubbed position
- **Missing-source survivability** — missing sources render as warning placeholder with dashed border; missing clips show orange warning border with fallback frame
- **Scene export** — camera-aware composition at current tick; export reflects camera pan, zoom, parallax, and current animation frame
- **Camera timeline lane** — dedicated lane in the scene timeline showing keyframe markers and shot span bars:
  - Keyframe markers rendered at exact tick positions (diamond for linear, square for hold interpolation)
  - Shot bars span from keyframe to next keyframe (last shot extends to End)
  - Click marker or shot bar to select source keyframe and seek playhead
  - Lane header shows current shot name at playhead
  - Lane toolbar: add key at playhead, delete selected, previous/next key, jump to selected
  - Empty state shows placeholder message when no camera keyframes exist
  - All lane visuals derive from `deriveCameraTimelineMarkers()`, `deriveShotsFromCameraKeyframes()`, and `findCurrentCameraShotAtTick()` — no separate lane data model
  - Selection syncs bidirectionally with the Camera Keyframe Panel via shared `selectedKeyframeTick` state

### Defaults

- `packageName` defaults empty; the UI pre-fills from the project name
- `version` defaults to `0.1.0`
- `author` and `description` are optional; empty values are never serialized
- Missing optional fields never block export or packaging

## Events (planned)

| Event | Payload |
|-------|---------|
| `job:queued` | jobId, type |
| `job:progress` | jobId, progress, stage |
| `job:succeeded` | jobId, candidateIds |
| `job:failed` | jobId, error |
| `project:autosave_updated` | projectId, savedAt |
| `project:recovery_available` | projectId, recoveryBranchId |
