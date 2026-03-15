# GlyphStudio

Craft-first sprite studio for deterministic pixel editing, frame-by-frame animation, and future locomotion assistance.

GlyphStudio is a desktop app built with **Tauri v2**, **React**, and **Rust**. It is designed around a simple rule: the editor should stay in control of the artwork, and automation should remain subordinate to the artist.

## Current Status

GlyphStudio is already a real working editor with:

- Deterministic pixel canvas with nearest-neighbor rendering
- Layers with visibility, lock, opacity, rename, reorder, and selection
- Stroke-based drawing with undo/redo
- Rectangular selection, clipboard actions, and transform workflow
- Multi-frame timeline with per-frame undo/redo isolation
- Onion skin overlays for adjacent-frame editing
- Playback controls with FPS and loop support
- Export for:
  - Current frame PNG
  - Numbered PNG frame sequence
  - Horizontal or vertical sprite strip
- Project save/load, autosave recovery, and schema migration support

This is not a browser toy or prompt-slot machine. It is a native desktop editor with Rust as the authority for canvas state and pixel truth.

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

### Frontend
- React
- Zustand state stores
- HTML canvas renderer
- Timeline, layer, selection, and playback UI

### Backend
- Rust engine for:
  - Pixel buffers
  - Layer compositing
  - Frame management
  - Selection/transform sessions
  - Persistence and recovery
  - Export pipelines

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

## Implemented Milestones

### Stage 1 — Editor Legitimacy
- Breathing canvas
- Real layers
- Drawing tools
- Undo/redo
- Project save/load
- Recovery and autosave

### Stage 2 — Selection, Transform, Timeline
- Rectangular marquee selection
- Copy/cut/paste/delete
- Transform preview + commit/cancel
- Flip/rotate/nudge
- Frame creation, duplication, deletion, renaming, switching

### Stage 3 — Animation Usability
- Onion skin
- Playback + FPS controls
- Frame reorder/insert/duplicate polish
- Per-frame duration metadata
- PNG sequence and sprite strip export

### Stage 4A — Motion Assistance Foothold (in progress)
- Bounded motion session model (begin/generate/accept/reject/cancel)
- Deterministic proposal generation (idle bob, walk, run, hop)
- Proposal preview with mini frame strips and detail view
- Session safety: blocked during stroke/transform, auto-pauses playback
- Proposals are preview-only until accepted into timeline

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

GlyphStudio currently supports:

- **Current Frame PNG** — single composited image
- **PNG Sequence** — numbered files (name_0001.png, name_0002.png, ...)
- **Sprite Strip** — horizontal or vertical single-image strip

Exports use composited visible layers only. Onion skin, playback state, and transient editor overlays are not included in output.

## Documentation

See the [handbook](site/src/content/docs/handbook/) for deeper details:

- [Getting Started](site/src/content/docs/handbook/getting-started.md)
- [Architecture](site/src/content/docs/handbook/architecture.md)
- [API Reference](site/src/content/docs/handbook/reference.md)

## Roadmap

Near-term priorities:

- Frame timing polish in UI
- Animation workflow refinement
- Stronger export ergonomics
- Locomotion / motion-assistance foothold
- Subordinate AI features that operate within deterministic editor constraints

## Non-Goals

GlyphStudio is not aiming to be:

- A generic image editor
- A browser-first toy app
- An AI prompt wrapper that guesses at art
- A mushy canvas where frontend state and backend truth drift apart
