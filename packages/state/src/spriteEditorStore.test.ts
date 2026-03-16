import { describe, it, expect, beforeEach } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { useSpriteEditorStore } from './spriteEditorStore';
import { setPixel, samplePixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openTestDoc(width = 16, height = 16) {
  useSpriteEditorStore.getState().newDocument('test', width, height);
}

describe('spriteEditorStore', () => {
  beforeEach(() => resetStore());

  // ── Document lifecycle ──

  describe('document lifecycle', () => {
    it('starts with no document', () => {
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });

    it('newDocument creates a document', () => {
      openTestDoc(32, 32);
      const { document: doc } = useSpriteEditorStore.getState();
      expect(doc).not.toBeNull();
      expect(doc!.name).toBe('test');
      expect(doc!.width).toBe(32);
      expect(doc!.height).toBe(32);
    });

    it('newDocument creates one frame with a pixel buffer', () => {
      openTestDoc();
      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      expect(doc!.frames).toHaveLength(1);
      const frameId = doc!.frames[0].id;
      expect(pixelBuffers[frameId]).toBeDefined();
      expect(pixelBuffers[frameId].data.length).toBe(16 * 16 * 4);
    });

    it('newDocument resets editor state', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setZoom(16);
      openTestDoc(8, 8);
      expect(useSpriteEditorStore.getState().zoom).toBe(8);
    });

    it('closeDocument clears everything', () => {
      openTestDoc();
      useSpriteEditorStore.getState().closeDocument();
      const state = useSpriteEditorStore.getState();
      expect(state.document).toBeNull();
      expect(Object.keys(state.pixelBuffers)).toHaveLength(0);
    });
  });

  // ── Frame management ──

  describe('frame management', () => {
    it('addFrame appends a new frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc } = useSpriteEditorStore.getState();
      expect(doc!.frames).toHaveLength(2);
      expect(doc!.frames[1].index).toBe(1);
    });

    it('addFrame creates a pixel buffer for the new frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      const newFrameId = doc!.frames[1].id;
      expect(pixelBuffers[newFrameId]).toBeDefined();
    });

    it('addFrame sets active frame to new frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
    });

    it('addFrame marks document dirty', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      useSpriteEditorStore.getState().addFrame();
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('addFrame is no-op without document', () => {
      useSpriteEditorStore.getState().addFrame();
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });

    it('removeFrame removes the specified frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc } = useSpriteEditorStore.getState();
      const firstFrameId = doc!.frames[0].id;
      useSpriteEditorStore.getState().removeFrame(firstFrameId);
      const updated = useSpriteEditorStore.getState().document!;
      expect(updated.frames).toHaveLength(1);
      expect(updated.frames[0].id).not.toBe(firstFrameId);
    });

    it('removeFrame removes the pixel buffer', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc } = useSpriteEditorStore.getState();
      const firstFrameId = doc!.frames[0].id;
      useSpriteEditorStore.getState().removeFrame(firstFrameId);
      expect(useSpriteEditorStore.getState().pixelBuffers[firstFrameId]).toBeUndefined();
    });

    it('removeFrame re-indexes remaining frames', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc } = useSpriteEditorStore.getState();
      const middleId = doc!.frames[1].id;
      useSpriteEditorStore.getState().removeFrame(middleId);
      const frames = useSpriteEditorStore.getState().document!.frames;
      expect(frames.map((f) => f.index)).toEqual([0, 1]);
    });

    it('removeFrame refuses to remove the last frame', () => {
      openTestDoc();
      const { document: doc } = useSpriteEditorStore.getState();
      useSpriteEditorStore.getState().removeFrame(doc!.frames[0].id);
      expect(useSpriteEditorStore.getState().document!.frames).toHaveLength(1);
    });

    it('removeFrame clamps active frame index', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(1);
      const { document: doc } = useSpriteEditorStore.getState();
      useSpriteEditorStore.getState().removeFrame(doc!.frames[1].id);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    });

    it('setActiveFrame changes active frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    });

    it('setActiveFrame rejects out-of-bounds', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setActiveFrame(5);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    });

    it('setFrameDuration updates frame duration', () => {
      openTestDoc();
      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      useSpriteEditorStore.getState().setFrameDuration(frameId, 250);
      expect(useSpriteEditorStore.getState().document!.frames[0].durationMs).toBe(250);
    });

    it('setFrameDuration rejects non-positive duration', () => {
      openTestDoc();
      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      useSpriteEditorStore.getState().setFrameDuration(frameId, 0);
      expect(useSpriteEditorStore.getState().document!.frames[0].durationMs).toBe(100);
    });

    it('addFrame inserts after current frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame(); // frame 1
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().addFrame(); // should insert at index 1, pushing old frame 1 to index 2
      const frames = useSpriteEditorStore.getState().document!.frames;
      expect(frames).toHaveLength(3);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
    });
  });

  // ── Duplicate frame ──

  describe('duplicateFrame', () => {
    it('clones exact pixel data', () => {
      openTestDoc(4, 4);
      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      const buf = useSpriteEditorStore.getState().pixelBuffers[frameId];
      setPixel(buf, 2, 2, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().duplicateFrame();

      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      expect(doc!.frames).toHaveLength(2);
      const dupId = doc!.frames[1].id;
      expect(samplePixel(pixelBuffers[dupId], 2, 2)).toEqual([255, 0, 0, 255]);
    });

    it('cloned buffer is independent from source', () => {
      openTestDoc(4, 4);
      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      const buf = useSpriteEditorStore.getState().pixelBuffers[frameId];
      setPixel(buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().duplicateFrame();

      // Modify original frame
      const origBuf = useSpriteEditorStore.getState().pixelBuffers[
        useSpriteEditorStore.getState().document!.frames[0].id
      ];
      setPixel(origBuf, 0, 0, [0, 0, 255, 255]);

      // Duplicate should still have green
      const dupBuf = useSpriteEditorStore.getState().pixelBuffers[
        useSpriteEditorStore.getState().document!.frames[1].id
      ];
      expect(samplePixel(dupBuf, 0, 0)).toEqual([0, 255, 0, 255]);
    });

    it('clones frame duration', () => {
      openTestDoc();
      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      useSpriteEditorStore.getState().setFrameDuration(frameId, 250);
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().duplicateFrame();
      const dup = useSpriteEditorStore.getState().document!.frames[1];
      expect(dup.durationMs).toBe(250);
    });

    it('inserts after current frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      // 3 frames, active = 2
      useSpriteEditorStore.getState().setActiveFrame(1);
      useSpriteEditorStore.getState().duplicateFrame();
      // Should be 4 frames, duplicate at index 2
      expect(useSpriteEditorStore.getState().document!.frames).toHaveLength(4);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(2);
    });

    it('selects duplicated frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().duplicateFrame();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
    });

    it('marks document dirty', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      useSpriteEditorStore.getState().duplicateFrame();
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('is no-op without document', () => {
      useSpriteEditorStore.getState().duplicateFrame();
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });
  });

  // ── Tool ──

  describe('tool management', () => {
    it('starts with pencil', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().tool.activeTool).toBe('pencil');
    });

    it('setTool changes the active tool', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setTool('eraser');
      expect(useSpriteEditorStore.getState().tool.activeTool).toBe('eraser');
    });

    it('setBrushSize changes the brush size', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setBrushSize(4);
      expect(useSpriteEditorStore.getState().tool.brushSize).toBe(4);
    });

    it('setBrushSize rejects size < 1', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setBrushSize(0);
      expect(useSpriteEditorStore.getState().tool.brushSize).toBe(1);
    });

    it('setBrushShape changes the brush shape', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setBrushShape('circle');
      expect(useSpriteEditorStore.getState().tool.brushShape).toBe('circle');
    });

    it('setPixelPerfect toggles pixel perfect mode', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setPixelPerfect(true);
      expect(useSpriteEditorStore.getState().tool.pixelPerfect).toBe(true);
    });
  });

  // ── Palette ──

  describe('palette management', () => {
    it('setForegroundColor changes foreground index', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setForegroundColor(3);
      expect(useSpriteEditorStore.getState().document!.palette.foregroundIndex).toBe(3);
    });

    it('setForegroundColor rejects out-of-bounds', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setForegroundColor(999);
      expect(useSpriteEditorStore.getState().document!.palette.foregroundIndex).toBe(1);
    });

    it('setBackgroundColor changes background index', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setBackgroundColor(2);
      expect(useSpriteEditorStore.getState().document!.palette.backgroundIndex).toBe(2);
    });

    it('swapColors swaps foreground and background', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setForegroundColor(5);
      useSpriteEditorStore.getState().setBackgroundColor(3);
      useSpriteEditorStore.getState().swapColors();
      const palette = useSpriteEditorStore.getState().document!.palette;
      expect(palette.foregroundIndex).toBe(3);
      expect(palette.backgroundIndex).toBe(5);
    });
  });

  // ── Onion skin ──

  describe('onion skin', () => {
    it('starts disabled', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().onionSkin.enabled).toBe(false);
    });

    it('setOnionSkin updates partial config', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setOnionSkin({ enabled: true, framesBefore: 3 });
      const os = useSpriteEditorStore.getState().onionSkin;
      expect(os.enabled).toBe(true);
      expect(os.framesBefore).toBe(3);
      expect(os.framesAfter).toBe(1); // unchanged
    });
  });

  // ── Viewport ──

  describe('viewport', () => {
    it('setZoom changes zoom', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setZoom(16);
      expect(useSpriteEditorStore.getState().zoom).toBe(16);
    });

    it('setZoom rejects < 1', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setZoom(0);
      expect(useSpriteEditorStore.getState().zoom).toBe(8);
    });

    it('setZoom rejects > 64', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setZoom(100);
      expect(useSpriteEditorStore.getState().zoom).toBe(8);
    });

    it('setPan changes pan offset', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setPan(50, -30);
      expect(useSpriteEditorStore.getState().panX).toBe(50);
      expect(useSpriteEditorStore.getState().panY).toBe(-30);
    });
  });

  // ── Pixel editing ──

  describe('pixel editing', () => {
    it('commitPixels updates active frame buffer', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      const RED: Rgba = [255, 0, 0, 255];
      setPixel(buf, 1, 1, RED);
      useSpriteEditorStore.getState().commitPixels(buf);

      const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
      const stored = useSpriteEditorStore.getState().pixelBuffers[frameId];
      expect(samplePixel(stored, 1, 1)).toEqual(RED);
    });

    it('commitPixels marks document dirty', () => {
      openTestDoc(4, 4);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      const buf = createBlankPixelBuffer(4, 4);
      useSpriteEditorStore.getState().commitPixels(buf);
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('commitPixels only affects active frame', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addFrame();
      // Active is frame 1 (the new frame)
      const frame0Id = useSpriteEditorStore.getState().document!.frames[0].id;
      const frame1Id = useSpriteEditorStore.getState().document!.frames[1].id;

      // Write red to frame 0's buffer manually for reference
      const origBuf0 = useSpriteEditorStore.getState().pixelBuffers[frame0Id];
      setPixel(origBuf0, 0, 0, [255, 0, 0, 255]);

      // Commit green to active frame (frame 1)
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      // Frame 1 should have green
      const stored1 = useSpriteEditorStore.getState().pixelBuffers[frame1Id];
      expect(samplePixel(stored1, 0, 0)).toEqual([0, 255, 0, 255]);

      // Frame 0 should still have red (unchanged by commit)
      const stored0 = useSpriteEditorStore.getState().pixelBuffers[frame0Id];
      expect(samplePixel(stored0, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('commitPixels is no-op without document', () => {
      const buf = createBlankPixelBuffer(4, 4);
      useSpriteEditorStore.getState().commitPixels(buf);
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });
  });

  // ── Eyedropper color ──

  describe('setForegroundColorByRgba', () => {
    it('selects existing palette color by match', () => {
      openTestDoc();
      // Black is index 1 in default palette
      useSpriteEditorStore.getState().setForegroundColorByRgba([0, 0, 0, 255]);
      expect(useSpriteEditorStore.getState().document!.palette.foregroundIndex).toBe(1);
    });

    it('adds new color to palette when no match exists', () => {
      openTestDoc();
      const initialCount = useSpriteEditorStore.getState().document!.palette.colors.length;
      useSpriteEditorStore.getState().setForegroundColorByRgba([42, 42, 42, 255]);
      const palette = useSpriteEditorStore.getState().document!.palette;
      expect(palette.colors.length).toBe(initialCount + 1);
      expect(palette.foregroundIndex).toBe(palette.colors.length - 1);
      expect(palette.colors[palette.foregroundIndex].rgba).toEqual([42, 42, 42, 255]);
    });

    it('is no-op without document', () => {
      useSpriteEditorStore.getState().setForegroundColorByRgba([0, 0, 0, 255]);
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });
  });
});
