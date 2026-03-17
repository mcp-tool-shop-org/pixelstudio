<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <img src="assets/logo.png" alt="GlyphStudio" width="400" />
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/glyphstudio/actions"><img src="https://img.shields.io/github/actions/workflow/status/mcp-tool-shop-org/glyphstudio/ci.yml?branch=main&style=flat-square&label=CI" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-informational?style=flat-square" alt="Platforms">
  <img src="https://img.shields.io/badge/tauri-v2-orange?style=flat-square" alt="Tauri v2">
  <img src="https://img.shields.io/badge/tests-3402%2B%20passing-brightgreen?style=flat-square" alt="Tests">
  <a href="https://mcp-tool-shop-org.github.io/glyphstudio/"><img src="https://img.shields.io/badge/Landing_Page-live-blue?style=flat-square" alt="Landing Page"></a>
</p>

# GlyphStudio

Craft-first sprite studio for deterministic pixel editing, frame-by-frame animation, and programmable sprite pipelines.

GlyphStudio is a desktop app built with **Tauri v2**, **React**, and **Rust**. It ships alongside an **MCP server** that exposes the full sprite editing surface to LLMs — same domain logic, same pixel buffers, same undo/redo.

## Packages

| Package | Description | |
|---------|-------------|---|
| `apps/desktop` | Tauri v2 desktop app (React + Rust) | The editor |
| [`@glyphstudio/domain`](packages/domain/) | Types and contracts | Shared |
| [`@glyphstudio/api-contract`](packages/api-contract/) | Tauri IPC contract types | Shared |
| [`@glyphstudio/state`](packages/state/) | State management, raster ops, history | Shared |
| [`@glyphstudio/mcp-sprite-server`](packages/mcp-sprite-server/) | MCP server — 76 tools, 6 resources | [README](packages/mcp-sprite-server/README.md) |

## Current Status

GlyphStudio is a working desktop editor with 41 shipped stages, an MCP server with 76 programmable tools, and 3,402+ tests across Rust and TypeScript.

### Canvas Editor (Rust backend)
- Deterministic pixel canvas with nearest-neighbor rendering
- Layers with visibility, lock, opacity, rename, reorder
- Stroke-based drawing with undo/redo
- Canvas analysis: bounding box, color histogram, frame-to-frame comparison
- Rectangular selection, clipboard actions, and transform workflow
- Multi-frame timeline with per-frame undo/redo isolation
- Onion skin overlays for adjacent-frame editing
- Playback controls with FPS and loop support
- Motion assistance with deterministic proposal generation
- Anchor system with hierarchy, falloff, and secondary motion templates
- Motion presets with batch apply across frames
- Clip definitions with pivot, tags, and validation
- Sprite sheet export with manifest (native + generic runtime formats)
- Animated GIF export with per-frame delay support
- Asset catalog with thumbnails, search, and bundle packaging
- Project save/load, autosave recovery, and schema migration

### Pre-Production Workflow (Stage 39)
- **Reference images** — import, opacity/scale/pan, toggle visibility, lock
- **Sketch layers** — first-class `sketch` layer type excluded from export compositing
- **Silhouette toggle** — flatten visible layers to single-color form check
- **Snapshots** — capture/restore/delete canvas state for iteration
- **Before/after compare** — toggle between current canvas and any snapshot
- **Rough drawing mode** — sketch-brush and sketch-eraser with configurable size, opacity, and scatter for fast form blocking (N / Shift+N shortcuts)

Intended workflow: import reference → create sketch layer → rough block-in → silhouette check → snapshot → compare → refine on normal layer.

### Concept-to-Sprite Translation (Stage 40)
- **Translation workspace** — session tracking with concept→sprite relationships, cue survival categorization
- **Comparison utilities** — nearest-neighbor downscale (reference), pixel-perfect upscale, side-by-side layout
- **Silhouette survival analysis** — quantifies how much of the concept read survives at target resolution
- **Tested translations** — ranger/scout (500→48), treasure chest (500→32 + 48)

Translation discipline: rebuild at target resolution, don't downscale. Identify strongest read cues, accept detail loss, exaggerate where needed.

### Vector Master Pipeline (Stage 41)
- **Vector domain model** — rect, ellipse, line, polygon primitives with per-shape transforms (translate/scale/rotate/flip), fill, stroke, and reduction metadata
- **Reduction-aware metadata** — cueTag, survivalHint (must-survive / prefer-survive / droppable), dropPriority per shape
- **Groups** — one-level named grouping for body regions (head, torso, weapon, etc.)
- **Size profiles** — 7 built-in sprite target sizes (16×16 through 64×64), custom profiles
- **Vector rasterizer** — scanline polygon fill (even-odd rule), ellipse scanline, Bresenham lines, alpha compositing, pixel-grid-aware (no anti-aliasing, 1px minimum clamping)
- **Multi-size comparison** — rasterize to all profiles, pixel-perfect upscaled comparison strip
- **Reduction analysis** — per-profile survival/collapse report with silhouette bounds and fill coverage
- **Separate format** — `.glyphvec` vector master documents, `.glyph` raster sprites, provenance link between them

Pipeline: design vector master with reduction rules (exaggerate, space apart, value chunks) → rasterize to target sizes → inspect readability → pixel cleanup per size.

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
- Palette workspace with slot editing, lock, semantic roles, and color groups/ramps
- Client-side validation engine with palette, animation, and export rules
- Pixel-perfect stroke mode (removes L-shaped corners from 1px lines)
- Production workflows: create static/animated sprites, analyze, validate, export review packs
- Undo/redo with deep-snapshot history (document + all pixel buffers)
- `.glyph` file persistence with schema-versioned serialize/deserialize

### MCP Server (`@glyphstudio/mcp-sprite-server`)

Headless MCP server that exposes the sprite editor as 76 programmable tools. Calls the same `@glyphstudio/domain` and `@glyphstudio/state` code as the desktop app — no parallel raster, no shadow state.

- **Session/Document** — create, open, save, close documents
- **Drawing** — batch pixel draw, line, flood fill, erase, sample
- **Frames & Layers** — add, remove, duplicate, move, rename, toggle visibility
- **Selection** — rect, copy, cut, paste, flip, commit
- **History** — undo, redo, batch apply (multiple ops as single undo step)
- **Analysis** — bounding box, color histogram, frame-to-frame diff
- **Transform** — flip, rotate (90/180/270), resize canvas
- **Render** — frame PNG, sprite sheet, overview thumbnails
- **Import/Export** — sheet import, PNG/GIF/metadata export
- **Playback** — config, preview play/stop/scrub/step

See the [MCP server README](packages/mcp-sprite-server/README.md) for the full tool inventory, quick start, and examples.

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
- 18+ Zustand stores organized by domain
- HTML canvas renderer for both editors
- Canvas editor UI: layers, timeline, selection, playback, character builder, scene compositor
- Sprite editor: self-contained pixel editing with frontend-owned pixel buffers
- Alpha compositing via `flattenLayers` for multi-layer sprite editing

### Backend (Rust)
- Authoritative pixel buffers and layer compositing for canvas editor
- Stroke transactions with before/after patches
- Selection/transform sessions
- Project persistence, autosave, crash recovery
- Export pipelines (PNG, sprite sheet, clip, bundle, animated GIF)
- Scene composition engine with camera and playback
- Asset catalog with thumbnail generation
- 170 implemented Tauri commands

### MCP Server (Node.js)
- Headless Zustand store per session (no React, no browser)
- Store adapter wraps real state/domain logic
- 76 tools registered via `@modelcontextprotocol/sdk`
- Runs over stdio — works with Claude Desktop, Claude Code, or any MCP client

### Desktop Shell
- Tauri v2

## Monorepo Structure

```text
glyphstudio/
  apps/desktop/           Desktop app (React + Tauri + Rust)
    src/                  Frontend
    src-tauri/            Rust backend (170 commands, 298 tests)
  packages/
    domain/               Types and contracts (18 tests)
    api-contract/         Tauri IPC types
    state/                State management, raster, history (1,778 tests)
    mcp-sprite-server/    MCP server — 76 tools (288 tests)
  site/                   Landing page (Astro)
```

### Stages 31–34 — Sprite Export, Persistence, Desktop Parity, and Workspace Authority
Sprite sheet metadata JSON, animated GIF encoder, sheet+JSON combo export, `.glyph` file serialize/deserialize with schema versioning, save/open/save-as with Tauri file dialogs. Stage 32 adds selection transform UI (flip/rotate with keyboard shortcuts), layer opacity slider, and animated GIF export from the Rust backend. Stage 33 adds analysis panel (bounds, color histogram, frame compare with Copy JSON), brush shape picker, pixel-perfect toggle, and reset view button. Stage 34 adds palette workspace (slot editing, lock, semantic roles, color groups), validation workspace (rule engine with 8 rules across 3 categories, issue list with severity, category filters, detail pane), and real pixel-perfect stroke behavior (L-corner removal for 1px lines). Stage 35 adds production workflows: workflow engine with domain types and Zustand store, 5 workflows (New Static Sprite, New Animation Sprite, Analyze, Validate, Export Review Pack), step-by-step runner UI, and ProjectHome rewrite with real create form and workflow discovery. Stage 36 is a production dogfood: 5 benchmark sprites (crate, knight idle, walk cycle, spark hit, grass tiles) created through the real headless store paths, exercising palette groups, multi-frame animation, analysis, validation, and export. Friction log identifies repeated blockers for Stage 37.

### MCP Server (MCP.1–MCP.6)
Headless MCP server with 76 tools and 6 resources: session management, document CRUD, drawing/raster ops, frame/layer management, selection/clipboard, tool settings, playback, render/export, sprite history with undo/redo, batch operations, canvas analysis, canvas transforms, structured error model, and machine-readable tool catalog.

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

### Run MCP server (standalone)

```bash
npx tsx packages/mcp-sprite-server/src/cli.ts
```

### Typecheck

```bash
pnpm typecheck
```

### Test (TypeScript packages)

```bash
pnpm --filter @glyphstudio/domain test
pnpm --filter @glyphstudio/state test
pnpm --filter @glyphstudio/mcp-sprite-server test
```

### Rust check

```bash
cd apps/desktop/src-tauri
cargo check
cargo test
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

### MCP Server
- **Frame PNG** — base64-encoded composited frame
- **Sheet PNG** — base64-encoded horizontal sprite sheet
- **Animated GIF** — base64-encoded animation
- **Metadata JSON** — frame positions, timing, layout

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

The MCP server runs locally over stdio with no network egress. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)

---

Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
