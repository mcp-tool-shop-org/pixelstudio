---
title: API Reference
description: Backend command and event reference for PixelStudio
sidebar:
  order: 4
---

PixelStudio's backend exposes Tauri commands organized by domain. Commands marked with **[live]** are fully implemented; others are planned stubs.

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
| `begin_motion_session` | Start a motion session, capture source pixels from active frame/selection |
| `generate_motion_proposals` | Generate deterministic motion proposals for the active session |
| `get_motion_session` | Get current motion session state (or null) |
| `accept_motion_proposal` | Select a proposal for later commit |
| `reject_motion_proposal` | Deselect the current proposal |
| `cancel_motion_session` | Cancel the session entirely, project unchanged |

Motion commands return a `MotionSessionInfo`:

```typescript
interface MotionSessionInfo {
  sessionId: string;
  intent: string;           // idle_bob | walk_cycle_stub | run_cycle_stub | hop
  direction: string | null; // left | right | up | down
  targetMode: string;       // active_selection | whole_frame
  outputFrameCount: number; // 2 or 4
  sourceFrameId: string;
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

## Events (planned)

| Event | Payload |
|-------|---------|
| `job:queued` | jobId, type |
| `job:progress` | jobId, progress, stage |
| `job:succeeded` | jobId, candidateIds |
| `job:failed` | jobId, error |
| `project:autosave_updated` | projectId, savedAt |
| `project:recovery_available` | projectId, recoveryBranchId |
