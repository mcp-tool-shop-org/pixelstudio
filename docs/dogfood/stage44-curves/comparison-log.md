# Stage 44.1 — Curves Dogfood Comparison

## Wolf Tail
Polygon: 8 anchor points, manual S-curve approximation
Path: 4 anchor points + 3 quadratic curves
Point reduction: 8 → 4 (50%)
48×48: polygon=22px, path=31px
32×32: polygon=14px, path=15px
16×16: polygon=4px, path=4px

## Knight Cape
Polygon: 8 anchor points, straight edges pretending to drape
Path: 5 anchor points + 4 quadratic curves
Point reduction: 8 → 5 (37.5%)
48×48: polygon=551px, path=514px
32×32: polygon=247px, path=234px
16×16: polygon=69px, path=64px

## Lantern Flame
Polygon: 7 anchor points, manual teardrop approximation
Path: 4 anchor points + 4 quadratic curves
Point reduction: 7 → 4 (43%)
48×48: polygon=90px, path=104px
32×32: polygon=43px, path=49px
16×16: polygon=17px, path=17px

## Summary

| Shape | Polygon Points | Path Points + Curves | Point Reduction |
|-------|---------------|---------------------|-----------------|
| Wolf tail | 8 | 4 pts + 3 curves | 50% fewer |
| Knight cape | 8 | 5 pts + 4 curves | 37.5% fewer |
| Lantern flame | 7 | 4 pts + 4 curves | 43% fewer |

### Authoring assessment
- Curves produce smoother organic outlines at 500×500 design size
- Fewer points means faster editing — moving 1 control point adjusts the whole curve
- At pixel sizes (16-48), output is equivalent due to pixel grid quantization
- Curve authoring is materially easier for organic forms
