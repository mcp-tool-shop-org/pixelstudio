# Stage 43.2 — Iron Lantern: Survival Audit

Asset: Iron Lantern (prop)
Shapes: 19
Artboard: 500×500

## Reduction per profile

### 16×16
- Fill: 29.7%
- Survived: 11 — glow, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, base, flame-outer, flame-mid, flame-core
- Collapsed: 8 — chain-left, chain-right, chain-top, glass-shine, frame-left, frame-right, frame-mid, base-bottom

### 16×32
- Fill: 27.9%
- Survived: 14 — glow, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, frame-mid, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 5 — chain-left, chain-right, glass-shine, frame-left, frame-right

### 24×24
- Fill: 28.0%
- Survived: 16 — glow, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, glass-shine, frame-left, frame-right, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 3 — chain-left, chain-right, frame-mid

### 32×32
- Fill: 25.8%
- Survived: 19 — glow, chain-left, chain-right, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, glass-shine, frame-left, frame-right, frame-mid, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 0

### 32×48
- Fill: 26.5%
- Survived: 19 — glow, chain-left, chain-right, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, glass-shine, frame-left, frame-right, frame-mid, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 0

### 48×48
- Fill: 25.1%
- Survived: 19 — glow, chain-left, chain-right, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, glass-shine, frame-left, frame-right, frame-mid, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 0

### 64×64
- Fill: 23.2%
- Survived: 19 — glow, chain-left, chain-right, chain-top, hook, cap, cap-knob, glass-body, glass-inner, glass-highlight, glass-shine, frame-left, frame-right, frame-mid, base, base-bottom, flame-outer, flame-mid, flame-core
- Collapsed: 0

## Best size recommendation

**32×32** — lantern is a compact prop that fills the square well.
- Flame reads as distinct warm mass against cool glass
- Glass body shape distinguishable from metal frame
- Cap and base give clear top/bottom structure
- 16×16 viable as inventory icon (flame + glass body still read)
- Chain/hook disappear at small sizes — acceptable for prop

## Friction notes

1. **Glass body polygon (8 points) works** — the bulging octagonal shape reads as rounded at pixel scale. At 500px it looks faceted, but at 32px it reads as a rounded rectangle. This is a case where pixel-grid quantization is actually helpful.
2. **Flame polygon (6-7 points) is adequate** — the teardrop shape has visible faceting at artboard scale but reads fine at sprite scale. The three-layer flame (outer/mid/core) creates a believable glow gradient.
3. **FIRST POLYGON FRICTION:** Editing the flame shape required careful point placement. A curve would have been faster to shape the teardrop. However, once placed, the polygon result at pixel scale is indistinguishable from what a curve would produce.
4. **Translucent glow/highlight works** — alpha compositing handles the translucent glass shine and glow halo correctly.
5. **Metal frame detail holds well** — the thin vertical bars and horizontal divider survive at 32×32.
6. **Glass highlight strip is a nice detail at 48+ but correctly marked droppable.**

## Polygon-only assessment

**Mild friction, acceptable result.** The flame teardrop shape took more effort to place as a polygon (7 points) than it would with a curve tool. But the final pixel output is equivalent — at 32×32, a 7-point polygon flame and a curved flame produce the same pixels.
**Verdict: polygon-only holds for props.** The pain is in the authoring, not the output.