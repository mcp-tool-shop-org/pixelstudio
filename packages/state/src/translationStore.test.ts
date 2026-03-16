import { describe, it, expect, beforeEach } from 'vitest';
import { useTranslationStore } from './translationStore';
import type { TranslationResolution } from './translationStore';
import { TRANSLATION_RESOLUTIONS } from './translationStore';

function resetStore() {
  useTranslationStore.setState({ sessions: [], activeSessionId: null });
}

describe('translationStore', () => {
  beforeEach(resetStore);

  describe('TRANSLATION_RESOLUTIONS', () => {
    it('contains expected game resolutions', () => {
      expect(TRANSLATION_RESOLUTIONS).toEqual([32, 48, 64]);
    });
  });

  describe('createSession', () => {
    it('creates a session with correct fields', () => {
      const id = useTranslationStore.getState().createSession(
        'Ranger → 48×48',
        '/concepts/ranger.png',
        500, 500,
        48, 48,
      );
      const { sessions, activeSessionId } = useTranslationStore.getState();
      expect(sessions).toHaveLength(1);
      expect(activeSessionId).toBe(id);
      const s = sessions[0];
      expect(s.name).toBe('Ranger → 48×48');
      expect(s.conceptPath).toBe('/concepts/ranger.png');
      expect(s.conceptWidth).toBe(500);
      expect(s.conceptHeight).toBe(500);
      expect(s.targetWidth).toBe(48);
      expect(s.targetHeight).toBe(48);
      expect(s.survivedCues).toEqual([]);
      expect(s.droppedCues).toEqual([]);
      expect(s.exaggeratedCues).toEqual([]);
      expect(s.notes).toBe('');
      expect(s.complete).toBe(false);
    });

    it('sets active session to newest', () => {
      const id1 = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      const id2 = useTranslationStore.getState().createSession('B', '/b.png', 500, 500, 32, 32);
      expect(useTranslationStore.getState().activeSessionId).toBe(id2);
      expect(useTranslationStore.getState().sessions).toHaveLength(2);
    });

    it('generates unique IDs', () => {
      const id1 = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      const id2 = useTranslationStore.getState().createSession('B', '/b.png', 500, 500, 64, 64);
      expect(id1).not.toBe(id2);
    });
  });

  describe('removeSession', () => {
    it('removes session by id', () => {
      const id = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      useTranslationStore.getState().removeSession(id);
      expect(useTranslationStore.getState().sessions).toHaveLength(0);
    });

    it('clears activeSessionId if removed session was active', () => {
      const id = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      expect(useTranslationStore.getState().activeSessionId).toBe(id);
      useTranslationStore.getState().removeSession(id);
      expect(useTranslationStore.getState().activeSessionId).toBeNull();
    });

    it('preserves activeSessionId if different session removed', () => {
      const id1 = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      const id2 = useTranslationStore.getState().createSession('B', '/b.png', 500, 500, 32, 32);
      useTranslationStore.getState().removeSession(id1);
      expect(useTranslationStore.getState().activeSessionId).toBe(id2);
    });
  });

  describe('setActiveSession', () => {
    it('switches active session', () => {
      const id1 = useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      useTranslationStore.getState().createSession('B', '/b.png', 500, 500, 32, 32);
      useTranslationStore.getState().setActiveSession(id1);
      expect(useTranslationStore.getState().activeSessionId).toBe(id1);
    });

    it('can set to null', () => {
      useTranslationStore.getState().createSession('A', '/a.png', 500, 500, 48, 48);
      useTranslationStore.getState().setActiveSession(null);
      expect(useTranslationStore.getState().activeSessionId).toBeNull();
    });
  });

  describe('cue tracking', () => {
    let sessionId: string;
    beforeEach(() => {
      sessionId = useTranslationStore.getState().createSession('Test', '/t.png', 500, 500, 48, 48);
    });

    it('addSurvivedCue appends cue', () => {
      useTranslationStore.getState().addSurvivedCue(sessionId, 'hooded silhouette');
      const s = useTranslationStore.getState().sessions[0];
      expect(s.survivedCues).toEqual(['hooded silhouette']);
    });

    it('addSurvivedCue deduplicates', () => {
      useTranslationStore.getState().addSurvivedCue(sessionId, 'bow');
      useTranslationStore.getState().addSurvivedCue(sessionId, 'bow');
      expect(useTranslationStore.getState().sessions[0].survivedCues).toEqual(['bow']);
    });

    it('addDroppedCue appends cue', () => {
      useTranslationStore.getState().addDroppedCue(sessionId, 'belt buckle detail');
      expect(useTranslationStore.getState().sessions[0].droppedCues).toEqual(['belt buckle detail']);
    });

    it('addDroppedCue deduplicates', () => {
      useTranslationStore.getState().addDroppedCue(sessionId, 'rivets');
      useTranslationStore.getState().addDroppedCue(sessionId, 'rivets');
      expect(useTranslationStore.getState().sessions[0].droppedCues).toEqual(['rivets']);
    });

    it('addExaggeratedCue appends cue', () => {
      useTranslationStore.getState().addExaggeratedCue(sessionId, 'cloak width');
      expect(useTranslationStore.getState().sessions[0].exaggeratedCues).toEqual(['cloak width']);
    });

    it('addExaggeratedCue deduplicates', () => {
      useTranslationStore.getState().addExaggeratedCue(sessionId, 'head size');
      useTranslationStore.getState().addExaggeratedCue(sessionId, 'head size');
      expect(useTranslationStore.getState().sessions[0].exaggeratedCues).toEqual(['head size']);
    });

    it('tracks multiple cues per category', () => {
      const store = useTranslationStore.getState();
      store.addSurvivedCue(sessionId, 'asymmetric pose');
      store.addSurvivedCue(sessionId, 'hood shape');
      store.addDroppedCue(sessionId, 'face features');
      store.addDroppedCue(sessionId, 'quiver arrows');
      store.addExaggeratedCue(sessionId, 'shoulder width');

      const s = useTranslationStore.getState().sessions[0];
      expect(s.survivedCues).toEqual(['asymmetric pose', 'hood shape']);
      expect(s.droppedCues).toEqual(['face features', 'quiver arrows']);
      expect(s.exaggeratedCues).toEqual(['shoulder width']);
    });

    it('no-ops on unknown session id', () => {
      useTranslationStore.getState().addSurvivedCue('nonexistent', 'test');
      expect(useTranslationStore.getState().sessions[0].survivedCues).toEqual([]);
    });
  });

  describe('notes and completion', () => {
    let sessionId: string;
    beforeEach(() => {
      sessionId = useTranslationStore.getState().createSession('Test', '/t.png', 500, 500, 48, 48);
    });

    it('setNotes updates session notes', () => {
      useTranslationStore.getState().setNotes(sessionId, 'Had to exaggerate hood for readability');
      expect(useTranslationStore.getState().sessions[0].notes).toBe('Had to exaggerate hood for readability');
    });

    it('markComplete sets complete flag', () => {
      expect(useTranslationStore.getState().sessions[0].complete).toBe(false);
      useTranslationStore.getState().markComplete(sessionId);
      expect(useTranslationStore.getState().sessions[0].complete).toBe(true);
    });
  });
});
