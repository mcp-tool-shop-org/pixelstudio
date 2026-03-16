# Stage 36 — Friction Log

Collected during benchmark asset production (5 sprites created through headless store).

## Friction Findings

### Workflow

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| pain | No batch frame duration setter — had to loop through frames individually after creation | Knight Idle, Knight Walk, Spark Hit | speed |
| pain | Creating animation frames from scratch is tedious — duplicate-and-modify workflow would help but headless adapter's `storeDuplicateFrame` requires separate frame switch + active frame tracking | Knight Walk | speed |
| annoyance | Palette setup requires direct state mutation — headless adapter has no `storeAddPaletteColor`, `storeSetPaletteColorRole`, `storeCreateColorGroup` etc. | All | speed, trust |
| annoyance | `storeAddFrame` always inserts after active frame — no way to append at end directly | Knight Walk | speed |

### Palette

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| annoyance | Color groups are character/environment-oriented — FX sprites use colors cross-group without coherence | Spark Hit | quality |
| annoyance | No palette preset/template system — had to set up 16 colors manually for every document | All | speed |
| wish | Palette remap not available — would help when adjusting color scheme across assets | All | quality |

### Validation

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| annoyance | Single-frame info rule fires on static sprites — technically correct but not actionable | Wooden Crate, Grass Tiles | trust |
| wish | No tileset validation rules — seamless edge checking would be genuinely useful | Grass Tiles | quality |
| wish | No "unused palette color" rule — would catch palette bloat | All | quality |

### Analysis

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| — | Bounds analysis works well — correctly reports opaque pixel coverage | All | (positive) |
| — | Color analysis is useful — unique color count per frame is actionable | All | (positive) |
| — | Frame comparison is genuinely useful for animation QA — changed pixel count + percentage is exactly what you want | Knight Idle, Knight Walk | (positive) |
| wish | No per-layer bounds analysis — would help verify character part coverage | Knight Idle | quality |

### Export

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| — | Sprite sheet export works correctly — width = frameCount × canvasWidth | Knight Walk | (positive) |
| — | GIF export works for all animated assets | Knight Idle, Knight Walk, Spark Hit | (positive) |
| — | .glyph save/load round-trips cleanly with palette data preserved | All | (positive) |
| wish | No batch export — can't export all benchmark assets in one operation | All | speed |

### Drawing

| Severity | Issue | Assets Affected | Hurts |
|----------|-------|-----------------|-------|
| — | `storeDrawPixels` batch API is efficient — single call per region | All | (positive) |
| — | `storeDrawLine` works for outlines | Wooden Crate | (positive) |
| annoyance | No `storeFillRect` or `storeDrawRect` convenience — had to generate pixel arrays manually | All | speed |

## Summary

### What worked well
1. **Document creation** — `storeNewDocument` is clean and fast
2. **Pixel drawing** — batch pixel API is the right abstraction
3. **Analysis** — bounds, colors, and frame compare are all genuinely useful
4. **Validation** — catches real issues (empty frames, timing problems, oversized palettes)
5. **Export** — sprite sheet, GIF, and .glyph all work correctly
6. **Layer system** — add/rename/switch layers works for multi-part characters
7. **Palette groups** — useful for characters and environments, less so for FX

### What failed or felt weak
1. **Palette editing in headless** — major gap in the adapter (desktop-only operations)
2. **Batch frame setup** — no way to create N frames with uniform timing in one call
3. **Animation production workflow** — duplicate-and-modify is the natural workflow but requires careful frame index tracking
4. **Tileset validation** — completely missing; tilesets are a core sprite production type
5. **Single-frame noise** — validation info messages for static sprites feel like nagging

### Repeated pain (≥2 assets)
1. Palette setup requires direct state mutation (all 5 assets)
2. Frame duration loop (3 animated assets)
3. No rect convenience helpers (all 5 assets)

## Fix Selection (Stage 37 candidates)

### Do now (repeated blockers)
1. Add palette editing functions to headless store adapter (`storeAddPaletteColor`, `storeSetPaletteColorRole`, `storeCreateColorGroup`, `storeLockPaletteColor`)
2. Add `storeSetAllFrameDurations(durationMs)` batch helper
3. Add `storeFillRect` / `storeDrawRect` convenience functions

### Do next (real value)
4. Add tileset-specific validation rules (seamless edge check)
5. Add "unused palette color" validation rule
6. Suppress or downgrade single-frame info for static documents

### Can wait
7. Palette preset/template system
8. Batch export across documents
9. Per-layer bounds analysis
10. Palette remap tooling
