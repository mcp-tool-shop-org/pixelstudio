/**
 * Dogfood Workflow 1 — Create a 4-frame walk cycle from scratch.
 *
 * Proves: document creation, pixel drawing, frame duplication/editing,
 * frame durations, render, export (sheet + metadata + frame PNGs), save.
 *
 * The sprite is a simple 16×16 humanoid figure with 4 walk poses.
 * All pixel data is deterministic — same input always produces same output.
 */

import type { WorkflowDefinition, WorkflowContext } from './types.js';

// ── Pixel art data ──
// Each pose is an array of {x, y, rgba} entries.
// The figure is a simple stick-figure character:
//   - Head: 2×2 block at top center
//   - Body: 1px wide vertical line
//   - Arms: vary per frame for swing
//   - Legs: vary per frame for walk motion

const SKIN = [240, 200, 160, 255] as const;
const SHIRT = [60, 120, 200, 255] as const;
const PANTS = [40, 40, 80, 255] as const;
const SHOE = [80, 50, 30, 255] as const;
const HAIR = [60, 30, 10, 255] as const;
const EYE = [20, 20, 20, 255] as const;

type RGBA = readonly [number, number, number, number];
interface Pixel { x: number; y: number; rgba: RGBA }

function makeHead(cx: number, top: number): Pixel[] {
  return [
    // Hair
    { x: cx, y: top, rgba: HAIR }, { x: cx + 1, y: top, rgba: HAIR },
    // Face
    { x: cx, y: top + 1, rgba: SKIN }, { x: cx + 1, y: top + 1, rgba: SKIN },
    { x: cx, y: top + 2, rgba: SKIN }, { x: cx + 1, y: top + 2, rgba: SKIN },
    // Eyes
    { x: cx, y: top + 1, rgba: EYE },
  ];
}

function makeBody(cx: number, top: number): Pixel[] {
  return [
    { x: cx, y: top, rgba: SHIRT }, { x: cx + 1, y: top, rgba: SHIRT },
    { x: cx, y: top + 1, rgba: SHIRT }, { x: cx + 1, y: top + 1, rgba: SHIRT },
    { x: cx, y: top + 2, rgba: SHIRT }, { x: cx + 1, y: top + 2, rgba: SHIRT },
  ];
}

// Pose 0: standing / contact right
function pose0(): Pixel[] {
  const head = makeHead(7, 2);
  const body = makeBody(7, 5);
  return [
    ...head, ...body,
    // Arms down
    { x: 6, y: 5, rgba: SKIN }, { x: 9, y: 5, rgba: SKIN },
    { x: 6, y: 6, rgba: SKIN }, { x: 9, y: 6, rgba: SKIN },
    // Legs — right forward, left back
    { x: 7, y: 8, rgba: PANTS }, { x: 8, y: 8, rgba: PANTS },
    { x: 6, y: 9, rgba: PANTS }, { x: 9, y: 9, rgba: PANTS },
    { x: 5, y: 10, rgba: PANTS }, { x: 10, y: 10, rgba: PANTS },
    // Shoes
    { x: 5, y: 11, rgba: SHOE }, { x: 10, y: 11, rgba: SHOE },
  ];
}

// Pose 1: passing (legs together, arms swinging)
function pose1(): Pixel[] {
  const head = makeHead(7, 2);
  const body = makeBody(7, 5);
  return [
    ...head, ...body,
    // Left arm forward, right arm back
    { x: 6, y: 5, rgba: SKIN }, { x: 9, y: 6, rgba: SKIN },
    { x: 5, y: 5, rgba: SKIN }, { x: 10, y: 7, rgba: SKIN },
    // Legs together
    { x: 7, y: 8, rgba: PANTS }, { x: 8, y: 8, rgba: PANTS },
    { x: 7, y: 9, rgba: PANTS }, { x: 8, y: 9, rgba: PANTS },
    { x: 7, y: 10, rgba: PANTS }, { x: 8, y: 10, rgba: PANTS },
    // Shoes
    { x: 7, y: 11, rgba: SHOE }, { x: 8, y: 11, rgba: SHOE },
  ];
}

// Pose 2: contact left (mirror of pose 0)
function pose2(): Pixel[] {
  const head = makeHead(7, 2);
  const body = makeBody(7, 5);
  return [
    ...head, ...body,
    // Arms down
    { x: 6, y: 5, rgba: SKIN }, { x: 9, y: 5, rgba: SKIN },
    { x: 6, y: 6, rgba: SKIN }, { x: 9, y: 6, rgba: SKIN },
    // Legs — left forward, right back
    { x: 7, y: 8, rgba: PANTS }, { x: 8, y: 8, rgba: PANTS },
    { x: 9, y: 9, rgba: PANTS }, { x: 6, y: 9, rgba: PANTS },
    { x: 10, y: 10, rgba: PANTS }, { x: 5, y: 10, rgba: PANTS },
    // Shoes
    { x: 10, y: 11, rgba: SHOE }, { x: 5, y: 11, rgba: SHOE },
  ];
}

// Pose 3: passing (other direction)
function pose3(): Pixel[] {
  const head = makeHead(7, 2);
  const body = makeBody(7, 5);
  return [
    ...head, ...body,
    // Right arm forward, left arm back
    { x: 9, y: 5, rgba: SKIN }, { x: 6, y: 6, rgba: SKIN },
    { x: 10, y: 5, rgba: SKIN }, { x: 5, y: 7, rgba: SKIN },
    // Legs together
    { x: 7, y: 8, rgba: PANTS }, { x: 8, y: 8, rgba: PANTS },
    { x: 7, y: 9, rgba: PANTS }, { x: 8, y: 9, rgba: PANTS },
    { x: 7, y: 10, rgba: PANTS }, { x: 8, y: 10, rgba: PANTS },
    // Shoes
    { x: 7, y: 11, rgba: SHOE }, { x: 8, y: 11, rgba: SHOE },
  ];
}

const POSES = [pose0, pose1, pose2, pose3];
const FRAME_DURATION = 150; // ms per frame

export const walkCycleWorkflow: WorkflowDefinition = {
  name: 'walk-cycle',
  description: 'Create a 4-frame walk cycle sprite from scratch',

  async run(ctx: WorkflowContext) {
    // 1. Create session and document
    const session = await ctx.callTool('sprite_session_new', {});
    const sessionId = session.sessionId as string;

    await ctx.callTool('sprite_document_new', {
      sessionId,
      name: 'WalkCycle',
      width: 16,
      height: 16,
    });

    // 2. Draw first frame (pose 0)
    await ctx.callTool('sprite_draw_pixels', {
      sessionId,
      pixels: POSES[0]().map((p) => ({ x: p.x, y: p.y, rgba: [...p.rgba] })),
    });

    // Get frame ID for duration setting
    let summary = await ctx.callTool('sprite_document_summary', { sessionId });
    let doc = summary.document as { frames: Array<{ id: string }> };
    let frames = doc.frames;

    await ctx.callTool('sprite_frame_set_duration', {
      sessionId,
      frameId: frames[0].id,
      durationMs: FRAME_DURATION,
    });

    // 3. Create frames 1–3 by duplicating and editing
    for (let i = 1; i < 4; i++) {
      // Set active to previous frame, then duplicate
      await ctx.callTool('sprite_frame_set_active', { sessionId, index: i - 1 });
      await ctx.callTool('sprite_frame_duplicate', { sessionId });

      // Now active frame is the new duplicate at index i
      // Erase old pose pixels, then draw new pose
      const oldPixels = POSES[i - 1]();
      await ctx.callTool('sprite_erase_pixels', {
        sessionId,
        pixels: oldPixels.map((p) => ({ x: p.x, y: p.y })),
      });

      await ctx.callTool('sprite_draw_pixels', {
        sessionId,
        pixels: POSES[i]().map((p) => ({ x: p.x, y: p.y, rgba: [...p.rgba] })),
      });

      // Get updated frame IDs after duplicate
      summary = await ctx.callTool('sprite_document_summary', { sessionId });
      doc = summary.document as { frames: Array<{ id: string }> };
      frames = doc.frames;

      await ctx.callTool('sprite_frame_set_duration', {
        sessionId,
        frameId: frames[i].id,
        durationMs: FRAME_DURATION,
      });
    }

    // 4. Set playback to loop
    await ctx.callTool('sprite_playback_set_config', {
      sessionId,
      isLooping: true,
    });

    // 5. Export individual frame PNGs
    for (let i = 0; i < 4; i++) {
      const frame = await ctx.callTool('sprite_export_frame_png', {
        sessionId,
        frameIndex: i,
      });
      await ctx.saveArtifact(`frame_${i}.png`, frame.pngBase64 as string, 'image/png');
    }

    // 6. Export sprite sheet
    const sheet = await ctx.callTool('sprite_export_sheet_png', { sessionId });
    await ctx.saveArtifact('sheet.png', sheet.pngBase64 as string, 'image/png');

    // 7. Export metadata
    const metadata = await ctx.callTool('sprite_export_metadata_json', { sessionId });
    await ctx.saveJsonArtifact('metadata.json', metadata.metadata);

    // 8. Save document
    const saved = await ctx.callTool('sprite_document_save', { sessionId });
    await ctx.saveJsonArtifact('document.glyph', JSON.parse(saved.json as string));

    // 9. Get final summary for the manifest
    summary = await ctx.callTool('sprite_document_summary', { sessionId });
    await ctx.saveJsonArtifact('summary.json', summary);

    // 10. Close session
    await ctx.callTool('sprite_session_close', { sessionId });
  },
};
