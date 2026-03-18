# GlyphStudio Workflows

Production workflows organized by what you are trying to accomplish.

## Still Sprite

**Goal:** Create one clean standalone pixel art asset.

1. ProjectHome &rarr; **Static Sprite** recipe (32x32 blank)
2. Draw with pencil (`B`), fill (`G`), eraser (`E`)
3. Use palette workspace for color discipline
4. `Ctrl+Z` to undo, `X` to swap foreground/background
5. Export &rarr; PNG

**Power moves:**
- Promote a selection to a reusable part for later
- Save your palette as a palette set for variant use

## Animated Loop

**Goal:** Create a smooth motion cycle.

1. ProjectHome &rarr; **Animated Loop** recipe (32x32, 4 frames, 120ms)
2. Draw frame 1
3. `Ctrl+D` to duplicate frame, edit the next pose
4. Enable onion skin for alignment across frames
5. `Space` to play/stop, `Left/Right` to step through frames
6. Adjust per-frame timing for holds and snap
7. Export &rarr; Animated GIF or sprite strip

**Power moves:**
- Snapshot before risky edits, compare with before/after
- Use range selection for batch timing changes

## Variant Family

**Goal:** Create a base asset with multiple visual variants.

### Document Variants (pose/direction)
1. Create base asset (still or animated)
2. VariantBar &rarr; **+ Variant** to fork the sequence
3. Edit the variant independently
4. Toggle compare overlay to check against base
5. Repeat for additional variants

### Palette Variants (recolor)
1. Create named palette sets (e.g. "Fire", "Ice")
2. Switch active palette set to preview the remap
3. Verify the result before committing
4. Apply to single frame, range, or entire sequence

### Bundle Export
1. Select which document variants to include
2. Select which palette variants to include
3. Review the bundle plan (file count, names)
4. Export &rarr; `{name}-{variant}-{palette}.{ext}`

## Reusable Parts

**Goal:** Build a library of reusable pixel forms.

1. Draw a recurring shape (icon, decoration, UI element)
2. Select it with marquee (`M`)
3. Promote to part &rarr; saved to Library
4. In any project: Library &rarr; select part &rarr; **Stamp Mode**
5. Click to place (committed pixels, not linked instances)

**Power moves:**
- `Ctrl+F` to search Library by name
- Pin frequently used parts for quick access
- Save related parts as a Pack for cross-project reuse

## Packs and Templates

### Saving a Pack
1. Open Library panel
2. Select palette sets and/or parts to include
3. Export as Pack (interchange JSON)

### Starting from a Template
1. ProjectHome &rarr; **From Template**
2. Choose a saved template (canvas size, palette, frame setup)
3. Working project with structure already loaded

### Applying a Pack to an Existing Project
1. Library &rarr; Import Pack
2. Review what will be added (palette sets, parts)
3. Handle conflicts: rename, skip, or overwrite
4. Commit &rarr; assets merge into current project

## Interchange

GlyphStudio uses a single JSON-based format for all portable authored structures:

- **Templates** &rarr; project-start blueprints
- **Packs** &rarr; curated asset bundles
- **Palette sets** &rarr; reusable color families
- **Parts** &rarr; reusable pixel stamps

Files use the `.interchange.json` extension and are human-readable.

Import always shows a review step with conflict detection before committing.
