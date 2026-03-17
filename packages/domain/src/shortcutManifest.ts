import type { ToolId } from './tool';

// ── Types ──────────────────────────────────────────────────────

/** Lifecycle status of a shortcut binding */
export type ShortcutStatus =
  | 'live'      // Handler wired and working
  | 'reserved'  // Key assigned, handler planned (not yet wired)
  | 'hidden'    // Wired but intentionally not shown in UI
  | 'disabled'; // Temporarily turned off

/** Where this shortcut is active */
export type ShortcutScope =
  | 'canvas'    // Pixel editing canvas (edit/animate modes)
  | 'global'    // App-wide, any workspace mode
  | 'panel'     // Specific panel (container-scoped)
  | 'timeline'; // Timeline/frame navigation

/** How the shortcut interacts with text input focus */
export type FocusPolicy =
  | 'block-in-text'  // Suppressed when input/textarea/contenteditable focused
  | 'allow-in-text'  // Fires even in text fields (Ctrl+Z, Ctrl+S, etc.)
  | 'ctrl-only';     // Only fires in text fields if Ctrl/Cmd held

/** A single shortcut binding in the canonical manifest */
export interface ShortcutBinding {
  /** Unique identifier for this binding */
  id: string;
  /** The key code (KeyboardEvent.code): 'KeyB', 'KeyO', 'Space', 'Comma', etc. */
  code: string;
  /** Human-readable key label shown in UI: 'B', 'O', ',', 'Space' */
  label: string;
  /** Required modifier keys */
  modifiers: {
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
  };
  /** What this shortcut does (human-readable) */
  action: string;
  /** Lifecycle status */
  status: ShortcutStatus;
  /** Where this shortcut is active */
  scope: ShortcutScope;
  /** Component that owns the handler */
  handler: string;
  /** Whether the shortcut badge should be displayed in UI */
  displayed: boolean;
  /** Focus policy for text input handling */
  focusPolicy: FocusPolicy;
  /** Tool this activates (if tool shortcut) */
  toolId?: ToolId;
  /** Condition required for this shortcut to fire */
  condition?: string;
  /** Test ID for CI verification */
  testId: string;
}

// ── Manifest ───────────────────────────────────────────────────

/**
 * Canonical shortcut manifest.
 *
 * Rules:
 * - No shortcut may be displayed in the UI unless it appears here with status 'live'.
 * - No keyboard handler may exist unless the binding is declared here.
 * - This is the single source of truth for display, handling, tooltips, and audit.
 */
export const SHORTCUT_MANIFEST: readonly ShortcutBinding[] = [
  // ── Tool activation (canvas scope) ────────────────────────────
  { id: 'tool-pencil',       code: 'KeyB', label: 'B',       modifiers: {},             action: 'Pencil tool',        status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'pencil',       testId: 'shortcut-b-pencil' },
  { id: 'tool-eraser',       code: 'KeyE', label: 'E',       modifiers: {},             action: 'Eraser tool',        status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'eraser',       testId: 'shortcut-e-eraser' },
  { id: 'tool-fill',         code: 'KeyG', label: 'G',       modifiers: {},             action: 'Fill tool',          status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'fill',         testId: 'shortcut-g-fill' },
  { id: 'tool-line',         code: 'KeyL', label: 'L',       modifiers: {},             action: 'Line tool',          status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'line',         testId: 'shortcut-l-line' },
  { id: 'tool-rectangle',    code: 'KeyU', label: 'U',       modifiers: {},             action: 'Rectangle tool',     status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'rectangle',    testId: 'shortcut-u-rect' },
  { id: 'tool-ellipse',      code: 'KeyC', label: 'C',       modifiers: {},             action: 'Ellipse tool',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'ellipse',      testId: 'shortcut-c-ellipse' },
  { id: 'tool-marquee',      code: 'KeyM', label: 'M',       modifiers: {},             action: 'Marquee tool',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'marquee',      testId: 'shortcut-m-marquee' },
  { id: 'tool-lasso',        code: 'KeyQ', label: 'Q',       modifiers: {},             action: 'Lasso tool',         status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'lasso',        testId: 'shortcut-q-lasso' },
  { id: 'tool-magic-select', code: 'KeyW', label: 'W',       modifiers: {},             action: 'Magic Select tool',  status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'magic-select', testId: 'shortcut-w-magic' },
  { id: 'tool-color-select', code: 'KeyY', label: 'Y',       modifiers: {},             action: 'Color Select tool',  status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'color-select', testId: 'shortcut-y-eyedrop' },
  { id: 'tool-move',         code: 'KeyV', label: 'V',       modifiers: {},             action: 'Move tool',          status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'move',         testId: 'shortcut-v-move' },
  { id: 'tool-transform',    code: 'KeyT', label: 'T',       modifiers: {},             action: 'Transform tool',     status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'transform',    testId: 'shortcut-t-transform' },
  { id: 'tool-slice',        code: 'KeyK', label: 'K',       modifiers: {},             action: 'Slice tool',         status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'slice',        testId: 'shortcut-k-slice' },
  { id: 'tool-socket',       code: 'KeyS', label: 'S',       modifiers: {},             action: 'Socket tool',        status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'socket',       testId: 'shortcut-s-socket' },
  { id: 'tool-measure',      code: 'KeyI', label: 'I',       modifiers: {},             action: 'Measure tool',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'measure',      testId: 'shortcut-i-measure' },
  { id: 'tool-sketch-brush', code: 'KeyN', label: 'N',       modifiers: {},             action: 'Sketch Brush',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'sketch-brush', testId: 'shortcut-n-sketch' },
  { id: 'tool-sketch-eraser',code: 'KeyN', label: 'Shift+N', modifiers: { shift: true },action: 'Sketch Eraser',      status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text', toolId: 'sketch-eraser',testId: 'shortcut-shift-n-sketch-erase' },
  { id: 'swap-colors',       code: 'KeyX', label: 'X',       modifiers: {},             action: 'Swap colors',        status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: true,  focusPolicy: 'block-in-text',                         testId: 'shortcut-x-swap' },

  // ── Canvas operations ─────────────────────────────────────────
  { id: 'onion-skin',        code: 'KeyO', label: 'O',       modifiers: {},             action: 'Toggle onion skin',  status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text',                         testId: 'shortcut-o-onion' },
  { id: 'pan-play',          code: 'Space',label: 'Space',    modifiers: {},             action: 'Pan / Play-Pause',   status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text',                         testId: 'shortcut-space-pan' },
  { id: 'prev-frame',        code: 'Comma',label: ',',        modifiers: {},             action: 'Previous frame',     status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text',                         testId: 'shortcut-comma-prev' },
  { id: 'next-frame',        code: 'Period',label: '.',       modifiers: {},             action: 'Next frame',         status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text',                         testId: 'shortcut-period-next' },

  // ── Selection transform (conditional) ─────────────────────────
  { id: 'commit-transform',  code: 'Enter', label: 'Enter',  modifiers: {},             action: 'Commit transform',   status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-enter-commit' },
  { id: 'cancel-transform',  code: 'Escape',label: 'Esc',    modifiers: {},             action: 'Cancel / Clear',     status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text',                         testId: 'shortcut-esc-cancel' },
  { id: 'nudge-up',          code: 'ArrowUp',label: 'Up',    modifiers: {},             action: 'Nudge up',           status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-arrow-nudge' },
  { id: 'nudge-down',        code: 'ArrowDown',label: 'Down',modifiers: {},             action: 'Nudge down',         status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-arrow-nudge' },
  { id: 'nudge-left',        code: 'ArrowLeft',label: 'Left',modifiers: {},             action: 'Nudge left',         status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-arrow-nudge' },
  { id: 'nudge-right',       code: 'ArrowRight',label:'Right',modifiers: {},            action: 'Nudge right',        status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-arrow-nudge' },
  { id: 'flip-h',            code: 'KeyH', label: 'H',       modifiers: {},             action: 'Flip horizontal',    status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-h-flip' },
  { id: 'flip-v-transform',  code: 'KeyV', label: 'V',       modifiers: {},             action: 'Flip vertical',      status: 'hidden',   scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-v-flip' },
  { id: 'rotate-cw',         code: 'KeyR', label: 'R',       modifiers: {},             action: 'Rotate 90 CW',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-r-rotate-cw' },
  { id: 'rotate-ccw',        code: 'KeyR', label: 'Shift+R', modifiers: { shift: true },action: 'Rotate 90 CCW',      status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'transformActive', testId: 'shortcut-shift-r-rotate-ccw' },
  { id: 'delete-selection',  code: 'Delete',label: 'Del',    modifiers: {},             action: 'Delete selection',    status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'block-in-text', condition: 'selectionExists', testId: 'shortcut-del-selection' },

  // ── Clipboard (Ctrl/Cmd) ──────────────────────────────────────
  { id: 'copy',              code: 'KeyC', label: 'Ctrl+C',  modifiers: { ctrl: true }, action: 'Copy selection',      status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text', condition: 'selectionExists', testId: 'shortcut-ctrl-c-copy' },
  { id: 'cut',               code: 'KeyX', label: 'Ctrl+X',  modifiers: { ctrl: true }, action: 'Cut selection',       status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text', condition: 'selectionExists', testId: 'shortcut-ctrl-x-cut' },
  { id: 'paste',             code: 'KeyV', label: 'Ctrl+V',  modifiers: { ctrl: true }, action: 'Paste',               status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text',                         testId: 'shortcut-ctrl-v-paste' },
  { id: 'undo',              code: 'KeyZ', label: 'Ctrl+Z',  modifiers: { ctrl: true }, action: 'Undo',                status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text',                         testId: 'shortcut-ctrl-z-undo' },
  { id: 'redo',              code: 'KeyZ', label: 'Ctrl+Shift+Z', modifiers: { ctrl: true, shift: true }, action: 'Redo', status: 'live', scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text',                         testId: 'shortcut-ctrl-shift-z-redo' },
  { id: 'redo-alt',          code: 'KeyY', label: 'Ctrl+Y',  modifiers: { ctrl: true }, action: 'Redo (alt)',          status: 'live',     scope: 'canvas', handler: 'Canvas.tsx', displayed: false, focusPolicy: 'allow-in-text',                         testId: 'shortcut-ctrl-y-redo' },

  // ── Global ────────────────────────────────────────────────────
  { id: 'save',              code: 'KeyS', label: 'Ctrl+S',  modifiers: { ctrl: true }, action: 'Save project',        status: 'live',     scope: 'global', handler: 'AppShell.tsx', displayed: false, focusPolicy: 'allow-in-text',                       testId: 'shortcut-ctrl-s-save' },
] as const;

// ── Derived lookups (computed from manifest, not maintained separately) ──

/** Map from KeyboardEvent.code → ToolId for unmodified single-key tool shortcuts */
export const TOOL_KEY_MAP: ReadonlyMap<string, ToolId> = new Map(
  SHORTCUT_MANIFEST
    .filter((b): b is ShortcutBinding & { toolId: ToolId } =>
      b.status === 'live' &&
      b.toolId !== undefined &&
      b.scope === 'canvas' &&
      !b.modifiers.ctrl && !b.modifiers.shift && !b.modifiers.alt
    )
    .map((b) => [b.code, b.toolId])
);

/** Map from KeyboardEvent.code → ToolId for Shift+key tool shortcuts */
export const TOOL_SHIFT_KEY_MAP: ReadonlyMap<string, ToolId> = new Map(
  SHORTCUT_MANIFEST
    .filter((b): b is ShortcutBinding & { toolId: ToolId } =>
      b.status === 'live' &&
      b.toolId !== undefined &&
      b.scope === 'canvas' &&
      b.modifiers.shift === true && !b.modifiers.ctrl && !b.modifiers.alt
    )
    .map((b) => [b.code, b.toolId])
);

/** Set of shortcut labels that are live and displayable (for ToolRail badge gating) */
export const LIVE_DISPLAYED_SHORTCUTS: ReadonlySet<string> = new Set(
  SHORTCUT_MANIFEST
    .filter((b) => b.status === 'live' && b.displayed)
    .map((b) => b.label)
);

/** Lookup: ToolId → display label for the shortcut (only live+displayed) */
export const TOOL_SHORTCUT_LABEL: ReadonlyMap<ToolId, string> = new Map(
  SHORTCUT_MANIFEST
    .filter((b): b is ShortcutBinding & { toolId: ToolId } =>
      b.status === 'live' && b.displayed && b.toolId !== undefined
    )
    .map((b) => [b.toolId, b.label])
);

/** The swap-colors binding (for ToolRail tooltip) */
export const SWAP_COLORS_BINDING = SHORTCUT_MANIFEST.find((b) => b.id === 'swap-colors');
