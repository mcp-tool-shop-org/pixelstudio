# GlyphStudio Showcase

Canonical showcase projects demonstrating GlyphStudio's core production workflows.

Each showcase is a valid interchange file that can be imported directly into GlyphStudio.

## Showcase Set

### 1. Crystal Gem — Still Sprite
**File:** `still-sprite.interchange.json`
**Proves:** Still-image creation, palette use, clean export

- 16×16 crystal gem with 7-color palette
- Outline, mid-tones, highlights, transparency
- Demonstrates: draw → palette → export workflow

### 2. Flickering Flame — Loop Animation
**File:** `loop-animation.interchange.json`
**Proves:** Animation workflows, frame-by-frame motion, timing

- 16×16 flame with 4 distinct frames at 120ms
- Each frame varies: flicker height, lean, shape
- Demonstrates: animate → timing → GIF/strip export workflow

### 3. Shield Variants — Variant Family
**File:** `variant-family.interchange.json`
**Proves:** Document variants, palette variants, bundle export

- 16×16 shield with base palette (11 colors)
- Fire variant: warm reds replace wood tones
- Ice variant: cool blues replace wood tones
- Demonstrates: base → variant fork → palette swap → family export

### 4. Game UI Kit — Asset Pack
**File:** `pack-project.interchange.json`
**Proves:** Reusable parts, packs, template/pack start flows

- 3 reusable UI parts: Star (8×8), Heart (6×6), Coin (5×5)
- 1 curated Warm UI palette set
- Demonstrates: pack → stamp → reuse → enrich workflow

## Generation

All showcase files are generated from pixel art defined in `generate.mjs`:

```bash
node showcase/generate.mjs
```

## Validation

Showcase files are validated by `packages/state/src/showcase.test.ts`:
- Interchange format compliance
- Pixel data dimension correctness
- RGBA value validity
- Template/pack parse success through real interchange system
- Cross-showcase consistency
