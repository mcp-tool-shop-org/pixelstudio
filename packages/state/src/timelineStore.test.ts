import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from './timelineStore';

beforeEach(() => {
  useTimelineStore.setState({
    frames: [],
    activeFrameId: null,
    activeFrameIndex: 0,
    playing: false,
    fps: 12,
    loop: true,
    onionSkinEnabled: false,
    onionSkinShowPrev: true,
    onionSkinShowNext: false,
    onionSkinPrevOpacity: 0.25,
    onionSkinNextOpacity: 0.15,
    onionSkinData: null,
  });
});

describe('setFps clamping', () => {
  it('clamps fps below 1 to 1', () => {
    useTimelineStore.getState().setFps(0);
    expect(useTimelineStore.getState().fps).toBe(1);
  });

  it('clamps fps above 60 to 60', () => {
    useTimelineStore.getState().setFps(120);
    expect(useTimelineStore.getState().fps).toBe(60);
  });

  it('accepts valid fps', () => {
    useTimelineStore.getState().setFps(24);
    expect(useTimelineStore.getState().fps).toBe(24);
  });
});

describe('togglePlayback', () => {
  it('toggles playing state', () => {
    expect(useTimelineStore.getState().playing).toBe(false);
    useTimelineStore.getState().togglePlayback();
    expect(useTimelineStore.getState().playing).toBe(true);
    useTimelineStore.getState().togglePlayback();
    expect(useTimelineStore.getState().playing).toBe(false);
  });
});

describe('setFrames', () => {
  it('sets frames and resets onion skin data', () => {
    useTimelineStore.getState().setOnionSkinData({ width: 10, height: 10, prevData: [1], nextData: [2] });
    useTimelineStore.getState().setFrames(
      [{ id: 'f1', name: 'Frame 1', index: 0, durationMs: null }],
      'f1',
      0,
    );
    const s = useTimelineStore.getState();
    expect(s.frames).toHaveLength(1);
    expect(s.activeFrameId).toBe('f1');
    expect(s.activeFrameIndex).toBe(0);
    expect(s.onionSkinData).toBeNull(); // cleared on frame change
  });
});

describe('onion skin opacity clamping', () => {
  it('clamps prev opacity to [0, 1]', () => {
    useTimelineStore.getState().setOnionSkinPrevOpacity(-0.5);
    expect(useTimelineStore.getState().onionSkinPrevOpacity).toBe(0);
    useTimelineStore.getState().setOnionSkinPrevOpacity(1.5);
    expect(useTimelineStore.getState().onionSkinPrevOpacity).toBe(1);
  });

  it('clamps next opacity to [0, 1]', () => {
    useTimelineStore.getState().setOnionSkinNextOpacity(-1);
    expect(useTimelineStore.getState().onionSkinNextOpacity).toBe(0);
    useTimelineStore.getState().setOnionSkinNextOpacity(2);
    expect(useTimelineStore.getState().onionSkinNextOpacity).toBe(1);
  });
});
