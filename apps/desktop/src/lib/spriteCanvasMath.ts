/**
 * Sprite canvas coordinate mapping.
 *
 * Maps pointer (screen) coordinates to sprite pixel coordinates
 * given zoom and pan state. Deterministic — same inputs always
 * produce the same pixel coordinate.
 */

export interface SpriteViewport {
  /** Canvas zoom (1 = 1 sprite pixel = 1 screen pixel). */
  zoom: number;
  /** Pan offset X in screen pixels. */
  panX: number;
  /** Pan offset Y in screen pixels. */
  panY: number;
  /** Sprite document width in pixels. */
  spriteWidth: number;
  /** Sprite document height in pixels. */
  spriteHeight: number;
  /** Canvas element width in screen pixels. */
  canvasWidth: number;
  /** Canvas element height in screen pixels. */
  canvasHeight: number;
}

export interface SpritePixelCoord {
  x: number;
  y: number;
}

/**
 * Get the top-left origin of the sprite on the canvas in screen pixels.
 * Centers the sprite in the canvas, offset by pan.
 */
export function getSpriteOrigin(viewport: SpriteViewport): { originX: number; originY: number } {
  const scaledWidth = viewport.spriteWidth * viewport.zoom;
  const scaledHeight = viewport.spriteHeight * viewport.zoom;
  const originX = (viewport.canvasWidth - scaledWidth) / 2 + viewport.panX;
  const originY = (viewport.canvasHeight - scaledHeight) / 2 + viewport.panY;
  return { originX, originY };
}

/**
 * Map a pointer position (relative to the canvas element) to sprite pixel coordinates.
 *
 * Returns the integer sprite pixel coordinate, or null if the pointer is outside
 * the sprite bounds.
 */
export function pointerToPixel(
  pointerX: number,
  pointerY: number,
  viewport: SpriteViewport,
): SpritePixelCoord | null {
  const { originX, originY } = getSpriteOrigin(viewport);

  const spriteX = Math.floor((pointerX - originX) / viewport.zoom);
  const spriteY = Math.floor((pointerY - originY) / viewport.zoom);

  if (spriteX < 0 || spriteX >= viewport.spriteWidth) return null;
  if (spriteY < 0 || spriteY >= viewport.spriteHeight) return null;

  return { x: spriteX, y: spriteY };
}

/**
 * Map a sprite pixel coordinate to canvas screen coordinates (top-left corner of the pixel).
 */
export function pixelToCanvas(
  pixelX: number,
  pixelY: number,
  viewport: SpriteViewport,
): { screenX: number; screenY: number } {
  const { originX, originY } = getSpriteOrigin(viewport);
  return {
    screenX: originX + pixelX * viewport.zoom,
    screenY: originY + pixelY * viewport.zoom,
  };
}
