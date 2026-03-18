---
title: Production Workflows
description: Variant families, reusable parts, templates, packs, and structured export
sidebar:
  order: 5
---

GlyphStudio is not just an editor. It is a production system for pixel asset families — stills, motion, palette variants, directional poses, and structured export bundles.

This page covers the production workflows that turn individual sprites into shippable asset families.

## Palette Variants

A **palette set** is a named collection of colors that can remap an asset's appearance without redrawing.

### Creating palette sets

1. Open the palette workspace
2. Author your base colors with names (e.g. "Skin", "Metal", "Wood")
3. Save the current palette as a named set
4. Create additional sets with different color assignments (e.g. "Fire", "Ice", "Seasonal")

### Previewing and applying

Palette remap is **preview-before-commit**:

1. Select a palette set from the switcher
2. The canvas shows the remapped result as a transient preview
3. Choose scope: active frame, selected range, or entire sequence
4. **Apply** commits the remap — **Cancel** discards it

Preview uses the same exact RGBA mapping logic as commit. What you see is what you get.

### How remap works

Remap is exact color matching — each source RGBA value maps to the corresponding position in the destination palette set. Transparency and alpha are preserved. Colors with no match in the destination palette are left unchanged (passed through as-is).

There is no heuristic recoloring. The mapping is deterministic and testable.

## Reusable Parts

A **part** is a named, thumbnailed pixel stamp stored in the Library.

### Creating parts

1. Draw a recurring form (icon, decoration, UI element)
2. Select it with the marquee tool (`M`)
3. Promote the selection to a part — it saves to the Library with a thumbnail

### Using parts

1. Open the Library panel
2. Find the part (search, filter, or browse by thumbnail)
3. Click to enter **stamp mode**
4. Click on the canvas to place — committed pixels, not linked instances

Parts are **honest reuse**. Each placement is independent. There is no hidden linkage, no symbol system, no silent propagation. If you want to update a recurring element, you re-stamp intentionally.

### Organizing parts

- **Pin** frequently used parts for quick access
- **Search** by name with `Ctrl+F`
- **Filter** by type, recent, or pinned
- **Tags** for categorization (e.g. "ui", "shape", "character")

## Document Variants

A **document variant** is a named fork of the frame sequence — independent frames with independent pixel data.

### Creating variants

1. VariantBar → **+ Variant** to fork the current sequence
2. The new variant starts as a copy of the base
3. Edit the variant's frames independently
4. Switch between variants using the VariantBar

### Common uses

- **Directional variants**: walk-left, walk-right, walk-up
- **Pose variants**: idle, attack, hurt
- **Alternate designs**: seasonal, equipped, upgraded

### Comparing variants

Toggle the compare overlay to see the base variant as a ghost behind the current variant. This helps maintain consistency across directional or pose variants without switching back and forth.

### Architecture

Variants are **forks, not views**. Each variant owns its own frame sequence. There is no shared state, no live linkage, no hidden synchronization. Changes to the base do not propagate to variants. This is intentional — it keeps the system predictable and avoids the complexity of linked symbol systems.

## Bundle Export

Bundle export produces a family of related output files in a single deliberate pass.

### What a bundle includes

A bundle can combine:
- **Base** frames/sequence
- **Selected document variants** (e.g. walk-left + walk-right)
- **Selected palette variants** (e.g. Fire + Ice)
- **Output formats** (PNG, GIF, sprite strip)

### The bundle plan

Before writing any files, the bundle export generates a **preview plan**:
- Exact file count
- Every filename
- Which variant × palette × scope combination each file represents

You review the plan before committing. No hidden output.

### Naming convention

Files follow a predictable pattern:

```
{project}-{variant}-{palette}.{ext}
```

Empty axes are omitted cleanly — a base asset with no variants exports as just `{project}.png`.

## Library

The Library is a unified index over all authored structures: parts, palette sets, and document variants.

### Views

- **All** — complete inventory
- **Recent** — items you used recently (max 12, deduplicated)
- **Pinned** — items you explicitly prioritized

### Retrieval

- **Search**: tokenized AND matching, case-insensitive (`Ctrl+F` to focus)
- **Filter**: by type (parts, palette sets, variants), by pinned, by active
- **Sort**: priority (pinned → active → recent → rest), name, or recent-first
- **Keyboard**: arrow keys to navigate, Enter to activate

### What the Library shows

Each item type has a visual summary designed for scanning without opening:

- **Parts**: pixel thumbnail at actual size
- **Palette sets**: color swatch strip
- **Variants**: name + frame count

## Packs

A **pack** is a curated bundle of palette sets and/or parts, stored as interchange JSON.

### Creating a pack

1. Open the Library panel
2. Select the palette sets and parts to include
3. Export as Pack

### Using a pack

1. Import the pack (from Library or ProjectHome)
2. Review what will be added — palette sets and parts with conflict detection
3. Handle conflicts: **rename**, **skip**, or **overwrite**
4. Commit — assets merge into the current project

Packs are for **project enrichment** — bringing useful authored structures into an existing workflow without starting over.

## Templates

A **template** is a project-start blueprint containing canvas size, palette, frame setup, and optionally palette sets and parts.

### Creating a template

1. Set up a project the way you want future projects to start
2. Save as template from the Library panel

### Using a template

1. ProjectHome → **From Template**
2. Select a saved template
3. A new project is created with the template's settings already applied

Templates are for **project starts** — not for merging into existing work. Use packs for enrichment.

## Interchange Format

All portable structures (templates, packs, palette sets, parts) use a single JSON-based interchange format:

- **Format identifier**: `glyphstudio-interchange`
- **Versioned**: the format version is tracked for forward compatibility
- **Human-inspectable**: standard JSON, readable in any text editor
- **Conflict-aware**: import always shows a review step with conflict detection

Files use the `.interchange.json` extension.

## Start Flow

ProjectHome offers multiple start paths:

| Mode | What it does |
|------|-------------|
| **Blank** | Empty canvas with chosen dimensions |
| **From Template** | Project with pre-loaded settings and palette |
| **From Pack** | Blank project + imported pack assets |
| **Starter Recipe** | Curated start path for a specific workflow |

### Starter recipes

Recipes are thin orchestration over existing start flows:

- **Static Sprite** — 32×32 blank, palette-ready
- **Animated Loop** — 32×32, 4 frames at 100ms, timeline visible
- **Variant Family** — variant-ready setup with palette support
- **Asset Pack Project** — blank project with pack applied

Each recipe includes one or two contextual hints after launch — dismissible and non-repeating.

### Pinned starts

Pin templates, packs, or recipes that you use often. Pinned items appear first in ProjectHome, reflecting your actual studio workflow instead of a generic launcher.

## Contextual Shortcuts

GlyphStudio shows relevant keyboard shortcuts based on what you are doing. The shortcut strip at the bottom of the editor updates as context changes.

| Context | Shortcuts |
|---------|-----------|
| **Drawing** | `B` Pencil · `E` Eraser · `G` Fill · `M` Marquee · `X` Swap · `Ctrl+Z` Undo |
| **Selection** | `Ctrl+C` Copy · `Ctrl+X` Cut · `Ctrl+V` Paste · `Del` Clear · `Esc` Deselect |
| **Stamp mode** | Click to place · `Esc` to exit |
| **Animation** | `Ctrl+D` Duplicate · `Space` Play/Stop · `←→` Step |
| **Library** | `Ctrl+F` Search · `↑↓` Navigate · `Enter` Activate |
| **Variants** | `+ Variant` Fork · Toggle Compare |
| **Palette preview** | Apply to commit · Cancel to discard |

### Workflow hints

State-triggered hints surface the strongest next moves at the moment they become relevant:

- First selection → promote to reusable part hint
- Multiple frames added → onion skin hint
- Palette preview active → apply/cancel hint
- Variants exist → compare overlay hint
- Stamp mode entered → placement hint
- Multiple bundle outputs → scope and export hint
- Parts in library → keyboard search hint

Hints are dismissible, non-repeating (persisted across sessions), and never block work.
