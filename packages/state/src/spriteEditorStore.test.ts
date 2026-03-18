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

/** Get the first layer ID for a frame (convenience for layer-keyed pixelBuffers). */
function layerId(frameIndex: number): string {
  const doc = useSpriteEditorStore.getState().document!;
  return doc.frames[frameIndex].layers[0].id;
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

    it('newDocument creates one frame with a pixel buffer keyed by layer ID', () => {
      openTestDoc();
      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      expect(doc!.frames).toHaveLength(1);
      expect(doc!.frames[0].layers).toHaveLength(1);
      const lid = doc!.frames[0].layers[0].id;
      expect(pixelBuffers[lid]).toBeDefined();
      expect(pixelBuffers[lid].data.length).toBe(16 * 16 * 4);
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
      expect(state.activeLayerId).toBeNull();
    });

    it('newDocument sets activeLayerId to first layer', () => {
      openTestDoc();
      const state = useSpriteEditorStore.getState();
      const firstLayer = state.document!.frames[0].layers[0];
      expect(state.activeLayerId).toBe(firstLayer.id);
    });

    it('each frame has a layers array with at least one layer', () => {
      openTestDoc();
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      expect(frame.layers).toHaveLength(1);
      expect(frame.layers[0].name).toBe('Layer 1');
      expect(frame.layers[0].visible).toBe(true);
    });
  });

  // ── Persistence ──

  describe('saveDocument', () => {
    it('calls writeFn with valid JSON and sets filePath', async () => {
      openTestDoc(4, 4);
      let writtenPath = '';
      let writtenContent = '';
      const writeFn = async (path: string, content: string) => {
        writtenPath = path;
        writtenContent = content;
      };

      const err = await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', writeFn);
      expect(err).toBeNull();
      expect(writtenPath).toBe('/tmp/test.glyph');

      const parsed = JSON.parse(writtenContent);
      expect(parsed.format).toBe('glyphstudio-sprite');
      expect(parsed.schemaVersion).toBe(1);
      expect(useSpriteEditorStore.getState().filePath).toBe('/tmp/test.glyph');
    });

    it('sets dirty to false after save', async () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);
      expect(useSpriteEditorStore.getState().dirty).toBe(true);

      const writeFn = async () => {};
      await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', writeFn);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
    });

    it('returns error when no document is open', async () => {
      const writeFn = async () => {};
      const err = await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', writeFn);
      expect(err).toContain('No document');
    });

    it('returns error if writeFn throws', async () => {
      openTestDoc(4, 4);
      const writeFn = async () => { throw new Error('disk full'); };
      const err = await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', writeFn);
      expect(err).toContain('disk full');
    });
  });

  describe('loadDocument', () => {
    it('loads a saved document and restores pixel data', async () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      // Save
      let saved = '';
      await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', async (_p, c) => { saved = c; });

      // Close and reload
      useSpriteEditorStore.getState().closeDocument();
      expect(useSpriteEditorStore.getState().document).toBeNull();

      const err = useSpriteEditorStore.getState().loadDocument(saved, '/tmp/test.glyph');
      expect(err).toBeNull();

      const state = useSpriteEditorStore.getState();
      expect(state.document).not.toBeNull();
      expect(state.document!.name).toBe('test');
      expect(state.filePath).toBe('/tmp/test.glyph');
      expect(state.dirty).toBe(false);
    });

    it('resets transient editor state on load', async () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().setZoom(16);
      useSpriteEditorStore.getState().setTool('eraser');

      let saved = '';
      await useSpriteEditorStore.getState().saveDocument('/tmp/test.glyph', async (_p, c) => { saved = c; });

      useSpriteEditorStore.getState().loadDocument(saved, '/tmp/test.glyph');
      const state = useSpriteEditorStore.getState();
      expect(state.zoom).toBe(8);
      expect(state.tool.activeTool).toBe('pencil');
      expect(state.isPlaying).toBe(false);
      expect(state.selectionRect).toBeNull();
    });

    it('returns error for invalid JSON', () => {
      const err = useSpriteEditorStore.getState().loadDocument('not json', '/tmp/bad.glyph');
      expect(err).toContain('Invalid JSON');
    });

    it('returns error for future schema version', () => {
      openTestDoc(4, 4);
      const json = JSON.stringify({
        format: 'glyphstudio-sprite',
        schemaVersion: 999,
        document: useSpriteEditorStore.getState().document,
        pixelBuffers: {},
      });
      const err = useSpriteEditorStore.getState().loadDocument(json, '/tmp/future.glyph');
      expect(err).toContain('999');
    });

    it('newDocument clears filePath', () => {
      openTestDoc(4, 4);
      // Manually set filePath to simulate a loaded file
      useSpriteEditorStore.setState({ filePath: '/tmp/old.glyph' });
      expect(useSpriteEditorStore.getState().filePath).toBe('/tmp/old.glyph');

      openTestDoc(8, 8);
      expect(useSpriteEditorStore.getState().filePath).toBeNull();
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

    it('addFrame creates a pixel buffer for the new frame layer', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      const lid = doc!.frames[1].layers[0].id;
      expect(pixelBuffers[lid]).toBeDefined();
    });

    it('addFrame sets active frame and activeLayerId to new frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
      const newLayerId = useSpriteEditorStore.getState().document!.frames[1].layers[0].id;
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(newLayerId);
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

    it('removeFrame removes all layer buffers for that frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      const { document: doc } = useSpriteEditorStore.getState();
      const firstFrameId = doc!.frames[0].id;
      const firstLayerId = doc!.frames[0].layers[0].id;
      useSpriteEditorStore.getState().removeFrame(firstFrameId);
      expect(useSpriteEditorStore.getState().pixelBuffers[firstLayerId]).toBeUndefined();
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

    it('setActiveFrame changes active frame and activeLayerId', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
      const frame0LayerId = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(frame0LayerId);
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
      const buf = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      setPixel(buf, 2, 2, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().duplicateFrame();

      const { document: doc, pixelBuffers } = useSpriteEditorStore.getState();
      expect(doc!.frames).toHaveLength(2);
      const dupLayerId = doc!.frames[1].layers[0].id;
      expect(samplePixel(pixelBuffers[dupLayerId], 2, 2)).toEqual([255, 0, 0, 255]);
    });

    it('cloned buffer is independent from source', () => {
      openTestDoc(4, 4);
      const buf = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      setPixel(buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().duplicateFrame();

      // Modify original frame's layer
      const origBuf = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      setPixel(origBuf, 0, 0, [0, 0, 255, 255]);

      // Duplicate should still have green
      const dupBuf = useSpriteEditorStore.getState().pixelBuffers[layerId(1)];
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

  // ── Layer management ──

  describe('layer management', () => {
    it('addLayer creates a new layer in the active frame', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      expect(frame.layers).toHaveLength(2);
      expect(frame.layers[1].name).toBe('Layer 2');
    });

    it('addLayer creates a pixel buffer for the new layer', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      const newLayerId = frame.layers[1].id;
      expect(useSpriteEditorStore.getState().pixelBuffers[newLayerId]).toBeDefined();
    });

    it('addLayer sets activeLayerId to new layer', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(frame.layers[1].id);
    });

    it('addLayer marks document dirty', () => {
      openTestDoc(4, 4);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      useSpriteEditorStore.getState().addLayer();
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('removeLayer removes a layer and its buffer', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      const removedId = frame.layers[0].id;
      useSpriteEditorStore.getState().removeLayer(removedId);

      const updated = useSpriteEditorStore.getState().document!.frames[0];
      expect(updated.layers).toHaveLength(1);
      expect(useSpriteEditorStore.getState().pixelBuffers[removedId]).toBeUndefined();
    });

    it('removeLayer prevents removing the last layer', () => {
      openTestDoc(4, 4);
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      useSpriteEditorStore.getState().removeLayer(frame.layers[0].id);
      // Should still have 1 layer
      expect(useSpriteEditorStore.getState().document!.frames[0].layers).toHaveLength(1);
    });

    it('removeLayer switches active layer when removing active', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const secondLayerId = useSpriteEditorStore.getState().document!.frames[0].layers[1].id;
      useSpriteEditorStore.getState().setActiveLayer(secondLayerId);
      useSpriteEditorStore.getState().removeLayer(secondLayerId);
      // Should fallback to the remaining layer
      const remaining = useSpriteEditorStore.getState().document!.frames[0].layers[0];
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(remaining.id);
    });

    it('setActiveLayer changes active layer', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      const firstLayerId = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      useSpriteEditorStore.getState().setActiveLayer(firstLayerId);
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(firstLayerId);
    });

    it('setActiveLayer rejects layer not in current frame', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().setActiveLayer('nonexistent');
      // Should remain on the default layer
      const firstLayerId = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      expect(useSpriteEditorStore.getState().activeLayerId).toBe(firstLayerId);
    });

    it('toggleLayerVisibility toggles visible flag', () => {
      openTestDoc(4, 4);
      const lid = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      expect(useSpriteEditorStore.getState().document!.frames[0].layers[0].visible).toBe(true);
      useSpriteEditorStore.getState().toggleLayerVisibility(lid);
      expect(useSpriteEditorStore.getState().document!.frames[0].layers[0].visible).toBe(false);
      useSpriteEditorStore.getState().toggleLayerVisibility(lid);
      expect(useSpriteEditorStore.getState().document!.frames[0].layers[0].visible).toBe(true);
    });

    it('renameLayer changes layer name', () => {
      openTestDoc(4, 4);
      const lid = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      useSpriteEditorStore.getState().renameLayer(lid, 'Background');
      expect(useSpriteEditorStore.getState().document!.frames[0].layers[0].name).toBe('Background');
    });

    it('renameLayer rejects empty names', () => {
      openTestDoc(4, 4);
      const lid = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      useSpriteEditorStore.getState().renameLayer(lid, '   ');
      expect(useSpriteEditorStore.getState().document!.frames[0].layers[0].name).toBe('Layer 1');
    });

    it('moveLayer reorders layers in the stack', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      useSpriteEditorStore.getState().addLayer();
      // 3 layers: Layer 1, Layer 2, Layer 3
      const frame = useSpriteEditorStore.getState().document!.frames[0];
      expect(frame.layers[0].name).toBe('Layer 1');
      expect(frame.layers[2].name).toBe('Layer 3');

      // Move Layer 1 to top
      useSpriteEditorStore.getState().moveLayer(0, 2);
      const updated = useSpriteEditorStore.getState().document!.frames[0];
      expect(updated.layers[2].name).toBe('Layer 1');
      expect(updated.layers[0].name).toBe('Layer 2');
    });

    it('moveLayer no-ops with invalid indices', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addLayer();
      useSpriteEditorStore.getState().moveLayer(-1, 0);
      useSpriteEditorStore.getState().moveLayer(0, 5);
      // No crash, layers unchanged
      expect(useSpriteEditorStore.getState().document!.frames[0].layers).toHaveLength(2);
    });

    it('addLayer is no-op without document', () => {
      useSpriteEditorStore.getState().addLayer();
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
    it('commitPixels updates active layer buffer', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      const RED: Rgba = [255, 0, 0, 255];
      setPixel(buf, 1, 1, RED);
      useSpriteEditorStore.getState().commitPixels(buf);

      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 1, 1)).toEqual(RED);
    });

    it('commitPixels marks document dirty', () => {
      openTestDoc(4, 4);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      const buf = createBlankPixelBuffer(4, 4);
      useSpriteEditorStore.getState().commitPixels(buf);
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('commitPixels only affects active layer', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addFrame();
      // Active is frame 1 (the new frame)

      // Write red to frame 0's layer buffer manually for reference
      const origBuf0 = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      setPixel(origBuf0, 0, 0, [255, 0, 0, 255]);

      // Commit green to active layer (frame 1's layer)
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      // Frame 1's layer should have green
      const stored1 = useSpriteEditorStore.getState().pixelBuffers[layerId(1)];
      expect(samplePixel(stored1, 0, 0)).toEqual([0, 255, 0, 255]);

      // Frame 0's layer should still have red (unchanged by commit)
      const stored0 = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
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

  // ── Move frame ──

  describe('moveFrame', () => {
    it('swaps two frames', () => {
      openTestDoc();
      const store = useSpriteEditorStore.getState();
      store.addFrame(); // now 2 frames, active = 1
      store.addFrame(); // now 3 frames, active = 2
      const doc = useSpriteEditorStore.getState().document!;
      const originalIds = doc.frames.map((f) => f.id);

      // Move frame 2 to position 0
      useSpriteEditorStore.getState().moveFrame(2, 0);
      const updated = useSpriteEditorStore.getState().document!;
      expect(updated.frames.map((f) => f.id)).toEqual([originalIds[2], originalIds[0], originalIds[1]]);
    });

    it('follows active frame when moved', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      // Active is frame 2
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(2);
      useSpriteEditorStore.getState().moveFrame(2, 0);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    });

    it('adjusts active index when non-active frame is moved before it', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(1); // active = 1
      // Move frame 2 to position 0 (before active)
      useSpriteEditorStore.getState().moveFrame(2, 0);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(2);
    });

    it('marks document dirty', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.setState({ dirty: false });
      useSpriteEditorStore.getState().moveFrame(0, 1);
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('re-indexes frames after move', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().moveFrame(2, 0);
      const doc = useSpriteEditorStore.getState().document!;
      doc.frames.forEach((f, i) => expect(f.index).toBe(i));
    });

    it('no-ops for same index', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.setState({ dirty: false });
      useSpriteEditorStore.getState().moveFrame(0, 0);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
    });

    it('no-ops for out-of-bounds', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.setState({ dirty: false });
      useSpriteEditorStore.getState().moveFrame(0, 5);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
    });

    it('no-ops without document', () => {
      useSpriteEditorStore.getState().moveFrame(0, 1);
      expect(useSpriteEditorStore.getState().document).toBeNull();
    });

    it('preserves pixel buffers after move', () => {
      openTestDoc(4, 4);
      const store = useSpriteEditorStore.getState();
      // Paint frame 0's layer
      const lid0 = layerId(0);
      const buf = store.pixelBuffers[lid0];
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      store.commitPixels(buf);

      store.addFrame(); // frame 1
      useSpriteEditorStore.getState().moveFrame(0, 1);

      // The layer buffer should still have the red pixel after frame move
      const movedBuf = useSpriteEditorStore.getState().pixelBuffers[lid0];
      expect(samplePixel(movedBuf, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  // ── Grid toggle ──

  describe('toggleGrid', () => {
    it('defaults to grid visible', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().showGrid).toBe(true);
    });

    it('toggles grid off and on', () => {
      openTestDoc();
      useSpriteEditorStore.getState().toggleGrid();
      expect(useSpriteEditorStore.getState().showGrid).toBe(false);
      useSpriteEditorStore.getState().toggleGrid();
      expect(useSpriteEditorStore.getState().showGrid).toBe(true);
    });
  });

  // ── Zoom in/out ──

  describe('zoomIn / zoomOut', () => {
    it('zoomIn increases zoom', () => {
      openTestDoc();
      const before = useSpriteEditorStore.getState().zoom;
      useSpriteEditorStore.getState().zoomIn();
      expect(useSpriteEditorStore.getState().zoom).toBeGreaterThan(before);
    });

    it('zoomOut decreases zoom', () => {
      openTestDoc();
      useSpriteEditorStore.getState().zoomIn(); // make sure we can zoom out
      const before = useSpriteEditorStore.getState().zoom;
      useSpriteEditorStore.getState().zoomOut();
      expect(useSpriteEditorStore.getState().zoom).toBeLessThan(before);
    });

    it('zoomIn caps at 64', () => {
      openTestDoc();
      useSpriteEditorStore.setState({ zoom: 64 });
      useSpriteEditorStore.getState().zoomIn();
      expect(useSpriteEditorStore.getState().zoom).toBe(64);
    });

    it('zoomOut floors at 1', () => {
      openTestDoc();
      useSpriteEditorStore.setState({ zoom: 1 });
      useSpriteEditorStore.getState().zoomOut();
      expect(useSpriteEditorStore.getState().zoom).toBe(1);
    });
  });

  // ── Preview / Animation ──

  describe('preview', () => {
    it('starts not playing, looping, at frame 0', () => {
      openTestDoc();
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.isLooping).toBe(true);
      expect(s.previewFrameIndex).toBe(0);
    });

    it('play sets isPlaying and syncs previewFrameIndex to activeFrameIndex', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(1);
      useSpriteEditorStore.getState().play();
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(true);
      expect(s.previewFrameIndex).toBe(1);
    });

    it('play is no-op with fewer than 2 frames', () => {
      openTestDoc();
      useSpriteEditorStore.getState().play();
      expect(useSpriteEditorStore.getState().isPlaying).toBe(false);
    });

    it('stop sets isPlaying false and syncs activeFrameIndex to previewFrameIndex', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview(); // now at frame 1
      useSpriteEditorStore.getState().stop();
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.activeFrameIndex).toBe(1);
    });

    it('togglePlay starts and stops', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().togglePlay();
      expect(useSpriteEditorStore.getState().isPlaying).toBe(true);
      useSpriteEditorStore.getState().togglePlay();
      expect(useSpriteEditorStore.getState().isPlaying).toBe(false);
    });

    it('toggleLoop flips loop state', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().isLooping).toBe(true);
      useSpriteEditorStore.getState().toggleLoop();
      expect(useSpriteEditorStore.getState().isLooping).toBe(false);
      useSpriteEditorStore.getState().toggleLoop();
      expect(useSpriteEditorStore.getState().isLooping).toBe(true);
    });

    it('advancePreview moves to next frame', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().play();
      const result = useSpriteEditorStore.getState().advancePreview();
      expect(result).toBe(true);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(1);
    });

    it('advancePreview loops when at end and looping', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview(); // frame 1
      const result = useSpriteEditorStore.getState().advancePreview(); // should loop to 0
      expect(result).toBe(true);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(0);
    });

    it('advancePreview stops when at end and not looping', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().toggleLoop(); // disable loop
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview(); // frame 1 (last)
      const result = useSpriteEditorStore.getState().advancePreview(); // end
      expect(result).toBe(false);
      expect(useSpriteEditorStore.getState().isPlaying).toBe(false);
    });

    it('stepPreviewForward advances activeFrameIndex (when stopped)', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().stepPreviewForward();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(1);
    });

    it('stepPreviewForward is no-op during playback', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().stepPreviewForward();
      // previewFrameIndex unchanged from play start (0)
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(0);
    });

    it('stepPreviewBackward decreases activeFrameIndex (when stopped)', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      // active = 1
      useSpriteEditorStore.getState().stepPreviewBackward();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(0);
    });

    it('stepPreviewBackward is no-op at frame 0', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().stepPreviewBackward();
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    });

    it('resetPreview stops and goes to frame 0', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview();
      useSpriteEditorStore.getState().advancePreview();
      useSpriteEditorStore.getState().resetPreview();
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.previewFrameIndex).toBe(0);
      expect(s.activeFrameIndex).toBe(0);
    });

    it('scrubPreview sets both indices (when stopped)', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().scrubPreview(2);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(2);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(2);
    });

    it('scrubPreview is no-op during playback', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().scrubPreview(2);
      expect(useSpriteEditorStore.getState().previewFrameIndex).toBe(0);
    });

    it('scrubPreview rejects out-of-bounds', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().scrubPreview(5);
      expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1); // unchanged from addFrame
    });

    it('newDocument resets preview state', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview();
      useSpriteEditorStore.getState().toggleLoop(); // set to false
      openTestDoc(); // re-open
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.isLooping).toBe(true);
      expect(s.previewFrameIndex).toBe(0);
    });

    it('closeDocument resets preview state', () => {
      openTestDoc();
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().toggleLoop();
      useSpriteEditorStore.getState().closeDocument();
      const s = useSpriteEditorStore.getState();
      expect(s.isPlaying).toBe(false);
      expect(s.isLooping).toBe(true);
      expect(s.previewFrameIndex).toBe(0);
    });

    it('advancePreview does not mutate pixel buffers', () => {
      openTestDoc(4, 4);
      const lid0 = layerId(0);
      const store = useSpriteEditorStore.getState();
      const buf = store.pixelBuffers[lid0];
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      store.commitPixels(buf);

      store.addFrame();
      useSpriteEditorStore.getState().play();
      useSpriteEditorStore.getState().advancePreview();
      useSpriteEditorStore.getState().advancePreview(); // loop back

      // Pixel data unchanged
      const afterBuf = useSpriteEditorStore.getState().pixelBuffers[lid0];
      expect(samplePixel(afterBuf, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  // ── Selection state ──

  describe('selection', () => {
    it('starts with no selection', () => {
      openTestDoc();
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });

    it('setSelection stores rect and buffer', () => {
      openTestDoc(8, 8);
      const rect = { x: 1, y: 1, width: 3, height: 3 };
      const buf = createBlankPixelBuffer(3, 3);
      useSpriteEditorStore.getState().setSelection(rect, buf);
      expect(useSpriteEditorStore.getState().selectionRect).toEqual(rect);
      expect(useSpriteEditorStore.getState().selectionBuffer).toBe(buf);
    });

    it('clearSelection removes rect and buffer', () => {
      openTestDoc(8, 8);
      const rect = { x: 0, y: 0, width: 2, height: 2 };
      const buf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection(rect, buf);
      useSpriteEditorStore.getState().clearSelection();
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });

    it('setActiveFrame clears selection', () => {
      openTestDoc(8, 8);
      useSpriteEditorStore.getState().addFrame();
      const rect = { x: 0, y: 0, width: 2, height: 2 };
      const buf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection(rect, buf);
      expect(useSpriteEditorStore.getState().selectionRect).not.toBeNull();
      useSpriteEditorStore.getState().setActiveFrame(0);
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });

    it('newDocument clears selection', () => {
      openTestDoc(8, 8);
      const rect = { x: 0, y: 0, width: 2, height: 2 };
      const buf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection(rect, buf);
      openTestDoc(4, 4);
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
    });

    it('closeDocument clears selection', () => {
      openTestDoc(8, 8);
      const rect = { x: 0, y: 0, width: 2, height: 2 };
      const buf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection(rect, buf);
      useSpriteEditorStore.getState().closeDocument();
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
    });
  });

  // ── Import/export ──

  describe('importSpriteSheet', () => {
    it('imports a horizontal strip into frames', () => {
      openTestDoc(2, 2);
      // 2 frames side by side: frame 0 has RED at (0,0), frame 1 has GREEN at (0,0)
      const sheetData = new Uint8ClampedArray(4 * 2 * 4);
      sheetData[0] = 255; sheetData[3] = 255; // RED at (0,0) in frame 0
      const i1 = (0 * 4 + 2) * 4;
      sheetData[i1 + 1] = 255; sheetData[i1 + 3] = 255; // GREEN at (0,0) in frame 1

      const err = useSpriteEditorStore.getState().importSpriteSheet(sheetData, 4, 2);
      expect(err).toBeNull();

      const state = useSpriteEditorStore.getState();
      expect(state.document!.frames).toHaveLength(2);
      expect(state.activeFrameIndex).toBe(0);

      const f0Buf = state.pixelBuffers[state.document!.frames[0].layers[0].id];
      expect(samplePixel(f0Buf, 0, 0)).toEqual([255, 0, 0, 255]);
      const f1Buf = state.pixelBuffers[state.document!.frames[1].layers[0].id];
      expect(samplePixel(f1Buf, 0, 0)).toEqual([0, 255, 0, 255]);
    });

    it('returns error for incompatible dimensions', () => {
      openTestDoc(16, 16);
      const sheetData = new Uint8ClampedArray(50 * 16 * 4);
      const err = useSpriteEditorStore.getState().importSpriteSheet(sheetData, 50, 16);
      expect(err).toContain('not divisible');
    });

    it('returns error without document', () => {
      const err = useSpriteEditorStore.getState().importSpriteSheet(new Uint8ClampedArray(0), 0, 0);
      expect(err).toBe('No document open');
    });

    it('clears selection on import', () => {
      openTestDoc(2, 2);
      useSpriteEditorStore.getState().setSelection(
        { x: 0, y: 0, width: 1, height: 1 },
        createBlankPixelBuffer(1, 1),
      );
      const sheetData = new Uint8ClampedArray(2 * 2 * 4);
      useSpriteEditorStore.getState().importSpriteSheet(sheetData, 2, 2);
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
    });

    it('marks document dirty after import', () => {
      openTestDoc(2, 2);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      const sheetData = new Uint8ClampedArray(4 * 2 * 4);
      useSpriteEditorStore.getState().importSpriteSheet(sheetData, 4, 2);
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('imported document remains editable', () => {
      openTestDoc(2, 2);
      const sheetData = new Uint8ClampedArray(4 * 2 * 4);
      useSpriteEditorStore.getState().importSpriteSheet(sheetData, 4, 2);
      // Add a frame — should work
      useSpriteEditorStore.getState().addFrame();
      expect(useSpriteEditorStore.getState().document!.frames).toHaveLength(3);
    });
  });

  describe('exportSpriteSheet', () => {
    it('exports frames as horizontal strip', () => {
      openTestDoc(2, 2);
      // Paint frame 0
      const f0Id = useSpriteEditorStore.getState().document!.frames[0].id;
      const f0Buf = createBlankPixelBuffer(2, 2);
      setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f0Buf);

      // Add and paint frame 1
      useSpriteEditorStore.getState().addFrame();
      const f1Id = useSpriteEditorStore.getState().document!.frames[1].id;
      const f1Buf = createBlankPixelBuffer(2, 2);
      setPixel(f1Buf, 1, 1, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f1Buf);

      const result = useSpriteEditorStore.getState().exportSpriteSheet();
      expect(typeof result).not.toBe('string');
      if (typeof result === 'string') return;

      expect(result.width).toBe(4);
      expect(result.height).toBe(2);
      expect(samplePixel(result, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(samplePixel(result, 3, 1)).toEqual([0, 255, 0, 255]);
    });

    it('returns error without document', () => {
      const result = useSpriteEditorStore.getState().exportSpriteSheet();
      expect(result).toBe('No document open');
    });

    it('export order matches frame strip order', () => {
      openTestDoc(2, 2);
      // Paint frame 0 RED
      const f0Buf = createBlankPixelBuffer(2, 2);
      setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f0Buf);

      // Add frame 1, paint BLUE
      useSpriteEditorStore.getState().addFrame();
      const f1Buf = createBlankPixelBuffer(2, 2);
      setPixel(f1Buf, 0, 0, [0, 0, 255, 255]);
      useSpriteEditorStore.getState().commitPixels(f1Buf);

      // Switch back to frame 0, add frame between → becomes new frame 1
      useSpriteEditorStore.getState().setActiveFrame(0);
      useSpriteEditorStore.getState().addFrame();
      const fMidBuf = createBlankPixelBuffer(2, 2);
      setPixel(fMidBuf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(fMidBuf);

      // Frames: RED, GREEN, BLUE
      const result = useSpriteEditorStore.getState().exportSpriteSheet();
      if (typeof result === 'string') { expect.unreachable(); return; }

      expect(result.width).toBe(6);
      expect(samplePixel(result, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(samplePixel(result, 2, 0)).toEqual([0, 255, 0, 255]);
      expect(samplePixel(result, 4, 0)).toEqual([0, 0, 255, 255]);
    });

    it('single frame exports as same-size buffer', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 2, 2, [128, 64, 32, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const result = useSpriteEditorStore.getState().exportSpriteSheet();
      if (typeof result === 'string') { expect.unreachable(); return; }

      expect(result.width).toBe(4);
      expect(result.height).toBe(4);
      expect(samplePixel(result, 2, 2)).toEqual([128, 64, 32, 255]);
    });
  });

  describe('exportCurrentFrame', () => {
    it('exports active frame pixels', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 1, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const exported = useSpriteEditorStore.getState().exportCurrentFrame();
      expect(exported).not.toBeNull();
      expect(samplePixel(exported!, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    it('returns independent copy', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const exported = useSpriteEditorStore.getState().exportCurrentFrame()!;
      setPixel(exported, 0, 0, [0, 255, 0, 255]);

      // Original layer buffer should be unchanged
      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('returns null without document', () => {
      expect(useSpriteEditorStore.getState().exportCurrentFrame()).toBeNull();
    });

    it('exports only active frame, not others', () => {
      openTestDoc(2, 2);
      const f0Buf = createBlankPixelBuffer(2, 2);
      setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f0Buf);

      useSpriteEditorStore.getState().addFrame();
      const f1Buf = createBlankPixelBuffer(2, 2);
      setPixel(f1Buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f1Buf);

      // Active is frame 1
      const exported = useSpriteEditorStore.getState().exportCurrentFrame()!;
      expect(samplePixel(exported, 0, 0)).toEqual([0, 255, 0, 255]);
    });

    it('export flattens multiple layers', () => {
      openTestDoc(4, 4);
      // Paint bottom layer red at (0,0)
      const buf0 = createBlankPixelBuffer(4, 4);
      setPixel(buf0, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf0);

      // Add top layer, paint green at (1,1)
      useSpriteEditorStore.getState().addLayer();
      const buf1 = createBlankPixelBuffer(4, 4);
      setPixel(buf1, 1, 1, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf1);

      const exported = useSpriteEditorStore.getState().exportCurrentFrame()!;
      // Both layers should be composited
      expect(samplePixel(exported, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(samplePixel(exported, 1, 1)).toEqual([0, 255, 0, 255]);
    });

    it('export skips hidden layers', () => {
      openTestDoc(4, 4);
      const buf0 = createBlankPixelBuffer(4, 4);
      setPixel(buf0, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf0);

      // Add visible top layer
      useSpriteEditorStore.getState().addLayer();
      const buf1 = createBlankPixelBuffer(4, 4);
      setPixel(buf1, 1, 1, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf1);

      // Hide bottom layer
      const bottomId = useSpriteEditorStore.getState().document!.frames[0].layers[0].id;
      useSpriteEditorStore.getState().toggleLayerVisibility(bottomId);

      const exported = useSpriteEditorStore.getState().exportCurrentFrame()!;
      // Bottom layer hidden — only green should be visible
      expect(samplePixel(exported, 0, 0)).toEqual([0, 0, 0, 0]);
      expect(samplePixel(exported, 1, 1)).toEqual([0, 255, 0, 255]);
    });
  });

  // ── Export with metadata ──

  describe('exportSheetWithMeta', () => {
    it('returns error when no document is open', () => {
      const result = useSpriteEditorStore.getState().exportSheetWithMeta();
      expect(typeof result).toBe('string');
    });

    it('returns sheet and meta for a single frame', () => {
      openTestDoc(8, 8);
      const result = useSpriteEditorStore.getState().exportSheetWithMeta();
      expect(typeof result).not.toBe('string');
      if (typeof result !== 'string') {
        expect(result.sheet.width).toBe(8);
        expect(result.sheet.height).toBe(8);
        expect(result.meta.format).toBe('glyphstudio-sprite-sheet');
        expect(result.meta.frameCount).toBe(1);
        expect(result.meta.frames[0].durationMs).toBe(100);
      }
    });

    it('returns sheet and meta for multiple frames', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
      const result = useSpriteEditorStore.getState().exportSheetWithMeta();
      expect(typeof result).not.toBe('string');
      if (typeof result !== 'string') {
        expect(result.sheet.width).toBe(12); // 4 * 3
        expect(result.meta.frameCount).toBe(3);
        expect(result.meta.frames).toHaveLength(3);
      }
    });
  });

  describe('exportGif', () => {
    it('returns error when no document is open', () => {
      const result = useSpriteEditorStore.getState().exportGif();
      expect(typeof result).toBe('string');
    });

    it('returns GIF bytes for a single frame', () => {
      openTestDoc(4, 4);
      // Paint a pixel so quantize has something to work with
      const lid = layerId(0);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const result = useSpriteEditorStore.getState().exportGif();
      expect(result).toBeInstanceOf(Uint8Array);
      const bytes = result as Uint8Array;
      expect(bytes[0]).toBe(0x47); // G
      expect(bytes[bytes.length - 1]).toBe(0x3b); // trailer
    });

    it('returns GIF bytes for multiple frames', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().addFrame();
      const result = useSpriteEditorStore.getState().exportGif();
      expect(result).toBeInstanceOf(Uint8Array);
    });

    it('uses authored durations from frames', () => {
      openTestDoc(4, 4);
      const doc = useSpriteEditorStore.getState().document!;
      useSpriteEditorStore.getState().setFrameDuration(doc.frames[0].id, 250);
      const result = useSpriteEditorStore.getState().exportGif();
      expect(result).toBeInstanceOf(Uint8Array);
    });
  });

  // ── Clipboard ──

  describe('copySelection', () => {
    it('copies selection buffer to clipboard', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(2, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 1, y: 1, width: 2, height: 2 }, selBuf);

      useSpriteEditorStore.getState().copySelection();
      const clip = useSpriteEditorStore.getState().clipboardBuffer;
      expect(clip).not.toBeNull();
      expect(samplePixel(clip!, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('does not mutate layer pixels', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 1, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const selBuf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().copySelection();

      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 1, 1)).toEqual([255, 0, 0, 255]);
    });

    it('clipboard is independent of selection buffer', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(2, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().copySelection();

      // Modify selection buffer
      setPixel(selBuf, 0, 0, [0, 255, 0, 255]);
      const clip = useSpriteEditorStore.getState().clipboardBuffer!;
      expect(samplePixel(clip, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('no-ops without selection', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().copySelection();
      expect(useSpriteEditorStore.getState().clipboardBuffer).toBeNull();
    });
  });

  describe('cutSelection', () => {
    it('copies to clipboard and clears selected area in active layer', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 1, 1, [255, 0, 0, 255]);
      setPixel(buf, 2, 2, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const selBuf = createBlankPixelBuffer(2, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      setPixel(selBuf, 1, 1, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 1, y: 1, width: 2, height: 2 }, selBuf);

      useSpriteEditorStore.getState().cutSelection();

      // Clipboard should have the selection
      const clip = useSpriteEditorStore.getState().clipboardBuffer!;
      expect(samplePixel(clip, 0, 0)).toEqual([255, 0, 0, 255]);

      // Layer pixels in selection area should be cleared
      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 1, 1)).toEqual([0, 0, 0, 0]);
      expect(samplePixel(stored, 2, 2)).toEqual([0, 0, 0, 0]);
    });

    it('clears selection state', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().cutSelection();
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });

    it('marks document dirty', () => {
      openTestDoc(4, 4);
      expect(useSpriteEditorStore.getState().dirty).toBe(false);
      const selBuf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().cutSelection();
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('does not affect other frames', () => {
      openTestDoc(4, 4);
      const f0Buf = createBlankPixelBuffer(4, 4);
      setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f0Buf);

      useSpriteEditorStore.getState().addFrame();
      const f1Buf = createBlankPixelBuffer(4, 4);
      setPixel(f1Buf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(f1Buf);

      // Cut from frame 1
      const selBuf = createBlankPixelBuffer(1, 1);
      setPixel(selBuf, 0, 0, [0, 255, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 1, height: 1 }, selBuf);
      useSpriteEditorStore.getState().cutSelection();

      // Frame 0's layer should be untouched
      const f0Stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(f0Stored, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  describe('pasteSelection', () => {
    it('creates selection from clipboard at (0,0)', () => {
      openTestDoc(8, 8);
      // Manually set clipboard
      const clip = createBlankPixelBuffer(2, 2);
      setPixel(clip, 0, 0, [255, 0, 0, 255]);
      const selBuf = createBlankPixelBuffer(2, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 3, y: 3, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().copySelection();

      // Clear selection, then paste
      useSpriteEditorStore.getState().clearSelection();
      useSpriteEditorStore.getState().pasteSelection();

      const rect = useSpriteEditorStore.getState().selectionRect;
      expect(rect).toEqual({ x: 0, y: 0, width: 2, height: 2 });
      const pasted = useSpriteEditorStore.getState().selectionBuffer!;
      expect(samplePixel(pasted, 0, 0)).toEqual([255, 0, 0, 255]);
    });

    it('paste is frame-local (does not auto-commit)', () => {
      openTestDoc(4, 4);
      const clip = createBlankPixelBuffer(2, 2);
      setPixel(clip, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, clip);
      useSpriteEditorStore.getState().copySelection();
      useSpriteEditorStore.getState().clearSelection();
      useSpriteEditorStore.getState().pasteSelection();

      // Layer pixels should be untouched
      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 0, 0)).toEqual([0, 0, 0, 0]);
    });

    it('no-ops without clipboard', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().pasteSelection();
      expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
    });

    it('pasted buffer is independent of clipboard', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(2, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().copySelection();
      useSpriteEditorStore.getState().clearSelection();
      useSpriteEditorStore.getState().pasteSelection();

      // Modify pasted selection buffer
      const pasted = useSpriteEditorStore.getState().selectionBuffer!;
      setPixel(pasted, 0, 0, [0, 0, 0, 0]);

      // Clipboard should be unaffected
      const clip = useSpriteEditorStore.getState().clipboardBuffer!;
      expect(samplePixel(clip, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  describe('flipSelectionHorizontal', () => {
    it('flips selection buffer horizontally', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(2, 1);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 1 }, selBuf);

      useSpriteEditorStore.getState().flipSelectionHorizontal();
      const flipped = useSpriteEditorStore.getState().selectionBuffer!;
      expect(samplePixel(flipped, 0, 0)).toEqual([0, 0, 0, 0]);
      expect(samplePixel(flipped, 1, 0)).toEqual([255, 0, 0, 255]);
    });

    it('no-ops without selection', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().flipSelectionHorizontal();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });

    it('does not mutate frame pixels', () => {
      openTestDoc(4, 4);
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().commitPixels(buf);

      const selBuf = createBlankPixelBuffer(2, 2);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 2, height: 2 }, selBuf);
      useSpriteEditorStore.getState().flipSelectionHorizontal();

      const stored = useSpriteEditorStore.getState().pixelBuffers[layerId(0)];
      expect(samplePixel(stored, 0, 0)).toEqual([255, 0, 0, 255]);
    });
  });

  describe('flipSelectionVertical', () => {
    it('flips selection buffer vertically', () => {
      openTestDoc(4, 4);
      const selBuf = createBlankPixelBuffer(1, 2);
      setPixel(selBuf, 0, 0, [255, 0, 0, 255]);
      useSpriteEditorStore.getState().setSelection({ x: 0, y: 0, width: 1, height: 2 }, selBuf);

      useSpriteEditorStore.getState().flipSelectionVertical();
      const flipped = useSpriteEditorStore.getState().selectionBuffer!;
      expect(samplePixel(flipped, 0, 0)).toEqual([0, 0, 0, 0]);
      expect(samplePixel(flipped, 0, 1)).toEqual([255, 0, 0, 255]);
    });

    it('no-ops without selection', () => {
      openTestDoc(4, 4);
      useSpriteEditorStore.getState().flipSelectionVertical();
      expect(useSpriteEditorStore.getState().selectionBuffer).toBeNull();
    });
  });

  // ── Palette sets ──

  describe('palette set CRUD', () => {
    it('createPaletteSet saves current palette colors as a named set', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Warm');
      expect(id).toBeTruthy();
      const doc = useSpriteEditorStore.getState().document!;
      expect(doc.paletteSets).toHaveLength(1);
      expect(doc.paletteSets![0].name).toBe('Warm');
      expect(doc.paletteSets![0].colors).toHaveLength(doc.palette.colors.length);
      expect(doc.paletteSets![0].id).toBe(id);
    });

    it('createPaletteSet deep-copies colors (not a reference)', () => {
      openTestDoc();
      useSpriteEditorStore.getState().createPaletteSet('Copy');
      const doc = useSpriteEditorStore.getState().document!;
      // Mutate original palette — set should not change
      doc.palette.colors[1].rgba = [99, 99, 99, 255];
      const setColor = doc.paletteSets![0].colors[1].rgba;
      expect(setColor).not.toEqual([99, 99, 99, 255]);
    });

    it('createPaletteSet returns null without a document', () => {
      const id = useSpriteEditorStore.getState().createPaletteSet('Fail');
      expect(id).toBeNull();
    });

    it('createPaletteSet marks document dirty', () => {
      openTestDoc();
      useSpriteEditorStore.getState().createPaletteSet('Dirty');
      expect(useSpriteEditorStore.getState().dirty).toBe(true);
    });

    it('renamePaletteSet changes the name', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Old')!;
      useSpriteEditorStore.getState().renamePaletteSet(id, 'New');
      const doc = useSpriteEditorStore.getState().document!;
      expect(doc.paletteSets![0].name).toBe('New');
    });

    it('duplicatePaletteSet creates a copy with suffix', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Base')!;
      const dupId = useSpriteEditorStore.getState().duplicatePaletteSet(id);
      expect(dupId).toBeTruthy();
      const doc = useSpriteEditorStore.getState().document!;
      expect(doc.paletteSets).toHaveLength(2);
      expect(doc.paletteSets![1].name).toBe('Base (Copy)');
      expect(doc.paletteSets![1].id).toBe(dupId);
      expect(doc.paletteSets![1].colors).toHaveLength(doc.paletteSets![0].colors.length);
    });

    it('duplicatePaletteSet returns null for non-existent id', () => {
      openTestDoc();
      const dupId = useSpriteEditorStore.getState().duplicatePaletteSet('bogus');
      expect(dupId).toBeNull();
    });

    it('deletePaletteSet removes the set', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Delete me')!;
      useSpriteEditorStore.getState().deletePaletteSet(id);
      const doc = useSpriteEditorStore.getState().document!;
      expect(doc.paletteSets).toHaveLength(0);
    });

    it('deletePaletteSet clears activePaletteSetId if it was the active one', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Active')!;
      useSpriteEditorStore.getState().setActivePaletteSet(id);
      expect(useSpriteEditorStore.getState().document!.activePaletteSetId).toBe(id);
      useSpriteEditorStore.getState().deletePaletteSet(id);
      expect(useSpriteEditorStore.getState().document!.activePaletteSetId).toBeNull();
    });

    it('setActivePaletteSet sets the active palette set', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Set')!;
      useSpriteEditorStore.getState().setActivePaletteSet(id);
      expect(useSpriteEditorStore.getState().document!.activePaletteSetId).toBe(id);
    });

    it('setActivePaletteSet accepts null to clear', () => {
      openTestDoc();
      const id = useSpriteEditorStore.getState().createPaletteSet('Set')!;
      useSpriteEditorStore.getState().setActivePaletteSet(id);
      useSpriteEditorStore.getState().setActivePaletteSet(null);
      expect(useSpriteEditorStore.getState().document!.activePaletteSetId).toBeNull();
    });

    it('setActivePaletteSet rejects unknown id', () => {
      openTestDoc();
      useSpriteEditorStore.getState().setActivePaletteSet('bogus');
      expect(useSpriteEditorStore.getState().document!.activePaletteSetId).toBeUndefined();
    });

    it('multiple palette sets coexist', () => {
      openTestDoc();
      useSpriteEditorStore.getState().createPaletteSet('A');
      useSpriteEditorStore.getState().createPaletteSet('B');
      useSpriteEditorStore.getState().createPaletteSet('C');
      const doc = useSpriteEditorStore.getState().document!;
      expect(doc.paletteSets).toHaveLength(3);
      expect(doc.paletteSets!.map((ps) => ps.name)).toEqual(['A', 'B', 'C']);
    });
  });
});
