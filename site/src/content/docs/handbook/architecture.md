---
title: Architecture
description: How PixelStudio's frontend and backend fit together
sidebar:
  order: 3
---

PixelStudio separates concerns cleanly between the React frontend and the Tauri/Rust backend.

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

The frontend uses 14 Zustand stores organized by domain, plus a canvas frame store for rendering:

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
| canvasFrame | Shared frame data from Rust for Canvas and LayerPanel rendering |

## Reducer patterns

**Deterministic edit** — tool intent, stroke transaction via Rust, composited frame returned, layer store synced, canvas re-renders.

**Probabilistic AI** — form, queue job, candidates stored outside layer graph, user accepts, insert editable artifact, provenance, validation invalidated.

**Analysis** — request, async result in locomotion/validation slice, no project mutation unless user applies.

**Repair** — issue selected, repair preview, apply mutates content, provenance, validation reruns on narrowed scope.

## Backend command surface

53 implemented Tauri commands across:
- **Canvas** (13): init, get state, write/read pixel, stroke lifecycle, undo/redo, layer management
- **Project** (11): new, open, save, info, dirty, recents, export PNG, autosave, check/restore/discard recovery
- **Selection** (16): set/clear/get selection, copy/cut/paste/delete, begin/move/nudge/commit/cancel transform, flip H/V, rotate CW/CCW
- **Timeline** (6): get timeline, create/duplicate/delete/select/rename frame
- Plus stubs for palette, validation, AI, locomotion, provenance, and assets
