---
title: Workspace Guide
description: The ten workspace modes in GlyphStudio
sidebar:
  order: 2
---

GlyphStudio uses ten workspace modes inside a single desktop shell — not separate windows or browser routes.

## Shared shell

Every mode shares the same persistent regions:

- **Top Bar** — project name, save state, mode tabs, undo/redo, zoom, validation badge
- **Left Tool Rail** — 17 editing tools (pencil, eraser, fill, line, rectangle, ellipse, selections, transforms, slice, socket, measure, sketch brush/eraser)
- **Center Canvas** — the main editing surface
- **Right Dock** — tabbed panels that change per mode (Layers, Palette, AI Assist, Validation, etc.)
- **Bottom Dock** — timeline, frame strip, or results tray depending on mode

## Modes

### Edit

Primary drawing and sprite construction. Canvas with pixel-perfect rendering, overlay toggles (pixel grid, onion skin), and tool-driven editing.

**Tools:** pencil, eraser, flood fill, line, rectangle, ellipse, eyedropper (color-select), rectangular marquee, lasso, magic select, move, transform, slice, socket, measure, sketch brush, sketch eraser. Each tool operates on the active layer only.

**Layers:** Multi-layer editing with per-layer visibility, rename, reorder, and delete. The Layer Panel in the right dock shows layers top-to-bottom. During paint strokes, the canvas composites all visible layers in real-time using alpha blending (draft stroke compositing).

**Selection:** Rectangular marquee with marching ants overlay. Copy/cut/paste/delete operate on the active layer's pixels within the selection bounds. Escape clears the selection.

**Canvas:** Scroll-wheel zoom (1x–32x), pixel grid overlay, coordinate readout. The canvas renders the flattened composite of all visible layers.

### Animate

Frame-based animation editing. The bottom dock shows the frame strip with clickable frame cards.

**Frames:** Add, duplicate, delete, reorder frames. Each frame owns its own layer stack. Arrow keys navigate between frames.

**Playback:** Play/pause (Space), loop toggle, FPS control (1–60). Scrubber bar for seeking. Onion skin automatically suppressed during playback.

**Onion skin:** Previous/next frame ghost overlays with configurable opacity and tint (blue for previous, red for next).

**Frame timing:** Per-frame duration overrides with inline editing and presets (50ms–500ms). Default timing derived from global FPS.

**Import/Export:** Import sprite sheets by slicing a grid into frames. Export as horizontal/vertical sprite strip with all visible layers flattened per frame.

### Palette

Palette panel with foreground/background color selection, color picker, and X shortcut for swap. Full palette editor with ramp grouping, semantic role mapping, contract rules, and live preview planned for future stages.

### AI Assist

Task-oriented AI panel — not a chatbot. Sections for region draft, variant proposals, cleanup/requantize, silhouette repair, and animation assist. Results land in a tray with accept/compare/discard actions.

### Locomotion

Motion analysis and draft generation as a real workspace. Analyze stride rhythm, contact timing, center of mass. Preview at gameplay scale with footfall markers and root motion overlays. Generate constrained draft frame tracks.

### Validate

Repair-oriented workspace with issue highlighting on canvas. Categories include palette contract, socket alignment, atlas sizing, animation timing, and locomotion profile. Each issue links to jump-to-fix repair actions.

### Export

Export with live preview and validation readiness checks. Presets for sprite sheet, animation strip, PNG sequence, GIF, and engine-ready atlas packages.

### Scene

Multi-asset composition workspace for assembling sprites into scenes. Place, layer, and arrange asset instances on a shared canvas with camera controls and parallax depth.

**Instances:** Add asset instances from the catalog, position them with drag or precise coordinates, control z-order, visibility, and opacity per instance.

**Camera:** Pan and zoom the scene camera. Author camera keyframes on the timeline for animated camera moves with linear or hold interpolation.

**Playback:** Scene-level playback with tick-based clock, FPS control, and loop toggle. Clip assignments control which animation each instance plays.

**Character builder:** Assemble character instances from slot-based builds with source linking, overrides, and re-application from source.

**History:** Full undo/redo for all scene operations (instance placement, camera moves, character edits) with provenance logging and drilldown inspection.

### Vector

Vector master editing workspace for creating and editing SVG-based shapes that can be reduced to pixel art at target resolutions.

**Tools:** Select, rectangle, ellipse, line, pen, and text tools with fill color, stroke color, and stroke width controls.

**Live preview:** Real-time rasterized preview at target pixel resolution using size profiles, with collapse overlay showing how vector shapes map to the pixel grid.

**AI creation:** Vector shape generation through AI prompts with structured output.

**Reduction:** Convert vector artwork to pixel art at configured size profiles with preview before commit.

### Project Home

Landing screen for creating, opening, and managing projects. Templates for common starting points (blank sprite, character animation, modular kit, faction palette study).
