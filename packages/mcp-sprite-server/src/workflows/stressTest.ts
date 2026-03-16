/**
 * Dogfood Workflow 3 — Transform and undo/redo stress test.
 *
 * Proves: mutation surface and history surface cooperate under pressure.
 * Exercises: duplicate frame/layer, batch draw, rotate, flip, move frame,
 * multi-step undo, multi-step redo, final export equals expected state.
 *
 * The workflow is fully deterministic — same operations always produce
 * the same final pixel state.
 */

import type { WorkflowDefinition, WorkflowContext } from './types.js';

export const stressTestWorkflow: WorkflowDefinition = {
  name: 'stress-test',
  description: 'Transform and undo/redo stress test — proves mutation/history cooperation',

  async run(ctx: WorkflowContext) {
    // 1. Create session and document
    const session = await ctx.callTool('sprite_session_new', {});
    const sessionId = session.sessionId as string;

    await ctx.callTool('sprite_document_new', {
      sessionId,
      name: 'StressTest',
      width: 8,
      height: 8,
    });

    // 2. Draw a recognizable pattern on frame 0
    await ctx.callTool('sprite_draw_pixels', {
      sessionId,
      pixels: [
        { x: 0, y: 0, rgba: [255, 0, 0, 255] },   // red top-left
        { x: 7, y: 0, rgba: [0, 255, 0, 255] },   // green top-right
        { x: 0, y: 7, rgba: [0, 0, 255, 255] },   // blue bottom-left
        { x: 7, y: 7, rgba: [255, 255, 0, 255] },  // yellow bottom-right
        { x: 3, y: 3, rgba: [255, 255, 255, 255] }, // white center
        { x: 4, y: 4, rgba: [128, 128, 128, 255] }, // gray center
      ],
    });

    // Capture initial history state
    const h0 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_0_after_draw.json', h0);

    // 3. Duplicate frame → now 2 frames
    await ctx.callTool('sprite_frame_duplicate', { sessionId });

    const h1 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_1_after_dup_frame.json', h1);

    // 4. Duplicate layer on frame 1
    await ctx.callTool('sprite_layer_duplicate', { sessionId });

    // 5. Batch draw on the new layer
    await ctx.callTool('sprite_batch_apply', {
      sessionId,
      operations: [
        { type: 'draw', pixels: [
          { x: 1, y: 1, rgba: [200, 100, 50, 255] },
          { x: 2, y: 2, rgba: [200, 100, 50, 255] },
          { x: 3, y: 1, rgba: [200, 100, 50, 255] },
        ]},
        { type: 'draw', pixels: [
          { x: 5, y: 5, rgba: [50, 100, 200, 255] },
          { x: 6, y: 6, rgba: [50, 100, 200, 255] },
        ]},
      ],
    });

    const h2 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_2_after_batch.json', h2);

    // 6. Rotate canvas 90° CW — swaps dimensions to 8×8 (square, so same)
    await ctx.callTool('sprite_rotate_canvas', { sessionId, angle: 90 });

    // 7. Flip canvas horizontally
    await ctx.callTool('sprite_flip_canvas', { sessionId, direction: 'horizontal' });

    const h3 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_3_after_transforms.json', h3);

    // 8. Move frame 1 to position 0
    await ctx.callTool('sprite_frame_move', {
      sessionId,
      fromIndex: 1,
      toIndex: 0,
    });

    // 9. Export "before undo" state
    const beforeUndo = await ctx.callTool('sprite_export_frame_png', {
      sessionId,
      frameIndex: 0,
    });
    await ctx.saveArtifact('before_undo_frame0.png', beforeUndo.pngBase64 as string, 'image/png');

    // 10. Undo 3 times (undo move, undo flip, undo rotate)
    await ctx.callTool('sprite_history_undo', { sessionId });
    await ctx.callTool('sprite_history_undo', { sessionId });
    await ctx.callTool('sprite_history_undo', { sessionId });

    const h4 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_4_after_3_undos.json', h4);

    // 11. Export "after undo" state
    const afterUndo = await ctx.callTool('sprite_export_frame_png', {
      sessionId,
      frameIndex: 0,
    });
    await ctx.saveArtifact('after_undo_frame0.png', afterUndo.pngBase64 as string, 'image/png');

    // 12. Redo all 3 (redo rotate, redo flip, redo move)
    await ctx.callTool('sprite_history_redo', { sessionId });
    await ctx.callTool('sprite_history_redo', { sessionId });
    await ctx.callTool('sprite_history_redo', { sessionId });

    const h5 = await ctx.callTool('sprite_history_get_summary', { sessionId });
    await ctx.saveJsonArtifact('history_5_after_3_redos.json', h5);

    // 13. Export "after redo" — should match "before undo"
    const afterRedo = await ctx.callTool('sprite_export_frame_png', {
      sessionId,
      frameIndex: 0,
    });
    await ctx.saveArtifact('after_redo_frame0.png', afterRedo.pngBase64 as string, 'image/png');

    // 14. Final sheet export
    const sheet = await ctx.callTool('sprite_export_sheet_png', { sessionId });
    await ctx.saveArtifact('final_sheet.png', sheet.pngBase64 as string, 'image/png');

    // 15. Export metadata and save document
    const metadata = await ctx.callTool('sprite_export_metadata_json', { sessionId });
    await ctx.saveJsonArtifact('final_metadata.json', metadata.metadata);

    const saved = await ctx.callTool('sprite_document_save', { sessionId });
    await ctx.saveJsonArtifact('final_document.glyph', JSON.parse(saved.json as string));

    await ctx.callTool('sprite_session_close', { sessionId });
  },
};
