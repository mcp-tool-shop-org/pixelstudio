import { describe, it, expect, beforeEach } from 'vitest';
import { useSizeProfileStore } from './sizeProfileStore';
import { BUILT_IN_SIZE_PROFILES } from '@glyphstudio/domain';

function resetStore() {
  useSizeProfileStore.setState({
    profiles: [...BUILT_IN_SIZE_PROFILES],
    activeProfileIds: [],
  });
}

describe('sizeProfileStore', () => {
  beforeEach(resetStore);

  // ── Initial state ──

  describe('initial state', () => {
    it('starts with 7 built-in profiles', () => {
      expect(useSizeProfileStore.getState().profiles).toHaveLength(7);
    });

    it('starts with no active profiles', () => {
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  // ── Profile CRUD ──

  describe('addProfile', () => {
    it('adds a custom profile', () => {
      const id = useSizeProfileStore.getState().addProfile('96×96 huge', 96, 96, 'Boss sprites');
      const { profiles } = useSizeProfileStore.getState();
      expect(profiles).toHaveLength(8);
      const added = profiles.find((p) => p.id === id)!;
      expect(added.name).toBe('96×96 huge');
      expect(added.targetWidth).toBe(96);
      expect(added.targetHeight).toBe(96);
      expect(added.notes).toBe('Boss sprites');
    });

    it('returns unique IDs', () => {
      const a = useSizeProfileStore.getState().addProfile('a', 10, 10);
      const b = useSizeProfileStore.getState().addProfile('b', 20, 20);
      expect(a).not.toBe(b);
    });
  });

  describe('removeProfile', () => {
    it('removes a custom profile', () => {
      const id = useSizeProfileStore.getState().addProfile('custom', 100, 100);
      useSizeProfileStore.getState().removeProfile(id);
      expect(useSizeProfileStore.getState().profiles).toHaveLength(7);
    });

    it('cannot remove built-in profiles', () => {
      useSizeProfileStore.getState().removeProfile('sp_48x48');
      expect(useSizeProfileStore.getState().profiles).toHaveLength(7);
    });

    it('removes from active set when deleted', () => {
      const id = useSizeProfileStore.getState().addProfile('custom', 100, 100);
      useSizeProfileStore.getState().activateProfile(id);
      useSizeProfileStore.getState().removeProfile(id);
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  // ── Activation ──

  describe('activateProfile', () => {
    it('activates a profile', () => {
      useSizeProfileStore.getState().activateProfile('sp_48x48');
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual(['sp_48x48']);
    });

    it('does not duplicate activations', () => {
      const store = useSizeProfileStore.getState();
      store.activateProfile('sp_48x48');
      store.activateProfile('sp_48x48');
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual(['sp_48x48']);
    });

    it('ignores nonexistent profile', () => {
      useSizeProfileStore.getState().activateProfile('fake_id');
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  describe('deactivateProfile', () => {
    it('deactivates a profile', () => {
      useSizeProfileStore.getState().activateProfile('sp_48x48');
      useSizeProfileStore.getState().deactivateProfile('sp_48x48');
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  describe('toggleProfile', () => {
    it('toggles on then off', () => {
      useSizeProfileStore.getState().toggleProfile('sp_32x32');
      expect(useSizeProfileStore.getState().activeProfileIds).toContain('sp_32x32');
      useSizeProfileStore.getState().toggleProfile('sp_32x32');
      expect(useSizeProfileStore.getState().activeProfileIds).not.toContain('sp_32x32');
    });

    it('ignores nonexistent profile on toggle', () => {
      useSizeProfileStore.getState().toggleProfile('fake');
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  describe('setActiveProfiles', () => {
    it('sets multiple profiles active', () => {
      useSizeProfileStore.getState().setActiveProfiles(['sp_16x32', 'sp_48x48', 'sp_64x64']);
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual(['sp_16x32', 'sp_48x48', 'sp_64x64']);
    });

    it('filters out nonexistent IDs', () => {
      useSizeProfileStore.getState().setActiveProfiles(['sp_48x48', 'bogus']);
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual(['sp_48x48']);
    });
  });

  describe('activateAll', () => {
    it('activates all profiles', () => {
      useSizeProfileStore.getState().activateAll();
      expect(useSizeProfileStore.getState().activeProfileIds).toHaveLength(7);
    });

    it('includes custom profiles', () => {
      const id = useSizeProfileStore.getState().addProfile('custom', 100, 100);
      useSizeProfileStore.getState().activateAll();
      expect(useSizeProfileStore.getState().activeProfileIds).toContain(id);
      expect(useSizeProfileStore.getState().activeProfileIds).toHaveLength(8);
    });
  });

  describe('deactivateAll', () => {
    it('clears all active profiles', () => {
      useSizeProfileStore.getState().activateAll();
      useSizeProfileStore.getState().deactivateAll();
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });

  describe('resetToBuiltIn', () => {
    it('removes custom profiles and clears selection', () => {
      useSizeProfileStore.getState().addProfile('custom', 100, 100);
      useSizeProfileStore.getState().activateProfile('sp_48x48');
      useSizeProfileStore.getState().resetToBuiltIn();
      expect(useSizeProfileStore.getState().profiles).toHaveLength(7);
      expect(useSizeProfileStore.getState().activeProfileIds).toEqual([]);
    });
  });
});
