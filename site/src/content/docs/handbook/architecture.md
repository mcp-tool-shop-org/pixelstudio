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
- Tool state and interaction handling
- Optimistic intent dispatch
- AI candidate acceptance/rejection UI
- Provenance and history display

### Backend owns

- Project file I/O and authoritative serialization
- Pixel buffer persistence
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

## State model

The frontend uses 14 Zustand stores organized by domain:

| Store | Responsibility |
|-------|---------------|
| appShell | Global UI: modals, command palette, notifications |
| project | Identity, save status, color mode, canvas size |
| workspace | Active mode, dock tabs, layout preferences |
| canvasView | Zoom, pan, overlay toggles |
| tool | Active tool, color slots, palette popup |
| selection | Selection geometry, mode, saved selections |
| layer | Layer graph (raster, group, mask, draft, generated) |
| palette | Palette definitions, contracts, ramps, remap preview |
| timeline | Frames, tags, playback, onion skin, draft tracks |
| ai | Job queue, candidates, results tray |
| locomotion | Analysis results, plans, preview mode, overlays |
| validation | Reports, issues, repair previews |
| provenance | Operation log with deterministic/probabilistic badges |
| export | Preset selection, readiness, preview state |

## Reducer patterns

**Deterministic edit** — tool intent, reducer mutation, provenance entry, dirty flag, validation invalidation.

**Probabilistic AI** — form, queue job, candidates stored outside layer graph, user accepts, insert editable artifact, provenance, validation invalidated.

**Analysis** — request, async result in locomotion/validation slice, no project mutation unless user applies.

**Repair** — issue selected, repair preview, apply mutates content, provenance, validation reruns on narrowed scope.

## Backend command surface

34 Tauri commands across 10 modules: project (5), layer/pixel (3), palette (3), timeline (2), validation (3), provenance (3), AI (5), locomotion (3), export (3), assets (2).
