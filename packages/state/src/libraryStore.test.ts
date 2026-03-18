import { describe, it, expect, beforeEach } from 'vitest';
import { useLibraryStore } from './libraryStore';

function resetStore() {
  useLibraryStore.setState({ recentIds: [], pinnedIds: [], viewMode: 'all' });
}

describe('libraryStore', () => {
  beforeEach(() => resetStore());

  describe('pushRecent', () => {
    it('adds an ID to the front of recent list', () => {
      useLibraryStore.getState().pushRecent('a');
      expect(useLibraryStore.getState().recentIds).toEqual(['a']);
    });

    it('moves existing ID to front (dedup)', () => {
      useLibraryStore.getState().pushRecent('a');
      useLibraryStore.getState().pushRecent('b');
      useLibraryStore.getState().pushRecent('a');
      expect(useLibraryStore.getState().recentIds).toEqual(['a', 'b']);
    });

    it('caps at 12 entries', () => {
      for (let i = 0; i < 15; i++) {
        useLibraryStore.getState().pushRecent(`id-${i}`);
      }
      expect(useLibraryStore.getState().recentIds).toHaveLength(12);
      expect(useLibraryStore.getState().recentIds[0]).toBe('id-14');
    });
  });

  describe('togglePin', () => {
    it('pins an item', () => {
      useLibraryStore.getState().togglePin('x');
      expect(useLibraryStore.getState().pinnedIds).toEqual(['x']);
    });

    it('unpins an already pinned item', () => {
      useLibraryStore.getState().togglePin('x');
      useLibraryStore.getState().togglePin('x');
      expect(useLibraryStore.getState().pinnedIds).toEqual([]);
    });

    it('supports multiple pins', () => {
      useLibraryStore.getState().togglePin('a');
      useLibraryStore.getState().togglePin('b');
      expect(useLibraryStore.getState().pinnedIds).toEqual(['a', 'b']);
    });
  });

  describe('setViewMode', () => {
    it('changes view mode', () => {
      useLibraryStore.getState().setViewMode('recent');
      expect(useLibraryStore.getState().viewMode).toBe('recent');
    });

    it('switches between modes', () => {
      useLibraryStore.getState().setViewMode('pinned');
      expect(useLibraryStore.getState().viewMode).toBe('pinned');
      useLibraryStore.getState().setViewMode('all');
      expect(useLibraryStore.getState().viewMode).toBe('all');
    });
  });
});
