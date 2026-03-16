import { describe, it, expect, beforeEach } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { silhouetteBuffer, setPixel } from './spriteRaster';
import type { Rgba } from './spriteRaster';
import { useCanvasViewStore } from './canvasViewStore';

const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const SILHOUETTE_COLOR: Rgba = [30, 30, 40, 255];

describe('silhouetteBuffer', () => {
  it('replaces non-transparent pixels with silhouette color', () => {
    const buf = createBlankPixelBuffer(2, 2);
    setPixel(buf, 0, 0, RED);
    setPixel(buf, 1, 1, GREEN);

    const result = silhouetteBuffer(buf, SILHOUETTE_COLOR);

    // Pixel (0,0) should be silhouette color
    expect(result.data[0]).toBe(30);
    expect(result.data[1]).toBe(30);
    expect(result.data[2]).toBe(40);
    expect(result.data[3]).toBe(255);

    // Pixel (1,1) should also be silhouette color
    const i = (1 * 2 + 1) * 4;
    expect(result.data[i]).toBe(30);
    expect(result.data[i + 1]).toBe(30);
    expect(result.data[i + 2]).toBe(40);
    expect(result.data[i + 3]).toBe(255);
  });

  it('preserves transparent pixels as transparent', () => {
    const buf = createBlankPixelBuffer(2, 2);
    setPixel(buf, 0, 0, RED);
    // (1,0) stays transparent

    const result = silhouetteBuffer(buf, SILHOUETTE_COLOR);

    // Pixel (1,0) should remain transparent
    const i = (0 * 2 + 1) * 4;
    expect(result.data[i + 3]).toBe(0);
  });

  it('preserves original alpha for semi-transparent pixels', () => {
    const buf = createBlankPixelBuffer(1, 1);
    const semiTransparent: Rgba = [200, 100, 50, 128];
    setPixel(buf, 0, 0, semiTransparent);

    const result = silhouetteBuffer(buf, SILHOUETTE_COLOR);

    expect(result.data[0]).toBe(30);
    expect(result.data[1]).toBe(30);
    expect(result.data[2]).toBe(40);
    expect(result.data[3]).toBe(128); // alpha preserved
  });

  it('does not mutate the original buffer', () => {
    const buf = createBlankPixelBuffer(1, 1);
    setPixel(buf, 0, 0, RED);

    silhouetteBuffer(buf, SILHOUETTE_COLOR);

    expect(buf.data[0]).toBe(255); // still red
    expect(buf.data[1]).toBe(0);
    expect(buf.data[2]).toBe(0);
  });

  it('returns correct dimensions', () => {
    const buf = createBlankPixelBuffer(5, 3);
    const result = silhouetteBuffer(buf, SILHOUETTE_COLOR);
    expect(result.width).toBe(5);
    expect(result.height).toBe(3);
  });

  it('handles fully transparent buffer', () => {
    const buf = createBlankPixelBuffer(2, 2);
    const result = silhouetteBuffer(buf, SILHOUETTE_COLOR);
    // All pixels should remain transparent
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i + 3]).toBe(0);
    }
  });

  it('works with white silhouette color', () => {
    const buf = createBlankPixelBuffer(1, 1);
    setPixel(buf, 0, 0, RED);
    const white: Rgba = [255, 255, 255, 255];
    const result = silhouetteBuffer(buf, white);
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
    expect(result.data[3]).toBe(255);
  });
});

describe('canvasViewStore — silhouette toggle', () => {
  beforeEach(() => {
    useCanvasViewStore.setState({
      showSilhouette: false,
      silhouetteColor: [30, 30, 40, 255],
    });
  });

  it('showSilhouette defaults to false', () => {
    expect(useCanvasViewStore.getState().showSilhouette).toBe(false);
  });

  it('toggleOverlay toggles showSilhouette on and off', () => {
    useCanvasViewStore.getState().toggleOverlay('showSilhouette');
    expect(useCanvasViewStore.getState().showSilhouette).toBe(true);
    useCanvasViewStore.getState().toggleOverlay('showSilhouette');
    expect(useCanvasViewStore.getState().showSilhouette).toBe(false);
  });

  it('setSilhouetteColor updates the color', () => {
    useCanvasViewStore.getState().setSilhouetteColor([255, 0, 0, 255]);
    expect(useCanvasViewStore.getState().silhouetteColor).toEqual([255, 0, 0, 255]);
  });

  it('silhouetteColor defaults to dark blue-gray', () => {
    expect(useCanvasViewStore.getState().silhouetteColor).toEqual([30, 30, 40, 255]);
  });
});
