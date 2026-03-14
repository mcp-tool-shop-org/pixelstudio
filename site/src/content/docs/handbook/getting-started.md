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
        persistence/      # Project I/O, autosave, recovery (stubs)
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
