---
title: Workspace Guide
description: The eight workspace modes in PixelStudio
sidebar:
  order: 2
---

PixelStudio uses workspace modes inside a single desktop shell — not separate windows or browser routes.

## Shared shell

Every mode shares the same persistent regions:

- **Top Bar** — project name, save state, mode tabs, undo/redo, zoom, validation badge
- **Left Tool Rail** — 15 editing tools (pencil, eraser, fill, selections, transforms, sockets, etc.)
- **Center Canvas** — the main editing surface
- **Right Dock** — tabbed panels that change per mode (Layers, Palette, AI Assist, Validation, etc.)
- **Bottom Dock** — timeline, frame strip, or results tray depending on mode

## Modes

### Edit

Primary drawing and sprite construction. Canvas with pixel-perfect rendering, overlay toggles (grid, sockets, palette indices, onion skin), and the **double-right-click contextual palette popup**.

### Animate

Frame-based animation editing. The timeline panel dominates the bottom third with a layer/frame cel matrix, playback controls, onion skinning, and draft frame tracks for AI-generated in-betweens.

### Palette

Full palette editor with ramp grouping, semantic role mapping, contract rules, and live preview. Supports quantization (median cut, octree, k-means) with controlled dithering.

### AI Assist

Task-oriented AI panel — not a chatbot. Sections for region draft, variant proposals, cleanup/requantize, silhouette repair, and animation assist. Results land in a tray with accept/compare/discard actions.

### Locomotion

Motion analysis and draft generation as a real workspace. Analyze stride rhythm, contact timing, center of mass. Preview at gameplay scale with footfall markers and root motion overlays. Generate constrained draft frame tracks.

### Validate

Repair-oriented workspace with issue highlighting on canvas. Categories include palette contract, socket alignment, atlas sizing, animation timing, and locomotion profile. Each issue links to jump-to-fix repair actions.

### Export

Export with live preview and validation readiness checks. Presets for sprite sheet, animation strip, PNG sequence, GIF, and engine-ready atlas packages.

### Project Home

Landing screen for creating, opening, and managing projects. Templates for common starting points (blank sprite, character animation, modular kit, faction palette study).
