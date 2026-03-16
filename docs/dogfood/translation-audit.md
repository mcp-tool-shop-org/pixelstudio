# Stage 40.4 — Translation Audit

## Summary
Two concept→sprite translations from Stage 39.5 designs:
- Ranger/scout: 500×500 → 48×48 (10.4× reduction)
- Treasure chest: 500×500 → 32×32 (15.6× reduction) + 48×48 variant

Both followed the translation discipline: **rebuild at target resolution, do not downscale.**

## Silhouette survival

### Character (48×48)
| Feature | Concept (500px) | Sprite (48px) | Survived? |
|---------|-----------------|---------------|-----------|
| Peaked hood | 40px tall triangle + ellipse | 4px peak + 6px ellipse | ✅ Yes |
| Asymmetric pose | Weight right, hand on hip | Right leg 1px lower, arm pixels | ✅ Subtle |
| Cloak wider than body | 140px drape | 2px extension each side | ✅ Yes |
| Bow on back | Full arc + string | 5px diagonal line | ✅ Reduced |
| Quiver + arrows | 16×72 + 4 arrowheads | 2×7 block + 2 bright pixels | ✅ Simplified |
| Face features | Eyes, nose, mouth, iris | 2 dark pixels | ❌ Dropped |
| Belt buckle | 14×16 metallic rect | 1px hint | ⚠️ Barely |
| Boot detail | Highlights, 3 color zones | 2 color blocks | ⚠️ Minimal |
| Quiver strap | Diagonal leather line | — | ❌ Dropped |
| Hood interior shadow | Ellipse gradient | 3px dark zone | ✅ Compressed |

**Verdict:** The silhouette reads as "cloaked figure with gear." The core 5 read cues survive.

### Prop (32×32)
| Feature | Concept (500px) | Sprite (32px) | Survived? |
|---------|-----------------|---------------|-----------|
| Open lid shape | 85px tall trapezoid | 9px tall rect | ✅ Exaggerated |
| Glow from interior | 3 concentric ellipses + alpha | 8 bright pixels | ✅ Simplified |
| Metal bands | 3 bands + highlights + rivets | 2 × 1px lines | ✅ Reduced |
| Red gem | 20px with facets + setting | 3px red cluster | ✅ Simplified |
| Wood 3D form | Planks, grain, left/right shading | 3 color zones | ✅ Compressed |
| Rivets | 6 individual rivets with specular | — | ❌ Dropped |
| Keyhole | Circle + rectangle detail | — | ❌ Dropped |
| Gold trim | Full decorative border | 1px line + 3 dots | ⚠️ Barely |
| Ornate feet | 4 shaped metal feet | 2 × 2px bumps | ⚠️ Minimal |
| Interior lining texture | Velvet folds, light/dark zones | 2px color strip | ❌ Mostly dropped |
| Ground shadow | Soft ellipse | — | ❌ Dropped |

**Verdict:** The silhouette reads as "open chest with treasure." The L-shaped profile is distinctive. Glow sells it.

### Prop (48×48 variant)
At 48×48, the chest gains:
- Room for 3 glow rows vs 2
- 3×3 gem vs 3px cluster
- Metal band highlight dots spread out
- Interior lining visible as 3px strip

48×48 is the sweet spot for this prop. The 32×32 version works but 48×48 *breathes*.

## What survived, universally
1. **Strong silhouettes survive aggressive scale reduction.** The peaked hood and open-lid shapes read at any game resolution.
2. **1-pixel color accents carry disproportionate weight.** A single metallic pixel reads as "buckle." A single red pixel reads as "gem."
3. **2–3 color values per material is enough.** Dark/mid/light wood works at 32px just like dark/mid/light/highlight at 500px.
4. **Outline pass is critical at small sizes.** Without the 1px dark outline, the sprite blends into any background.

## What dies, universally
1. **Facial features below ~64px.** At 48×48, faces are 2 dot eyes and nothing else.
2. **Secondary texture detail.** Wood grain, leather stitching, velvet folds — all gone.
3. **Smooth gradients.** Glow and shadow become solid blocks. The softness is the first casualty.
4. **Ornamental detail.** Rivets, filigree, engraving — invisible below 64px.

## What needed exaggeration
1. **Character hood:** +1px each side beyond proportional width. Without it, reads as "person" not "hooded person."
2. **Prop lid height:** 8px vs proportional 5px. The "open" read requires vertical dominance.
3. **Equipment bumps:** Quiver relatively larger at 48px than at 500px, so "has gear" reads.
4. **Glow brightness:** Full-opacity bright pixels at 32px vs soft alpha at 500px. Subtlety dies at small scale.
5. **Gem size:** 3px at 32 ≈ 47px equivalent at 500. Relatively 2× larger. Required for focal point.

## Translation workspace tools assessment

### translationStore
- Session tracking with concept→target relationship works
- Cue tracking (survived/dropped/exaggerated) captures the right categories
- Translation notes field useful for per-decision rationale
- **Verdict: working as designed**

### translationComparison utilities
- `nearestNeighborDownscale` — useful for reference, confirms naïve shrink looks terrible
- `analyzeSilhouetteSurvival` — coverage % quantifies silhouette retention
- `pixelPerfectUpscale` — essential for side-by-side comparison at matching sizes
- `generateComparisonLayout` — 4-panel layout (concept, sprite upscaled, both silhouettes) tells the story
- `computeComparisonScale` — integer scale avoids sub-pixel artifacts
- **Verdict: solid utility set, all used in translation scripts**

## Process verdict

The concept→sprite translation workflow is validated:
```
1. Identify 3–5 strongest read cues from concept
2. Rebuild each cue at target resolution
3. Accept detail loss — don't fight it
4. Exaggerate where the read demands it
5. Verify: does the silhouette still tell the story?
6. Compare side-by-side with concept for emotional fidelity
```

The key insight: **translation is editorial, not mechanical.** The artist decides what matters at each scale. A downscaler can't make that judgment. This is why the workflow is valuable — it forces the decision.

## What the next phase needs
- Animation workflow: can a 48×48 sprite be animated in GlyphStudio's timeline?
- Palette optimization: the translated sprites use concept palettes. Game sprites may need indexed color.
- Batch translation: once the workflow is proven, can it handle an asset queue?
- Tile/prop sheets: game engines want sprite sheets, not individual PNGs.
