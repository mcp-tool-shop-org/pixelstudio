---
title: Getting Started
description: Set up PixelStudio for development
sidebar:
  order: 1
---

PixelStudio is a monorepo using pnpm workspaces with a Tauri v2 desktop app at its center.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Rust** 1.75+ (via [rustup](https://rustup.rs/))
- **Tauri v2 prerequisites** — see the [Tauri docs](https://v2.tauri.app/start/prerequisites/)

## Clone and install

```bash
git clone https://github.com/mcp-tool-shop-org/pixelstudio.git
cd pixelstudio
pnpm install
```

## Project structure

```
pixelstudio/
  apps/desktop/           # Tauri v2 + React app
    src/
      app/                # AppShell, routing
      components/         # Canvas, ToolRail, LayerPanel, docks
      lib/                # Shared stores (canvasFrameStore, syncLayers)
      styles/             # CSS (globals, layout)
    src-tauri/
      src/
        commands/         # Tauri command handlers (canvas, project, ...)
        engine/           # Pixel buffer, canvas state, compositing
        persistence/      # Project I/O, autosave, recovery
        types/            # Rust domain + API types
  packages/
    domain/               # Pure TypeScript types (layers, tools, palettes)
    api-contract/         # Tauri command/event payload types
    state/                # Zustand store slices (14 stores)
  site/                   # Astro landing page + Starlight handbook
```

## Typecheck

```bash
pnpm typecheck
```

This runs `tsc --noEmit` across all four packages — domain, api-contract, state, and the desktop app.

## Run the desktop app

```bash
pnpm dev
```

This starts the Vite dev server and launches the Tauri window with hot module replacement.

## Rust backend

The Rust backend lives in `apps/desktop/src-tauri/` and compiles automatically when you run `pnpm dev`. To check the Rust code independently:

```bash
cd apps/desktop/src-tauri
cargo check
```

## Current implementation status

**Milestone 1A (Breathing Canvas)** — complete:
- Rust-owned pixel buffer with RGBA storage
- Canvas renderer with nearest-neighbor scaling, checkerboard background, pixel grid
- Viewport model: zoom steps (1x–32x), pan (spacebar/middle-mouse), scroll wheel zoom
- Correct screen-to-pixel coordinate mapping at all zoom levels

**Milestone 1B (Real Edits)** — complete:
- Stroke transactions: begin → append (with Bresenham interpolation) → commit
- Undo/redo at stroke level (one drag = one undo step, Ctrl+Z / Ctrl+Shift+Z)
- Layer management: create, delete, rename, select, visibility, lock, opacity, reorder
- Layer panel UI: active highlight, visibility/lock toggles, inline rename, add/delete
- Pencil and eraser tools with continuous drag strokes (no gaps)

**Milestone 1C (Editor Legitimacy)** — complete:
- Serialized project document (.pxs format, JSON with per-layer RGBA data)
- Save/open project with full canvas state rehydration
- Dirty-state tracking (frontend + backend) with window title indicator
- Autosave to recovery channel (30s interval, separate from manual saves)
- Crash recovery: detect unclean shutdown, prompt restore or discard
- PNG export from composited frame data
- Ctrl+S save shortcut, recent projects list
- Recovery prompt UI on startup

**Stage 2A (Selection System)** — complete:
- Rectangular marquee tool with drag-to-select
- Copy/cut/paste/delete selected pixels (Ctrl+C/X/V, Delete)
- Selection overlay with marching ants animation
- Selection synced to both frontend store and Rust backend
- Esc to clear selection

**Stage 2B (Transform)** — complete:
- Transform session: extract selected pixels into floating payload
- Move tool: drag inside selection to reposition
- Arrow key nudge (1px, Shift+Arrow 8px)
- Flip horizontal/vertical, rotate 90° CW/CCW
- Live pixel-accurate preview overlay with marching ants
- Enter to commit, Esc to cancel (restores original pixels)
- Source region cleared on transform start, restored on cancel

**Stage 2C (Timeline)** — complete:
- Animation frame model: each frame owns its own layer stack and undo history
- Create, duplicate (deep copy), delete, switch, rename frames
- Bottom dock timeline UI with clickable frame cards
- Frame switching stashes/restores full layer state, clears selection/transform
- Keyboard: `,` / `.` for prev/next frame
- ProjectDocument schema v2 with multi-frame persistence
- V1 migration: old single-frame projects open as one-frame projects
- Recovery/autosave includes all frames

**Stage 3A (Onion Skin)** — complete:
- Previous/next frame ghost overlays rendered under active frame pixels
- Blue tint for previous frame, red tint for next frame
- Configurable opacity (prev 25%, next 15% defaults)
- Toggle with `O` key, prev/next checkboxes in timeline dock
- Aligned with zoom/pan coordinate system
- Onion skin data invalidated on frame switch

**Stage 3B (Playback)** — complete:
- Frontend-driven playback loop using requestAnimationFrame with elapsed-time stepping
- Play/pause toggle (Space key), loop mode, FPS control (1-60)
- Transport controls: prev/next frame step, play/pause, loop toggle
- Editor coexistence: playback blocked during active transform, paused on edit/undo/redo
- Playback never mutates pixel data — read-only frame switching
- Status bar shows playback state

**Stage 3C (Frame Operations + Export)** — complete:
- Frame reorder: move frames left/right in timeline
- Insert blank frame before/after current position
- Duplicate frame to specific position (deep copy with new IDs)
- Per-frame duration metadata (optional ms override, defaults to global FPS)
- Duration metadata persisted in project file, migrates cleanly from V2
- PNG sequence export: numbered files (name_0001.png, name_0002.png, ...)
- Sprite strip export: horizontal or vertical PNG strip of all frames
- Export uses composited visible layers, never includes onion skin or overlays

**Stage 4A (Motion Assistance Foothold)** — in progress:
- Motion session model: begin/generate/accept/reject/cancel lifecycle
- Bounded intent set: idle bob, walk cycle stub, run cycle stub, hop
- Direction control (left/right/up/down) and frame count (2 or 4)
- Target modes: active selection or whole frame (selection preferred when present)
- Deterministic proposal generation: same inputs always produce same outputs
- Proposal preview: mini frame strips with checker backgrounds, detail view with frame stepping
- Session safety: blocked during active stroke/transform, auto-pauses playback
- Session invalidation: auto-cancels on frame switch
- Proposals are preview-only — no timeline mutation until accepted
- 6 motion commands registered (67 total commands)
