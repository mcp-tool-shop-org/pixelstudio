import { useSpriteEditorStore } from '@glyphstudio/state';

export function SpriteFrameStrip() {
  const doc = useSpriteEditorStore((s) => s.document);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);
  const setActiveFrame = useSpriteEditorStore((s) => s.setActiveFrame);
  const addFrame = useSpriteEditorStore((s) => s.addFrame);
  const removeFrame = useSpriteEditorStore((s) => s.removeFrame);

  if (!doc) return null;

  return (
    <div className="sprite-frame-strip" data-testid="sprite-frame-strip">
      <div className="sprite-frame-strip-frames">
        {doc.frames.map((frame, i) => (
          <button
            key={frame.id}
            className={`sprite-frame-thumb${i === activeFrameIndex ? ' active' : ''}`}
            data-frame-index={i}
            onClick={() => setActiveFrame(i)}
            title={`Frame ${i + 1} (${frame.durationMs}ms)`}
          >
            <span className="sprite-frame-number">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="sprite-frame-strip-actions">
        <button
          className="sprite-frame-add-btn"
          onClick={addFrame}
          title="Add frame"
          data-testid="add-frame-btn"
        >
          + Frame
        </button>
        {doc.frames.length > 1 && (
          <button
            className="sprite-frame-remove-btn"
            onClick={() => {
              const frame = doc.frames[activeFrameIndex];
              if (frame) removeFrame(frame.id);
            }}
            title="Remove current frame"
            data-testid="remove-frame-btn"
          >
            - Frame
          </button>
        )}
      </div>
    </div>
  );
}
