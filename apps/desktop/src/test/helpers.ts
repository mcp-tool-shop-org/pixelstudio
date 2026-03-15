import { cleanup, render, type RenderOptions } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import type { ReactElement } from 'react';

// Re-export testing-library for convenience
export { render, screen, within, waitFor, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';

/** Access the invoke mock from setup.ts */
export function getMockInvoke() {
  return (globalThis as Record<string, unknown>).__mockInvoke as {
    fn: ReturnType<typeof import('vitest').vi.fn>;
    on(cmd: string, handler: (...args: unknown[]) => unknown): unknown;
    reset(): void;
  };
}

/** Render with automatic cleanup and invoke reset */
export function renderComponent(ui: ReactElement, options?: RenderOptions) {
  return render(ui, options);
}

/** Standard beforeEach/afterEach for component tests */
export function useComponentTestLifecycle() {
  beforeEach(() => {
    getMockInvoke().reset();
  });
  afterEach(() => {
    cleanup();
  });
}
