/** Ambient module declaration so tsc finds gifenc types across workspaces. */
declare module 'gifenc' {
  interface GIFEncoderOptions {
    initialCapacity?: number;
    auto?: boolean;
  }

  interface WriteFrameOptions {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    repeat?: number;
    colorDepth?: number;
    dispose?: number;
    first?: boolean;
  }

  interface GIFEncoderInstance {
    reset(): void;
    finish(): void;
    bytes(): Uint8Array;
    bytesView(): Uint8Array;
    writeHeader(): void;
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void;
    readonly buffer: ArrayBuffer;
  }

  export function GIFEncoder(opts?: GIFEncoderOptions): GIFEncoderInstance;
  export function quantize(rgba: Uint8ClampedArray | Uint8Array, maxColors: number, options?: { format?: string; oneBitAlpha?: boolean | number }): number[][];
  export function applyPalette(rgba: Uint8ClampedArray | Uint8Array, palette: number[][], format?: string): Uint8Array;
  export function nearestColorIndex(palette: number[][], color: number[]): number;
  export function nearestColor(palette: number[][], color: number[]): number[];
  export function prequantize(rgba: Uint8ClampedArray | Uint8Array, options?: { roundRGB?: number; roundAlpha?: number; oneBitAlpha?: boolean | number }): void;
}
