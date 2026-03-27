---
title: Beginner's Guide
description: Get started with GlyphStudio from zero
sidebar:
  order: 99
---

This page walks you through everything you need to know to start creating pixel art in GlyphStudio, even if you have never used a sprite editor before.

## What is GlyphStudio?

GlyphStudio is a desktop application for creating, editing, and animating pixel sprites. It runs natively on Windows, macOS, and Linux using Tauri v2 (Rust backend, React frontend). Every pixel edit passes through a Rust-owned pixel buffer, which means undo, redo, save, and export always reflect the true state of your work.

GlyphStudio is not a browser app and not an AI prompt wrapper. It is a craft tool where you control every pixel, with AI available as a bounded assistant for specific tasks like motion drafting and palette analysis.

## Who is it for?

- **Game developers** who need sprites, animations, and asset families for 2D games
- **Pixel artists** who want a dedicated desktop studio with real layer compositing, timeline editing, and structured export
- **Technical artists** who value deterministic operations, structured interchange formats, and repeatable workflows
- **Teams** that need to produce palette variants, directional poses, and bundle exports from a single source asset

If you are looking for a casual browser sketch tool or an AI-generates-everything experience, GlyphStudio is not the right fit.

## Installation

### Prerequisites

You need the following installed on your system:

- **Node.js** 20 or later
- **pnpm** 9 or later
- **Rust** 1.75 or later (install via [rustup](https://rustup.rs/))
- **Tauri v2 system dependencies** for your platform (see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/))

### Clone and set up

```bash
git clone https://github.com/mcp-tool-shop-org/glyphstudio.git
cd glyphstudio
pnpm install
```

### Launch the desktop app

```bash
pnpm dev
```

This starts the Vite dev server and opens the Tauri desktop window. The Rust backend compiles automatically on first launch.

## Your first project

When GlyphStudio opens, you land on **Project Home**. Here is how to create your first sprite:

1. **Create a new project** -- choose a name, set the canvas size (32x32 is a good starting point), and click Create.
2. **Pick the pencil tool** -- press `B` or click the pencil icon in the left tool rail.
3. **Choose a color** -- click the foreground color swatch to open the color picker. Select a color and close the picker.
4. **Draw on the canvas** -- click and drag on the center canvas to paint pixels. Use scroll wheel to zoom in and out. Hold spacebar and drag to pan.
5. **Undo mistakes** -- press `Ctrl+Z` to undo the last stroke. Each continuous drag counts as one undo step.
6. **Save your work** -- press `Ctrl+S` to save. GlyphStudio uses the `.pxs` project format, which stores all layers, frames, and metadata.
7. **Export a PNG** -- use the Export workspace mode to export your sprite as a PNG file with all visible layers composited.

GlyphStudio autosaves every 30 seconds to a recovery channel. If the app closes unexpectedly, you will see a recovery prompt on next launch.

## Core concepts

These are the foundational ideas you will encounter throughout GlyphStudio:

**Layers** -- Each frame has a stack of layers. You draw on the active layer. Layers composite bottom-to-top using alpha blending. Toggle visibility, lock layers to prevent accidental edits, and adjust opacity.

**Frames** -- Animation is frame-based. Each frame owns its own independent layer stack. Add, duplicate, delete, and reorder frames in the bottom timeline dock.

**Tools** -- The left tool rail has 17 tools: pencil, eraser, flood fill, line, rectangle, ellipse, eyedropper, marquee selection, lasso, magic select, color select, move, transform, slice, socket, measure, and sketch tools. Press the keyboard shortcut shown in the tooltip to switch quickly.

**Selections** -- Use the marquee tool (`M`) to select a rectangular region. Copy (`Ctrl+C`), cut (`Ctrl+X`), paste (`Ctrl+V`), or delete (`Del`) pixels within the selection. Press `Esc` to deselect.

**Onion skin** -- Press `O` to toggle ghost overlays of adjacent frames. Previous frame shows in blue, next frame in red. This helps you align motion across frames.

**Palette sets** -- Named color collections that can remap your sprite's appearance without redrawing. Create a base palette, then author variant sets (Fire, Ice, etc.) for instant recoloring.

**Workspace modes** -- GlyphStudio has ten modes (Edit, Animate, Palette, AI Assist, Locomotion, Validate, Export, Scene, Vector, Project Home) accessed from the top bar tabs. Each mode shows relevant panels and tools for that workflow.

## Common tasks

### Switch between tools

Press the keyboard shortcut for the tool you want: `B` for pencil, `E` for eraser, `G` for fill, `M` for marquee, `X` to swap foreground/background colors. The shortcut strip at the bottom of the editor updates based on your current context.

### Add animation frames

Switch to the **Animate** workspace mode. Click the add frame button in the bottom timeline dock, or press `Ctrl+D` to duplicate the current frame. Use left/right arrow keys to navigate between frames. Press `Space` to play/pause the animation.

### Work with layers

The **Layers** panel in the right dock shows your layer stack. Click a layer to select it for editing. Use the buttons to add, delete, rename, and reorder layers. The eye icon toggles visibility and the lock icon prevents edits.

### Export your sprite

Switch to the **Export** workspace mode. Choose your output format: single PNG, sprite strip (horizontal or vertical), PNG sequence, animated GIF, or bundle export. The export always uses composited visible layers -- editor overlays like onion skin are never included in output.

### Use the MCP server

GlyphStudio ships with an MCP server (`@glyphstudio/mcp-sprite-server`) that exposes 76 tools and 6 resources over stdio. This lets LLMs create and edit sprites programmatically using the same domain logic as the desktop app. Install it via npm and connect it to Claude Desktop, Claude Code, or any MCP-compatible client:

```bash
npm install @glyphstudio/mcp-sprite-server
npx tsx packages/mcp-sprite-server/src/cli.ts
```

## Next steps

Once you are comfortable with basic drawing and animation:

- **[Workspace Guide](../workspace/)** -- Learn all ten workspace modes and their panel layouts
- **[Architecture](../architecture/)** -- Understand how the frontend and Rust backend share responsibility
- **[Production Workflows](../production/)** -- Master palette variants, reusable parts, templates, packs, and bundle export
- **[API Reference](../reference/)** -- Explore the full Tauri command surface and MCP tool inventory
