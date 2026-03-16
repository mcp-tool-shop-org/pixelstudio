# Reference Board — Hero Sprite Recovery

## Working Size

**32×32 pixels.** Enough room for readable head, torso, arms, legs, weapon/accessory.
Not so large that details become filler.

## Target Subject

**Front-facing armored guard/knight, idle stance.**

One-sentence read: "A soldier standing at rest, recognizable armor, clear silhouette."

## Style Target

- Chibi-proportional (head ~40% of height) — reads better at low res
- 1px outline on all exterior edges
- 2–3 value steps per material (not flat, not noisy)
- Top-left light source, consistent everywhere
- No sub-pixel detail or dithering on first pass

## Palette Budget

8–10 colors maximum:
- 1 outline (near-black)
- 3 armor ramp (dark / mid / light)
- 2 skin (base / shadow)
- 1–2 accent (gold, red, or blue for identity)
- 1 secondary material (leather, cloth, or weapon)

## Light Direction

Top-left (northwest). This means:
- Left edges and top surfaces get the light color
- Right edges and bottom surfaces get the shadow color
- Consistent across all parts — no random highlights

## Pose

Relaxed idle, slight asymmetry preferred:
- Weight slightly on one leg, or
- One arm slightly forward, or
- Head tilted faintly
- Avoid perfect bilateral symmetry (reads as robotic)

## What Makes Good 32×32 Sprites Work

These principles come from studying RPG sprites at this resolution:

### 1. Big head ratio
At 32×32, the head needs to be 8–10px tall (25–30% of height).
Realistic proportions collapse at this size — chibi reads better.

### 2. Silhouette trumps detail
If you can't tell what it is in solid black, adding color won't help.
The outline shape must carry the read alone.

### 3. Clusters over singles
Groups of 2–4 same-color pixels read as intentional form.
Single isolated pixels read as noise or dirt.

### 4. Value does the work, color adds flavor
A sprite that reads in grayscale will read in color.
A sprite that needs color to read is fragile.

### 5. Asymmetry = life
Even 1px of weight shift or arm offset makes a pose feel alive.
Perfect symmetry at this size reads as a chess piece or icon.

### 6. 2–3 values per material, not more
Dark + mid + light per surface is the sweet spot.
More values create noise. Fewer values create flatness.

### 7. Outline consistency
1px outline everywhere, or nowhere. Mixed outline widths (2px in one spot, 0px in another) break the read.

## View

Front-facing (not 3/4, not side). Simplest to evaluate during recovery.

## Success Image

The sprite is done when a person who hasn't seen the project can look at the 4x export and say "that's a knight/guard" without prompting.
