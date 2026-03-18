import { describe, it, expect, beforeEach } from 'vitest';
import { useHintStore } from './hintStore';

// Polyfill localStorage for Node test environment
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { for (const k in store) delete store[k]; },
  };
}

function resetStore() {
  localStorage.removeItem('glyphstudio_dismissed_hints');
  useHintStore.setState({ dismissedIds: new Set(), activeHints: [] });
}

describe('hintStore', () => {
  beforeEach(() => resetStore());

  it('starts with no active hints', () => {
    expect(useHintStore.getState().activeHints).toEqual([]);
  });

  it('setActiveHints sets visible hints', () => {
    useHintStore.getState().setActiveHints([
      { id: 'a', text: 'Hint A' },
      { id: 'b', text: 'Hint B' },
    ]);
    expect(useHintStore.getState().activeHints).toHaveLength(2);
  });

  it('setActiveHints filters already-dismissed hints', () => {
    useHintStore.getState().dismissHint('a');
    useHintStore.getState().setActiveHints([
      { id: 'a', text: 'Hint A' },
      { id: 'b', text: 'Hint B' },
    ]);
    expect(useHintStore.getState().activeHints).toHaveLength(1);
    expect(useHintStore.getState().activeHints[0].id).toBe('b');
  });

  it('dismissHint removes from active and adds to dismissed', () => {
    useHintStore.getState().setActiveHints([{ id: 'x', text: 'X' }]);
    useHintStore.getState().dismissHint('x');
    expect(useHintStore.getState().activeHints).toHaveLength(0);
    expect(useHintStore.getState().isDismissed('x')).toBe(true);
  });

  it('clearActiveHints empties the list', () => {
    useHintStore.getState().setActiveHints([{ id: 'a', text: 'A' }]);
    useHintStore.getState().clearActiveHints();
    expect(useHintStore.getState().activeHints).toEqual([]);
  });

  it('isDismissed returns false for unknown hint', () => {
    expect(useHintStore.getState().isDismissed('unknown')).toBe(false);
  });
});
