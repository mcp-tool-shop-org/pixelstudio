# GlyphStudio v1.0.0 — Release Notes

GlyphStudio is a governed pixel asset studio for stills, motion, variants, reusable parts, and structured output.

## Creative Power

Draw pixel art with deterministic tools on a native desktop canvas. Layers, palette workspace, rectangular selection, pixel-perfect strokes. Every mutation is inspectable and reversible.

## Animation

Frame-by-frame editing with onion skin, per-frame timing holds, and playback controls. Duplicate frames, adjust spacing, and compare motion against snapshots. Export to animated GIF, sprite strip, or PNG sequence.

## Motion Quality

Seam inspection, timing adjustments, hold-frame controls, and snapshot-based comparison. Tools for making motion feel right, not just technically correct.

## Palette Variants

Create named palette sets for recoloring workflows. Preview the remap before committing. Apply to a single frame, a selected range, or the entire sequence. Export multiple palette variants in one pass with contextual filenames.

## Reusable Parts

Promote any selection to a named, thumbnailed part stored in the Library. Stamp parts across frames and projects — committed pixels, not linked instances. Save curated parts as packs for cross-project reuse.

## Document Variants

Fork a sequence into named variants (directional poses, alternate animations). Each variant has independent frames. Compare against the base with ghost overlay. Export variant families with structured naming.

## Bundle Export

Export base + document variants + palette variants in a single deliberate pass. Review the bundle plan (file count, names, scope) before writing any files. Filenames follow `{name}-{variant}-{palette}.{ext}`.

## Library and Retrieval

Unified library index with thumbnails, swatch strips, and frame-count summaries. Search by name, filter by type, pin frequently used items, and track recent usage. Keyboard navigation with `Ctrl+F` to focus search.

## Templates and Packs

Start from animation-ready or variant-ready templates. Import curated packs to enrich existing projects. Import review shows conflicts with rename/skip/overwrite options. Interchange format is JSON-based, versioned, and human-inspectable.

## Studio Start Flow

ProjectHome offers four start modes: Blank, From Template, From Pack, and Starter Recipes. Pinned starts reflect actual workflow. Contextual hints surface the strongest next moves after launch.

## Contextual Fluency

State-aware shortcut strip shows relevant commands as context changes. Workflow hints trigger from real editor state, dismiss on use, and never block work.

## MCP Server

76 programmable tools expose the full sprite editing surface to LLMs. Same domain logic, same pixel buffers, same undo/redo as the desktop app. Runs over stdio with no network egress.

## Release Readiness

- All canonical workflows tested end-to-end
- Save/load roundtrip validated for all authored structures
- Backward-compatible persistence (old files load cleanly)
- First-launch seeding is idempotent
- No P0 blockers

## Showcase

Four canonical projects ship as importable interchange files:

| Project | What it demonstrates |
|---------|---------------------|
| Crystal Gem | Still-image creation with palette discipline |
| Flickering Flame | 4-frame animation loop with authored timing |
| Shield Variants | Base + Fire/Ice palette variant family |
| Game UI Kit | Reusable parts pack (star, heart, coin) |

## Tech Stack

- **Tauri v2** — native desktop, cross-platform (Windows, macOS, Linux)
- **React + TypeScript** — UI and state management (Zustand)
- **Rust** — pixel truth, persistence, export pipelines
- **2,550+ tests** across TypeScript and Rust
