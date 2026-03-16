/**
 * Dogfood Workflow 2 — Import an existing sprite sheet, analyze, clean up, re-export.
 *
 * Proves: sheet import, bounds analysis, color analysis, frame comparison,
 * canvas resize, frame management, re-export with metadata.
 *
 * Strategy: first creates a source sheet (2-frame, 8×8) via MCP tools,
 * then imports it into a fresh session for the cleanup pipeline. This avoids
 * needing a checked-in binary fixture for the initial version.
 */

import type { WorkflowDefinition, WorkflowContext } from './types.js';

// ── Source sprite data (simple 2-frame shape) ──
const RED: [number, number, number, number] = [255, 0, 0, 255];
const BLUE: [number, number, number, number] = [0, 0, 255, 255];
const GREEN: [number, number, number, number] = [0, 200, 0, 255];

function sourceFrame0Pixels() {
  // Red square in top-left quadrant
  const pixels: Array<{ x: number; y: number; rgba: number[] }> = [];
  for (let y = 1; y < 4; y++) {
    for (let x = 1; x < 4; x++) {
      pixels.push({ x, y, rgba: [...RED] });
    }
  }
  return pixels;
}

function sourceFrame1Pixels() {
  // Blue square shifted right and down
  const pixels: Array<{ x: number; y: number; rgba: number[] }> = [];
  for (let y = 3; y < 6; y++) {
    for (let x = 4; x < 7; x++) {
      pixels.push({ x, y, rgba: [...BLUE] });
    }
  }
  // Green accent pixel
  pixels.push({ x: 0, y: 0, rgba: [...GREEN] });
  return pixels;
}

export const cleanupSheetWorkflow: WorkflowDefinition = {
  name: 'cleanup-sheet',
  description: 'Import a sprite sheet, analyze it, clean up, and re-export',

  async run(ctx: WorkflowContext) {
    // ── Phase 1: Create the source sheet via MCP ──

    const srcSession = await ctx.callTool('sprite_session_new', {});
    const srcId = srcSession.sessionId as string;

    await ctx.callTool('sprite_document_new', {
      sessionId: srcId,
      name: 'Source',
      width: 8,
      height: 8,
    });

    // Draw frame 0
    await ctx.callTool('sprite_draw_pixels', {
      sessionId: srcId,
      pixels: sourceFrame0Pixels(),
    });

    // Add frame 1 and draw
    await ctx.callTool('sprite_frame_add', { sessionId: srcId });
    await ctx.callTool('sprite_draw_pixels', {
      sessionId: srcId,
      pixels: sourceFrame1Pixels(),
    });

    // Export source sheet as base64
    const srcSheet = await ctx.callTool('sprite_export_sheet_png', { sessionId: srcId });
    const sheetBase64 = srcSheet.pngBase64 as string;

    // Save the source sheet as a fixture artifact
    await ctx.saveArtifact('source_sheet.png', sheetBase64, 'image/png');

    await ctx.callTool('sprite_session_close', { sessionId: srcId });

    // ── Phase 2: Import into fresh session ──

    const session = await ctx.callTool('sprite_session_new', {});
    const sessionId = session.sessionId as string;

    await ctx.callTool('sprite_document_new', {
      sessionId,
      name: 'Cleanup',
      width: 8,
      height: 8,
    });

    await ctx.callTool('sprite_import_sheet', {
      sessionId,
      pngBase64: sheetBase64,
      frameWidth: 8,
      frameHeight: 8,
    });

    // Verify import
    const postImport = await ctx.callTool('sprite_document_summary', { sessionId });
    const importDoc = postImport.document as { frameCount: number };
    await ctx.saveJsonArtifact('post_import_summary.json', postImport);

    // ── Phase 3: Analyze ──

    // Bounds for each frame
    const bounds0 = await ctx.callTool('sprite_analyze_bounds', { sessionId, frameIndex: 0 });
    const bounds1 = await ctx.callTool('sprite_analyze_bounds', { sessionId, frameIndex: 1 });

    // Color analysis for frame 0
    const colors0 = await ctx.callTool('sprite_analyze_colors', { sessionId, frameIndex: 0 });

    // Compare frames
    const diff = await ctx.callTool('sprite_compare_frames', {
      sessionId,
      frameA: 0,
      frameB: 1,
    });

    // Save analysis report
    const analysisReport = {
      frame0Bounds: bounds0,
      frame1Bounds: bounds1,
      frame0Colors: colors0,
      frameDiff: diff,
    };
    await ctx.saveJsonArtifact('analysis_report.json', analysisReport);

    // ── Phase 4: Clean up — crop to content bounds ──

    // Find the tightest bounding box across both frames
    const b0 = bounds0 as Record<string, unknown>;
    const b1 = bounds1 as Record<string, unknown>;

    // Both frames have content — crop canvas to 7×7 (fit both frames' content)
    // Frame 0: (1,1)-(3,3), Frame 1: (0,0)-(6,5) → combined: (0,0)-(6,5)
    // Resize to 7×6 would clip perfectly, but let's just crop to 7×7 for simplicity
    if (!b0.empty && !b1.empty) {
      const maxX = Math.max(b0.maxX as number, b1.maxX as number);
      const maxY = Math.max(b0.maxY as number, b1.maxY as number);
      const cropW = maxX + 1;
      const cropH = maxY + 1;

      if (cropW < 8 || cropH < 8) {
        await ctx.callTool('sprite_resize_canvas', {
          sessionId,
          width: cropW,
          height: cropH,
        });
      }
    }

    // ── Phase 5: Re-export ──

    // Export cleaned frame PNGs
    for (let i = 0; i < importDoc.frameCount; i++) {
      const frame = await ctx.callTool('sprite_export_frame_png', {
        sessionId,
        frameIndex: i,
      });
      await ctx.saveArtifact(`cleaned_frame_${i}.png`, frame.pngBase64 as string, 'image/png');
    }

    // Export cleaned sheet
    const cleanedSheet = await ctx.callTool('sprite_export_sheet_png', { sessionId });
    await ctx.saveArtifact('cleaned_sheet.png', cleanedSheet.pngBase64 as string, 'image/png');

    // Export metadata
    const metadata = await ctx.callTool('sprite_export_metadata_json', { sessionId });
    await ctx.saveJsonArtifact('cleaned_metadata.json', metadata.metadata);

    // Save document
    const saved = await ctx.callTool('sprite_document_save', { sessionId });
    await ctx.saveJsonArtifact('cleaned_document.glyph', JSON.parse(saved.json as string));

    // Final summary
    const finalSummary = await ctx.callTool('sprite_document_summary', { sessionId });
    await ctx.saveJsonArtifact('final_summary.json', finalSummary);

    await ctx.callTool('sprite_session_close', { sessionId });
  },
};
