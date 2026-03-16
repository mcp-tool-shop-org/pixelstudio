# Stage 36 — Sprite Production Dogfood and Friction Audit

## Goal

Prove that GlyphStudio can produce real sprite assets through its shipped workflows.
This is not a feature stage. This is evidence.

## Benchmark Asset Pack

Five assets, one shared style target, intentionally small.

### Style Target

- **NES-era 8-bit pixel art** — limited palette, clear silhouettes, 1px outlines
- Shared 16-color palette across all assets (some assets may use fewer)
- All canvases ≤ 32×32 pixels (honest scale for pixel art)

### Assets

| # | Asset | Type | Canvas | Frames | Timing | Workflow |
|---|-------|------|--------|--------|--------|----------|
| 1 | Wooden Crate | Static prop | 16×16 | 1 | — | New Static Sprite |
| 2 | Knight Idle | Character idle | 16×24 | 2 | 500ms | New Animation Sprite |
| 3 | Knight Walk | Walk cycle | 16×24 | 4 | 150ms | New Animation Sprite |
| 4 | Spark Hit | FX sprite | 16×16 | 3 | 80ms | New Animation Sprite |
| 5 | Grass Tiles | Tileset chunk | 32×16 | 1 | — | New Static Sprite |

### Shared Palette (16 colors, NES-inspired)

| Index | Name | RGBA | Role | Group |
|-------|------|------|------|-------|
| 0 | Transparent | 0,0,0,0 | — | — |
| 1 | Black | 0,0,0,255 | outline | Outline |
| 2 | Dark Gray | 85,85,85,255 | shadow | Neutral |
| 3 | Mid Gray | 170,170,170,255 | — | Neutral |
| 4 | White | 255,255,255,255 | highlight | Neutral |
| 5 | Dark Brown | 102,57,0,255 | — | Warm |
| 6 | Brown | 153,102,51,255 | — | Warm |
| 7 | Tan | 204,170,102,255 | skin | Warm |
| 8 | Dark Red | 153,0,0,255 | — | Accent |
| 9 | Red | 255,51,51,255 | — | Accent |
| 10 | Dark Green | 0,102,0,255 | — | Nature |
| 11 | Green | 51,170,51,255 | — | Nature |
| 12 | Dark Blue | 0,51,153,255 | — | Cool |
| 13 | Blue | 51,102,255,255 | — | Cool |
| 14 | Yellow | 255,204,0,255 | — | Accent |
| 15 | Peach | 255,204,170,255 | skin-light | Warm |

### Success Criteria Per Asset

1. **Wooden Crate**: Recognizable silhouette, outline reads at 1×, shade/highlight visible
2. **Knight Idle**: Body reads clearly, 2-frame bob or blink, palette groups used for body parts
3. **Knight Walk**: 4-frame cycle with leg movement, timing feels walk-speed, onion skin used
4. **Spark Hit**: 3-frame expand/fade, FX reads as impact, transparent bg clean
5. **Grass Tiles**: 2 tile variants side by side, seamless horizontally, nature group used

### Export Formats Per Asset

- All: PNG export of final frame
- Animated (2–4): GIF export
- All: Validation report (pass or documented issues)
- All: Analysis output (bounds, color count)

## Evidence Capture

During production, record:
- Every workflow step that felt wrong, slow, or confusing
- Every palette operation that helped or hurt
- Every missing feature that was needed more than once
- Every validation rule that caught a real problem
- Every validation rule that fired but was noise
- Every analysis output that was useful vs decorative
- Every export step that worked or didn't

## Rules

1. Repeated friction beats speculative roadmap ideas
2. One-off weirdness is just the universe being a little gremlin
3. No fake assets — every pixel must be placed through the real code paths
4. No feature work during the dogfood — only record, don't fix
5. Fix selection happens AFTER the full pack is done
