import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// ── Mock @tauri-apps/api/core ──────────────────────────────────
// Every component calls invoke(). This mock captures all calls
// and returns sensible defaults. Tests override per-command via
// mockInvoke.on('command_name', handler).
const invokeHandlers = new Map<string, (...args: unknown[]) => unknown>();
const invokeMock = vi.fn(async (cmd: string, args?: unknown) => {
  const handler = invokeHandlers.get(cmd);
  if (handler) return handler(args);
  return undefined;
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

// ── Mock @tauri-apps/plugin-dialog ─────────────────────────────
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async () => '/mock/export/path'),
  open: vi.fn(async () => '/mock/open/path'),
}));

// ── Mock @tauri-apps/plugin-fs ─────────────────────────────────
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(async () => '{}'),
  writeTextFile: vi.fn(async () => {}),
  exists: vi.fn(async () => false),
  BaseDirectory: { AppData: 0, AppConfig: 1, Desktop: 2 },
}));

// ── Expose mock helpers for tests ──────────────────────────────
export const mockInvoke = {
  /** Get the raw vi.fn() for assertions */
  fn: invokeMock,
  /** Register a handler for a specific command */
  on(cmd: string, handler: (...args: unknown[]) => unknown) {
    invokeHandlers.set(cmd, handler);
    return this;
  },
  /** Clear all registered handlers and call history */
  reset() {
    invokeHandlers.clear();
    invokeMock.mockClear();
  },
};

// Attach to globalThis so tests can import from setup
(globalThis as Record<string, unknown>).__mockInvoke = mockInvoke;

// ── Canvas mock (happy-dom doesn't implement Canvas2D) ─────────
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  clearRect: vi.fn(),
  putImageData: vi.fn(),
  getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
  drawImage: vi.fn(),
  setLineDash: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  rect: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  scale: vi.fn(),
  translate: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  createImageData: vi.fn((w: number, h: number) => ({
    data: new Uint8ClampedArray(w * h * 4),
    width: w,
    height: h,
  })),
  measureText: vi.fn(() => ({ width: 0 })),
  fillText: vi.fn(),
  strokeText: vi.fn(),
  canvas: { width: 256, height: 256 },
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  lineDashOffset: 0,
  globalAlpha: 1,
  globalCompositeOperation: 'source-over',
  imageSmoothingEnabled: false,
  font: '10px sans-serif',
  textAlign: 'start',
  textBaseline: 'alphabetic',
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

// ── URL.createObjectURL / revokeObjectURL mock ─────────────────
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock');
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn();
}

// ── Clear localStorage between tests ───────────────────────────
import { afterEach } from 'vitest';
afterEach(() => {
  localStorage.clear();
});
