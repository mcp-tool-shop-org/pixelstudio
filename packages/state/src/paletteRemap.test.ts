import { describe, it, expect } from 'vitest';
import { createBlankPixelBuffer, createSpriteFrame } from '@glyphstudio/domain';
import type { SpriteColor, SpriteFrame } from '@glyphstudio/domain';
import { setPixel, samplePixel, type Rgba } from './spriteRaster';
import { buildColorMap, remapPixelBuffer, remapFrameBuffers, rgbaKey } from './paletteRemap';

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];
const BLACK: Rgba = [0, 0, 0, 255];
const WHITE: Rgba = [255, 255, 255, 255];
const TRANSPARENT: Rgba = [0, 0, 0, 0];
const SEMI_ALPHA: Rgba = [128, 128, 128, 128];

function color(rgba: Rgba, name?: string): SpriteColor {
  return { rgba, name };
}

describe('paletteRemap', () => {
  // ── rgbaKey ──

  describe('rgbaKey', () => {
    it('serializes RGBA to comma-separated string', () => {
      expect(rgbaKey([255, 0, 128, 200])).toBe('255,0,128,200');
    });
  });

  // ── buildColorMap ──

  describe('buildColorMap', () => {
    it('maps source colors to target colors by index', () => {
      const source = [color(RED), color(GREEN)];
      const target = [color(BLUE), color(WHITE)];
      const map = buildColorMap(source, target);
      expect(map.size).toBe(2);
      expect(map.get(rgbaKey(RED))).toEqual(BLUE);
      expect(map.get(rgbaKey(GREEN))).toEqual(WHITE);
    });

    it('skips identity mappings', () => {
      const source = [color(RED), color(GREEN)];
      const target = [color(RED), color(BLUE)]; // RED→RED is identity
      const map = buildColorMap(source, target);
      expect(map.size).toBe(1);
      expect(map.has(rgbaKey(RED))).toBe(false);
      expect(map.get(rgbaKey(GREEN))).toEqual(BLUE);
    });

    it('handles target shorter than source', () => {
      const source = [color(RED), color(GREEN), color(BLUE)];
      const target = [color(WHITE)];
      const map = buildColorMap(source, target);
      expect(map.size).toBe(1);
      expect(map.get(rgbaKey(RED))).toEqual(WHITE);
    });

    it('handles source shorter than target', () => {
      const source = [color(RED)];
      const target = [color(WHITE), color(BLUE), color(GREEN)];
      const map = buildColorMap(source, target);
      expect(map.size).toBe(1);
      expect(map.get(rgbaKey(RED))).toEqual(WHITE);
    });

    it('returns empty map for empty inputs', () => {
      expect(buildColorMap([], []).size).toBe(0);
    });
  });

  // ── remapPixelBuffer ──

  describe('remapPixelBuffer', () => {
    it('remaps matching pixels to target colors', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 0, GREEN);
      setPixel(buf, 2, 0, BLUE);

      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), WHITE);
      map.set(rgbaKey(GREEN), BLACK);

      const result = remapPixelBuffer(buf, map);

      // Remapped
      expect(samplePixel(result, 0, 0)).toEqual(WHITE);
      expect(samplePixel(result, 1, 0)).toEqual(BLACK);
      // Unmapped — pass through
      expect(samplePixel(result, 2, 0)).toEqual(BLUE);
    });

    it('does not mutate the source buffer', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);

      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), GREEN);

      remapPixelBuffer(buf, map);

      // Source unchanged
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
    });

    it('preserves fully transparent pixels unchanged', () => {
      const buf = createBlankPixelBuffer(2, 2);
      // (0,0) is default transparent [0,0,0,0]
      setPixel(buf, 1, 0, RED);

      // Map transparent black to white (should be skipped for alpha=0)
      const map = new Map<string, Rgba>();
      map.set(rgbaKey(TRANSPARENT), WHITE);
      map.set(rgbaKey(RED), GREEN);

      const result = remapPixelBuffer(buf, map);
      expect(samplePixel(result, 0, 0)).toEqual(TRANSPARENT);
      expect(samplePixel(result, 1, 0)).toEqual(GREEN);
    });

    it('handles semi-transparent pixels', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, SEMI_ALPHA);

      const map = new Map<string, Rgba>();
      map.set(rgbaKey(SEMI_ALPHA), RED);

      const result = remapPixelBuffer(buf, map);
      expect(samplePixel(result, 0, 0)).toEqual(RED);
    });

    it('returns clone when color map is empty', () => {
      const buf = createBlankPixelBuffer(2, 2);
      setPixel(buf, 0, 0, RED);

      const result = remapPixelBuffer(buf, new Map());
      expect(samplePixel(result, 0, 0)).toEqual(RED);
      // Ensure it's a different buffer
      setPixel(result, 0, 0, GREEN);
      expect(samplePixel(buf, 0, 0)).toEqual(RED);
    });

    it('preview equals commit — same remap logic for both', () => {
      const buf = createBlankPixelBuffer(4, 4);
      setPixel(buf, 0, 0, RED);
      setPixel(buf, 1, 1, GREEN);
      setPixel(buf, 2, 2, BLUE);

      const source = [color(RED), color(GREEN), color(BLUE)];
      const target = [color(WHITE), color(BLACK), color([128, 0, 128, 255])];
      const map = buildColorMap(source, target);

      // "Preview" call
      const preview = remapPixelBuffer(buf, map);
      // "Commit" call (identical logic)
      const commit = remapPixelBuffer(buf, map);

      // Results must be identical
      expect(preview.data).toEqual(commit.data);
    });

    it('handles missing match — pixel stays as-is', () => {
      const buf = createBlankPixelBuffer(2, 2);
      const unusual: Rgba = [42, 84, 126, 255];
      setPixel(buf, 0, 0, unusual);

      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), GREEN);

      const result = remapPixelBuffer(buf, map);
      expect(samplePixel(result, 0, 0)).toEqual(unusual);
    });
  });

  // ── remapFrameBuffers ──

  describe('remapFrameBuffers', () => {
    function makeFrames(count: number): { frames: SpriteFrame[]; buffers: Record<string, import('@glyphstudio/domain').SpritePixelBuffer> } {
      const frames: SpriteFrame[] = [];
      const buffers: Record<string, import('@glyphstudio/domain').SpritePixelBuffer> = {};
      for (let i = 0; i < count; i++) {
        const frame = createSpriteFrame(i);
        frames.push(frame);
        const buf = createBlankPixelBuffer(4, 4);
        setPixel(buf, 0, 0, RED);
        buffers[frame.layers[0].id] = buf;
      }
      return { frames, buffers };
    }

    it('remaps only the specified frame range', () => {
      const { frames, buffers } = makeFrames(3);
      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), GREEN);

      // Remap only frame 1
      const result = remapFrameBuffers(frames, buffers, map, 1, 1);

      // Frame 0 unchanged
      expect(samplePixel(result[frames[0].layers[0].id], 0, 0)).toEqual(RED);
      // Frame 1 remapped
      expect(samplePixel(result[frames[1].layers[0].id], 0, 0)).toEqual(GREEN);
      // Frame 2 unchanged
      expect(samplePixel(result[frames[2].layers[0].id], 0, 0)).toEqual(RED);
    });

    it('remaps all frames when range covers entire sequence', () => {
      const { frames, buffers } = makeFrames(3);
      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), BLUE);

      const result = remapFrameBuffers(frames, buffers, map, 0, 2);

      for (const frame of frames) {
        expect(samplePixel(result[frame.layers[0].id], 0, 0)).toEqual(BLUE);
      }
    });

    it('clamps out-of-bounds range to valid indices', () => {
      const { frames, buffers } = makeFrames(2);
      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), WHITE);

      // Range extends beyond frames
      const result = remapFrameBuffers(frames, buffers, map, -1, 10);

      expect(samplePixel(result[frames[0].layers[0].id], 0, 0)).toEqual(WHITE);
      expect(samplePixel(result[frames[1].layers[0].id], 0, 0)).toEqual(WHITE);
    });

    it('returns original buffers when color map is empty', () => {
      const { frames, buffers } = makeFrames(2);
      const result = remapFrameBuffers(frames, buffers, new Map(), 0, 1);
      expect(result).toBe(buffers);
    });

    it('does not mutate source buffers', () => {
      const { frames, buffers } = makeFrames(1);
      const map = new Map<string, Rgba>();
      map.set(rgbaKey(RED), GREEN);

      remapFrameBuffers(frames, buffers, map, 0, 0);

      // Source unchanged
      expect(samplePixel(buffers[frames[0].layers[0].id], 0, 0)).toEqual(RED);
    });
  });
});
