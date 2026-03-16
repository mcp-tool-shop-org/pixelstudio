import { useEffect, useRef } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';

/**
 * Animation preview controls: play/stop, loop toggle, scrubber, frame counter.
 *
 * The playback loop runs here via useEffect + setTimeout, calling advancePreview()
 * on the store at each frame's authored duration. Preview never mutates pixel data.
 */
export function SpritePreviewBar() {
  const doc = useSpriteEditorStore((s) => s.document);
  const isPlaying = useSpriteEditorStore((s) => s.isPlaying);
  const isLooping = useSpriteEditorStore((s) => s.isLooping);
  const previewFrameIndex = useSpriteEditorStore((s) => s.previewFrameIndex);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);
  const togglePlay = useSpriteEditorStore((s) => s.togglePlay);
  const toggleLoop = useSpriteEditorStore((s) => s.toggleLoop);
  const scrubPreview = useSpriteEditorStore((s) => s.scrubPreview);
  const resetPreview = useSpriteEditorStore((s) => s.resetPreview);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (!doc) return null;

  const frameCount = doc.frames.length;
  const displayIndex = isPlaying ? previewFrameIndex : activeFrameIndex;
  const currentFrame = doc.frames[displayIndex];
  const durationMs = currentFrame?.durationMs ?? 100;

  // Playback loop
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      const store = useSpriteEditorStore.getState();
      if (!store.isPlaying || !store.document) return;

      const frame = store.document.frames[store.previewFrameIndex];
      const delay = frame?.durationMs ?? 100;

      timerRef.current = setTimeout(() => {
        const continued = useSpriteEditorStore.getState().advancePreview();
        if (continued) {
          tick();
        }
      }, delay);
    };

    tick();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPlaying]);

  return (
    <div className="sprite-preview-bar" data-testid="sprite-preview-bar">
      <button
        className="sprite-preview-play-btn"
        onClick={togglePlay}
        title={isPlaying ? 'Stop (Space)' : 'Play (Space)'}
        data-testid="preview-play-btn"
      >
        {isPlaying ? '⏹' : '▶'}
      </button>
      <button
        className="sprite-preview-reset-btn"
        onClick={resetPreview}
        title="Reset to first frame"
        data-testid="preview-reset-btn"
        disabled={isPlaying}
      >
        ⏮
      </button>
      <button
        className={`sprite-preview-loop-btn${isLooping ? ' active' : ''}`}
        onClick={toggleLoop}
        title={isLooping ? 'Loop: ON' : 'Loop: OFF'}
        data-testid="preview-loop-btn"
      >
        🔁
      </button>
      <input
        type="range"
        className="sprite-preview-scrubber"
        min={0}
        max={frameCount - 1}
        value={displayIndex}
        onChange={(e) => scrubPreview(Number(e.target.value))}
        disabled={isPlaying}
        data-testid="preview-scrubber"
        title={`Frame ${displayIndex + 1} / ${frameCount}`}
      />
      <span className="sprite-preview-frame-counter" data-testid="preview-frame-counter">
        {displayIndex + 1} / {frameCount}
      </span>
      <span className="sprite-preview-duration" data-testid="preview-duration">
        {durationMs}ms
      </span>
    </div>
  );
}
