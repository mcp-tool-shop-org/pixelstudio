# Stage 43.1 — Templar Knight: Survival Audit

Asset: Templar Knight (humanoid)
Shapes: 25
Artboard: 500×500

## Reduction per profile

### 16×16
- Fill: 41.4%
- Survived: 17 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, shield, shield-rim
- Collapsed: 8 — helm-slit, helm-top, shield-cross-v, shield-cross-h, sword-blade, sword-guard, sword-hilt, belt

### 16×32
- Fill: 40.6%
- Survived: 22 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-h, sword-guard, belt
- Collapsed: 3 — shield-cross-v, sword-blade, sword-hilt

### 24×24
- Fill: 35.4%
- Survived: 24 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-v, shield-cross-h, sword-blade, sword-hilt, belt
- Collapsed: 1 — sword-guard

### 32×32
- Fill: 34.2%
- Survived: 25 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-v, shield-cross-h, sword-blade, sword-guard, sword-hilt, belt
- Collapsed: 0

### 32×48
- Fill: 34.5%
- Survived: 25 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-v, shield-cross-h, sword-blade, sword-guard, sword-hilt, belt
- Collapsed: 0

### 48×48
- Fill: 34.5%
- Survived: 25 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-v, shield-cross-h, sword-blade, sword-guard, sword-hilt, belt
- Collapsed: 0

### 64×64
- Fill: 33.9%
- Survived: 25 — cape, cape-highlight, leg-left, leg-right, boot-left, boot-right, tabard, cross-v, cross-h, pauldron-left, pauldron-right, arm-left, arm-right, helm, helm-visor, helm-slit, helm-top, shield, shield-rim, shield-cross-v, shield-cross-h, sword-blade, sword-guard, sword-hilt, belt
- Collapsed: 0

## Best size recommendation

**32×48** — best balance of readability and detail for humanoid character.
- Cross on tabard reads clearly
- Helm shape distinct from body
- Shield and sword recognizable
- Belt/visor details lost at smaller sizes but helm + tabard cross carry identity
- 48×48 also viable but wastes horizontal space for tall character

## Friction notes

1. **Polygon cape drape is adequate** — 4-point polygon gives a clean trapezoid silhouette that reads as cape/cloak. No curve pain here.
2. **Kite shield required 4 polygon points** — the pointed bottom works fine with polygon, no curve needed.
3. **Pauldrons are just rects** — boxy shoulder armor is natural for polygon-only.
4. **Helm flat-top is polygon-friendly** — great helm shape is inherently geometric.
5. **No curve pain for this asset class** — medieval knight with flat armor is ideal for polygon-only.
6. **Cross detail survives well at 32×48** — vertical + horizontal rects read as cross even at small sizes.
7. **Shield cross collapses below 24×24** — expected, detail tier.

## Polygon-only assessment

**No curve pain.** Medieval knight is a geometric design domain.
Polygon-only handles all shapes naturally — flat helm, boxy armor, straight cape drape, rectangular weapons.