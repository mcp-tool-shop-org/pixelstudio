# GlyphStudio

Craft-first sprite studio for deterministic pixel editing, frame-by-frame animation, and future locomotion assistance.

GlyphStudio is a desktop app built with **Tauri v2**, **React**, and **Rust**. It is designed around a simple rule: the editor should stay in control of the artwork, and automation should remain subordinate to the artist.

## Current Status

GlyphStudio is a working desktop editor with 30 shipped stages and 1,149 tests green.

### Canvas Editor (Rust backend)
- Deterministic pixel canvas with nearest-neighbor rendering
- Layers with visibility, lock, opacity, rename, reorder
- Stroke-based drawing with undo/redo
- Rectangular selection, clipboard actions, and transform workflow
- Multi-frame timeline with per-frame undo/redo isolation
- Onion skin overlays for adjacent-frame editing
- Playback controls with FPS and loop support
- Motion assistance with deterministic proposal generation
- Anchor system with hierarchy, falloff, and secondary motion templates
- Motion presets with batch apply across frames
- Clip definitions with pivot, tags, and validation
- Sprite sheet export with manifest (native + generic runtime formats)
- Asset catalog with thumbnails, search, and bundle packaging
- Project save/load, autosave recovery, and schema migration

### Scene Compositor (frontend + Rust)
- Scene composition with asset instances, z-ordering, visibility, opacity, parallax
- Camera system with pan, zoom, keyframe animation, and shot derivation
- Character build system with slots, presets, validation, and scene bridge
- Scene undo/redo with full-snapshot history and rollback on sync failure
- Persisted provenance with drilldown inspection across 20 operation kinds
- Scene comparison and restore preview workflows

### Sprite Editor (frontend-only)
- Self-contained pixel editor with pencil, eraser, fill, eyedropper tools
- Multi-layer editing with per-layer visibility, rename, reorder
- Alpha compositing with real-time draft stroke preview across all layers
- Frame management with onion skin, playback, scrubber, and per-frame duration
- Rectangular selection with copy/cut/paste/delete
- Sprite sheet import/export with multi-layer flattening
- Palette panel with color picker and foreground/background swap

This is not a browser toy or prompt-slot machine. It is a native desktop editor where Rust owns canvas pixel truth and the frontend owns sprite pixel truth.

## Product Philosophy

GlyphStudio is built around four principles:

1. **Deterministic editing**
   Every pixel mutation should be lawful, inspectable, and reversible.

2. **Subordinate AI**
   Automation should assist the workflow without replacing creative control.

3. **Animation-first structure**
   Frames, timeline operations, onion skin, and playback are core editor concepts, not afterthoughts.

4. **Trustworthy state**
   Save/load, autosave, recovery, undo/redo, and migration are treated as product features, not cleanup chores.

## Architecture

### Frontend (React + TypeScript)
- 17+ Zustand stores organized by domain
- HTML canvas renderer for both editors
- Canvas editor UI: layers, timeline, selection, playback, character builder, scene compositor
- Sprite editor: self-contained pixel editing with frontend-owned pixel buffers
- Alpha compositing via `flattenLayers` for multi-layer sprite editing

### Backend (Rust)
- Authoritative pixel buffers and layer compositing for canvas editor
- Stroke transactions with before/after patches
- Selection/transform sessions
- Project persistence, autosave, crash recovery
- Export pipelines (PNG, sprite sheet, clip, bundle)
- Scene composition engine with camera and playback
- Asset catalog with thumbnail generation
- 166 implemented Tauri commands

### Desktop Shell
- Tauri v2

## Monorepo Structure

```text
glyphstudio/
  apps/desktop/
    src/
    src-tauri/
  packages/
    domain/
    api-contract/
    state/
  site/
```

## Implemented Stages

### Stages 1–3 — Editor Foundation
Canvas, layers, drawing tools, undo/redo, selection, transforms, timeline, onion skin, playback, frame operations, PNG/strip export, project persistence, autosave, crash recovery.

### Stage 4A — Motion Assistance
Bounded motion sessions, deterministic proposal generation, preview with mini frame strips, session safety, proposal commit to timeline.

### Stages 5–8 — Motion Polish
Anchors with hierarchy and falloff, secondary motion templates (wind, sway, swing, rustle), motion sandbox with analysis metrics, motion presets with batch apply.

### Stages 9–10 — Clips, Export, Scene Foundation
Clip definitions with pivot/tags/validation, sprite sheet export with manifests, asset catalog with thumbnails, bundle packaging, scene composition with instances and z-ordering.

### Stages 11–14 — Character System
Character builds with 12 body-region slots, preset picker with compatibility tiers, build validation, build library with persistence, character-to-scene bridge with snapshot placement.

### Stages 15–16 — Scene Editing
Scene camera with pan/zoom, camera keyframes with interpolation, scene undo/redo with full-snapshot history, rollback on backend sync failure.

### Stages 17–24 — Provenance & Inspection
Persisted scene provenance with 20 operation kinds, drilldown inspection with captured before/after slices, structured value summaries, scene comparison engine, restore preview workflows.

### Stages 25–26 — Restore & Selective Restore
Scene restore contract with pure derivation, selective restore per domain (instances, camera, keyframes, playback), playbackConfig through lawful seam with undo/redo.

### Stages 27–28 — Sprite Editor
Frontend-only sprite editor: document contract, pixel canvas with pencil/eraser/fill/eyedropper, frames with onion skin, selection with clipboard, sprite sheet import/export, keyboard shortcuts, zoom/grid, palette panel.

### Stage 29 — Animation Preview
Animation player contract, playback UI with scrubber and Space shortcut, inline frame duration editing with presets, onion skin suppression during playback.

### Stage 30 — Layers and Layer Workflow
SpriteLayer type, layerId-keyed pixel buffers, flattenLayers alpha compositing, activeLayerId tracking, layer panel with CRUD/visibility/rename/reorder, draft stroke compositing across all visible layers, multi-layer export.

## Running the App

### Prerequisites
- Node.js 20+
- pnpm 9+
- Rust 1.75+ (via [rustup](https://rustup.rs/))
- Tauri v2 prerequisites for your platform

### Install

```bash
pnpm install
```

### Run desktop app

```bash
pnpm dev
```

### Typecheck

```bash
pnpm typecheck
```

### Rust check

```bash
cd apps/desktop/src-tauri
cargo check
```

## Export Support

### Canvas Editor (Rust)
- **Current Frame PNG** — single composited image
- **PNG Sequence** — numbered files (name_0001.png, name_0002.png, ...)
- **Sprite Strip** — horizontal or vertical single-image strip
- **Clip Sheet** — sprite sheet from clip definitions with optional manifest
- **All Clips Sheet** — combined sheet from all valid clips
- **Asset Bundle** — folder or zip with images, manifests, and preview thumbnail
- **Catalog Bundle** — multi-asset packaging with per-asset subfolders

### Sprite Editor (frontend)
- **Sprite Strip** — horizontal strip with all visible layers flattened per frame
- **Current Frame** — flattened composite of visible layers

Exports use composited visible layers only. Onion skin, playback state, and transient editor overlays are not included in output.

## Documentation

See the [handbook](site/src/content/docs/handbook/) for deeper details:

- [Getting Started](site/src/content/docs/handbook/getting-started.md)
- [Architecture](site/src/content/docs/handbook/architecture.md)
- [API Reference](site/src/content/docs/handbook/reference.md)

## Roadmap

Near-term priorities:

- Indexed palette mode with contract rules and ramp editing
- AI assist integration (local Ollama + ComfyUI for bounded generation tasks)
- Locomotion analysis workspace with stride/contact/CoM overlays
- Validation engine with repair actions

## Non-Goals

GlyphStudio is not aiming to be:

- A generic image editor
- A browser-first toy app
- An AI prompt wrapper that guesses at art
- A mushy canvas where frontend state and backend truth drift apart

## Security

GlyphStudio is a **desktop-only** application. It does not make network requests, collect telemetry, or handle secrets.

- **Data touched:** local sprite files (.glyph, .pxs, .png), autosave/recovery files in the app data directory
- **Data NOT touched:** no network, no cloud, no remote APIs, no user accounts
- **Permissions:** filesystem access scoped to user-selected directories via Tauri v2 native file dialogs
- **No telemetry** is collected or sent

See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)
