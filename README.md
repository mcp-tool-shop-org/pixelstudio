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
  <img src="https://img.shields.io/badge/tests-2550%2B%20passing-brightgreen?style=flat-square" alt="Tests">
  <a href="https://mcp-tool-shop-org.github.io/glyphstudio/"><img src="https://img.shields.io/badge/Landing_Page-live-blue?style=flat-square" alt="Landing Page"></a>
</p>

# GlyphStudio

A governed pixel asset studio for stills, motion, variants, reusable parts, and structured output.

GlyphStudio is a desktop app built with **Tauri v2**, **React**, and **Rust**. It ships alongside an **MCP server** that exposes the full sprite editing surface to LLMs — same domain logic, same pixel buffers, same undo/redo.

## What You Can Do

**Create** — Draw pixel art with deterministic tools, layers, and palette control.

**Animate** — Build frame-by-frame motion with onion skin, timing holds, and seam-quality tools.

**Variant** — Fork assets into named document variants (directional, pose) and palette variants (recolor families). Preview before commit.

**Reuse** — Promote selections to reusable parts. Save curated packs. Stamp parts across projects.

**Bundle** — Export asset families in one pass: base + document variants + palette variants, with contextual filenames.

**Start fast** — Begin from templates, packs, or starter recipes. The front door reflects the workflows the studio supports.

## Best Workflows

### Still Sprite
Blank project (32x32) &rarr; draw with pencil/fill/eraser &rarr; palette workspace &rarr; export PNG.

### Animated Loop
Blank project (32x32, 4 frames) &rarr; draw frame 1 &rarr; duplicate + edit &rarr; onion skin for alignment &rarr; timing holds &rarr; GIF or strip export.

### Variant Family
Draw base asset &rarr; fork document variants (e.g. walk-left, walk-right) &rarr; create palette sets (e.g. Fire, Ice) &rarr; preview palette remap &rarr; bundle export with `{name}-{variant}-{palette}.png` filenames.

### Reusable Parts
Draw a recurring form &rarr; select &rarr; promote to part &rarr; save to library &rarr; stamp into other frames/projects. Save curated parts + palettes as a pack for cross-project reuse.

### Template/Pack Start
ProjectHome &rarr; choose template (animation-ready or variant-ready) or pack (UI kit, palette collection) &rarr; working project with structure already loaded.

## Showcase

Four canonical projects demonstrate the strongest workflows. Each is a valid interchange file you can import:

| Showcase | File | What it proves |
|----------|------|----------------|
| Crystal Gem | [`showcase/still-sprite.interchange.json`](showcase/) | Still-image creation, palette use |
| Flickering Flame | [`showcase/loop-animation.interchange.json`](showcase/) | 4-frame animation, timing |
| Shield Variants | [`showcase/variant-family.interchange.json`](showcase/) | Base + Fire/Ice palette variants |
| Game UI Kit | [`showcase/pack-project.interchange.json`](showcase/) | Reusable parts (star, heart, coin) |

See [`showcase/SHOWCASE.md`](showcase/SHOWCASE.md) for details.

## Key Concepts

| Concept | What it is | Where it lives |
|---------|-----------|----------------|
| **Palette Set** | A named set of colors for recoloring | Document-level, switchable |
| **Document Variant** | A fork of the frame sequence (pose, direction) | Document-level, independent frames |
| **Part** | A reusable pixel stamp promoted from a selection | Library, cross-project |
| **Pack** | A curated bundle of palette sets + parts | Library, importable/exportable |
| **Template** | A project-start blueprint (canvas, palette, frames) | Library, used from ProjectHome |
| **Bundle** | A one-pass export of base + variants + palettes | Export flow |
| **Interchange** | JSON format for moving authored structures between projects | `.interchange.json` files |

## Contextual Shortcuts

GlyphStudio shows relevant shortcuts based on what you are doing. The strip updates as context changes.

| Context | Key shortcuts |
|---------|--------------|
| **Drawing** | `B` Pencil, `E` Eraser, `G` Fill, `M` Marquee, `X` Swap FG/BG, `Ctrl+Z` Undo |
| **Selection active** | `Ctrl+C` Copy, `Ctrl+X` Cut, `Ctrl+V` Paste, `Del` Clear, `Esc` Deselect |
| **Stamp mode** | `Click` Place stamp, `Esc` Exit |
| **Animation** | `Ctrl+D` Duplicate frame, `Space` Play/Stop, `Left/Right` Step frames |
| **Library focused** | `Ctrl+F` Search, `Up/Down` Navigate, `Enter` Activate |
| **Variant workflow** | `+ Variant` Fork sequence, `Toggle` Compare overlay |
| **Palette preview** | `Apply` Commit remap, `Cancel` Discard |

## Packages

| Package | Description |
|---------|-------------|
| `apps/desktop` | Tauri v2 desktop app (React + Rust) |
| [`@glyphstudio/domain`](packages/domain/) | Types and contracts |
| [`@glyphstudio/api-contract`](packages/api-contract/) | Tauri IPC contract types |
| [`@glyphstudio/state`](packages/state/) | State management, raster ops, history |
| [`@glyphstudio/mcp-sprite-server`](packages/mcp-sprite-server/) | MCP server — 76 tools, 6 resources |

## Architecture

### Frontend (React + TypeScript)
- Zustand stores organized by domain
- HTML canvas renderer
- Sprite editor with frontend-owned pixel buffers and alpha compositing
- Library panel with unified index, search, pinning, and keyboard navigation

### Backend (Rust)
- Authoritative pixel buffers and layer compositing
- Stroke transactions with undo/redo
- Project persistence, autosave, crash recovery
- Export pipelines (PNG, sprite sheet, animated GIF, bundle)
- Scene composition engine with camera and playback

### MCP Server (Node.js)
- Headless Zustand store per session (no React, no browser)
- 76 tools registered via `@modelcontextprotocol/sdk`
- Same `@glyphstudio/domain` and `@glyphstudio/state` code as the desktop app
- Runs over stdio — works with Claude Desktop, Claude Code, or any MCP client

See the [MCP server README](packages/mcp-sprite-server/README.md) for the full tool inventory.

## Monorepo Structure

```text
glyphstudio/
  apps/desktop/           Desktop app (React + Tauri + Rust)
    src/                  Frontend
    src-tauri/            Rust backend
  packages/
    domain/               Types and contracts
    api-contract/         Tauri IPC types
    state/                State management, raster, history (2,550+ tests)
    mcp-sprite-server/    MCP server — 76 tools
  showcase/               Canonical showcase projects
  site/                   Landing page (Astro)
```

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

### Test

```bash
pnpm test
```

### Rust check

```bash
cd apps/desktop/src-tauri
cargo check
cargo test
```

## Export Support

| Target | Formats |
|--------|---------|
| **Single frame** | PNG (composited visible layers) |
| **Animation** | Animated GIF, PNG sequence, sprite strip |
| **Sheet** | Sprite sheet with manifest (native + generic runtime) |
| **Bundle** | Folder or zip with images, manifests, and preview |
| **Variant family** | Base + document variants + palette variants with contextual filenames |
| **MCP Server** | Base64-encoded PNG, sheet, GIF, and metadata JSON |

Exports use composited visible layers only. Editor overlays (onion skin, playback state) are never included in output.

## Product Philosophy

1. **Deterministic editing** — Every pixel mutation is lawful, inspectable, and reversible.
2. **Subordinate AI** — Automation assists the workflow without replacing creative control.
3. **Animation-first structure** — Frames, timeline, onion skin, and playback are core concepts, not afterthoughts.
4. **Trustworthy state** — Save/load, autosave, undo/redo, and migration are treated as product features.
5. **Honest reuse** — Parts are stamped (committed pixels), not fake linked instances. Variants are forks, not hidden shared state. Preview before commit.

## Non-Goals

GlyphStudio is not aiming to be:

- A generic image editor
- A browser-first toy app
- An AI prompt wrapper that guesses at art
- A mushy canvas where frontend state and backend truth drift apart
- A fake rigging/symbol system pretending to be linkage

## Security

GlyphStudio is a **desktop-only** application. No network requests, no telemetry, no secrets.

- **Data touched:** local sprite files (.glyph, .pxs, .png), autosave/recovery files
- **Data NOT touched:** no network, no cloud, no remote APIs, no user accounts
- **Permissions:** filesystem access scoped to user-selected directories via Tauri v2 native file dialogs

The MCP server runs locally over stdio with no network egress. See [SECURITY.md](SECURITY.md) for vulnerability reporting.

## License

[MIT](LICENSE)

---

Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
