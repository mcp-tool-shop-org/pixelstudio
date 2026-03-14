---
title: API Reference
description: Backend command and event reference for PixelStudio
sidebar:
  order: 4
---

PixelStudio's backend exposes 34 Tauri commands organized into 10 modules.

## Project commands

| Command | Description |
|---------|------------|
| `create_project` | Create a new project with name, canvas size, color mode |
| `open_project` | Load project from disk |
| `save_project` | Persist project state (manual, autosave, or recovery) |
| `list_recent_projects` | Get recent project list with thumbnails |
| `load_recovery_branch` | Restore from crash recovery |

## Layer and pixel commands

| Command | Description |
|---------|------------|
| `apply_pixel_operation` | Paint, erase, fill, replace color, transform selection |
| `apply_layer_operation` | Create, duplicate, delete, reorder, visibility, opacity, blend |
| `apply_socket_operation` | Create, update, delete socket anchors |

## Palette commands

| Command | Description |
|---------|------------|
| `get_palette_catalog` | List available palettes and contracts |
| `apply_palette_operation` | Update slots, create ramps, set contract, remap, quantize |
| `preview_palette_remap` | Non-destructive remap preview with pixel counts |

## AI orchestration commands

| Command | Description |
|---------|------------|
| `queue_ai_job` | Queue a generation/analysis job with prompt, palette mode, candidate count |
| `cancel_ai_job` | Cancel a running job |
| `get_ai_job` | Get job state and candidate references |
| `accept_ai_candidate` | Accept a candidate as new layer, draft layer, or draft track |
| `discard_ai_candidate` | Mark candidate for cleanup |

### AI job types

`region-draft` · `variant-proposal` · `cleanup` · `requantize` · `silhouette-repair` · `inbetween` · `locomotion-draft` · `workflow-run`

## Locomotion commands

| Command | Description |
|---------|------------|
| `analyze_locomotion` | Analyze weight class, cadence, stride, contact timing, CoM path |
| `plan_locomotion` | Propose motion plan with movement type and target feel |
| `generate_locomotion_draft_track` | Generate constrained draft frames from a plan |

## Validation commands

| Command | Description |
|---------|------------|
| `run_validation` | Run scoped or full validation across categories |
| `preview_validation_repair` | Non-destructive repair preview |
| `apply_validation_repair` | Apply a suggested repair |

## Events

| Event | Payload |
|-------|---------|
| `job:queued` | jobId, type |
| `job:progress` | jobId, progress, stage |
| `job:succeeded` | jobId, candidateIds |
| `job:failed` | jobId, error |
| `project:autosave_updated` | projectId, savedAt |
| `project:recovery_available` | projectId, recoveryBranchId |
