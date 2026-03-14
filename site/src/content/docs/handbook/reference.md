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

## Recovery commands [live]

| Command | Description |
|---------|------------|
| `autosave_recovery` | Write a recovery snapshot to the recovery directory |
| `check_recovery` | Detect recoverable projects from a previous unclean shutdown |
| `restore_recovery` | Restore a project from a recovery file, rehydrate canvas state |
| `discard_recovery` | Delete a recovery file without restoring |

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

## Locomotion commands (planned)

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
