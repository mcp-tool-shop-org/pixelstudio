# Stage 40.3 — Prop Translation Log
## Source: 500×500 treasure chest concept (Stage 39.5.2)
## Target: 32×32 game-facing sprite (+ 48×48 variant)
## Target read: "Valuable, ancient, slightly dangerous"

### Translation decisions
- Lid: exaggerated height (8px vs proportional 5px) for open-chest read
- Interior lining: 2px strip of warm red below lid (was full interior in concept)
- Glow: 8 pixels (was 3 concentric ellipses in concept). Still reads as "light inside"
- Metal bands: 2 × 1px lines with highlight dots (rivets dropped entirely)
- Gem: 3px cluster (was 20px diameter with facets). Red still pops against brown.
- Gold trim: 1px line with 3 bright dots (was full decorative border)
- Feet: 2 × 2px bumps (4 ornate feet dropped to 2 pairs)

### What survived at 32×32
- **Open lid shape** — the "taller than body" lid reads as open chest
- **Glow in opening** — 8 bright pixels still signal "treasure inside"
- **Metal accent lines** — 2 × 1px bands read as "reinforced/ancient"
- **Red gem focal point** — 3px red against brown pops immediately
- **Wood color zones** — left shadow / right highlight gives 3D form
- **Boxy proportions** — wider than tall, correct "chest" read

### What was dropped
- All 6 rivets (too small to render)
- Keyhole detail
- Wood plank lines (individual planks)
- Gem facets and gold gem setting
- Interior velvet texture
- Ground shadow
- Lid wood grain
- Metal band specular highlights (merged into single pixel hints)
- Ornate foot detail (4 → 2 pairs of plain bumps)

### What needed exaggeration
- Lid height: 8px vs proportional ~5px, because the "open" read requires vertical space
- Glow brightness: full-opacity bright pixels vs soft alpha in concept
- Gem size: relatively larger at 32px than at 500px (3px at 32 ≈ 47px equivalent)

### 48×48 variant notes
- At 48×48, there's room for 3 metal band highlight dots, more glow spread, and a 3×3 gem
- The extra 16px of height makes the lid interior lining more visible
- 48×48 is the sweet spot for this prop — 32×32 works but 48×48 breathes

### Silhouette survival verdict
The silhouette reads as "open chest" at 32×32.
The L-shaped profile (body + lid) is distinctive. The glow adds "treasure" even in silhouette.
At 48×48, the interior detail adds "ancient/ornate" which is mostly lost at 32×32.

Scale factor: 500÷32 ≈ 15.6×
