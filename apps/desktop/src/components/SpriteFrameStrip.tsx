import { useRef, useEffect } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import type { SpritePixelBuffer } from '@glyphstudio/domain';

const THUMB_SIZE = 48;
const THUMB_BG = '#222226';

/** Render a tiny thumbnail preview of a frame buffer onto a canvas. */
function renderThumbnail(canvas: HTMLCanvasElement, buf: SpritePixelBuffer | undefined, spriteW: number, spriteH: number): void {
  canvas.width = THUMB_SIZE;
  canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = THUMB_BG;
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);

  if (!buf) return;

  const scale = Math.min(THUMB_SIZE / spriteW, THUMB_SIZE / spriteH);
  const offX = (THUMB_SIZE - spriteW * scale) / 2;
  const offY = (THUMB_SIZE - spriteH * scale) / 2;

  for (let py = 0; py < spriteH; py++) {
    for (let px = 0; px < spriteW; px++) {
      const i = (py * buf.width + px) * 4;
      const a = buf.data[i + 3];
      if (a === 0) continue;
      ctx.fillStyle = a === 255
        ? `rgb(${buf.data[i]},${buf.data[i + 1]},${buf.data[i + 2]})`
        : `rgba(${buf.data[i]},${buf.data[i + 1]},${buf.data[i + 2]},${a / 255})`;
      ctx.fillRect(
        Math.floor(offX + px * scale),
        Math.floor(offY + py * scale),
        Math.ceil(scale),
        Math.ceil(scale),
      );
    }
  }
}

function FrameThumbnail({ frameId, spriteW, spriteH, buf }: {
  frameId: string;
  spriteW: number;
  spriteH: number;
  buf: SpritePixelBuffer | undefined;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      renderThumbnail(canvasRef.current, buf, spriteW, spriteH);
    }
  }, [buf, spriteW, spriteH]);

  return <canvas ref={canvasRef} className="sprite-frame-thumb-canvas" width={THUMB_SIZE} height={THUMB_SIZE} />;
}

export function SpriteFrameStrip() {
  const doc = useSpriteEditorStore((s) => s.document);
  const pixelBuffers = useSpriteEditorStore((s) => s.pixelBuffers);
  const activeFrameIndex = useSpriteEditorStore((s) => s.activeFrameIndex);
  const setActiveFrame = useSpriteEditorStore((s) => s.setActiveFrame);
  const addFrame = useSpriteEditorStore((s) => s.addFrame);
  const duplicateFrame = useSpriteEditorStore((s) => s.duplicateFrame);
  const removeFrame = useSpriteEditorStore((s) => s.removeFrame);
  const moveFrame = useSpriteEditorStore((s) => s.moveFrame);

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
            <FrameThumbnail
              frameId={frame.id}
              spriteW={doc.width}
              spriteH={doc.height}
              buf={pixelBuffers[frame.id]}
            />
            <span className="sprite-frame-number">{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="sprite-frame-strip-actions">
        <button
          className="sprite-frame-add-btn"
          onClick={addFrame}
          title="Add blank frame after current"
          data-testid="add-frame-btn"
        >
          + Frame
        </button>
        <button
          className="sprite-frame-dup-btn"
          onClick={duplicateFrame}
          title="Duplicate current frame"
          data-testid="duplicate-frame-btn"
        >
          Duplicate
        </button>
        {doc.frames.length > 1 && (
          <>
            <button
              className="sprite-frame-move-btn"
              onClick={() => moveFrame(activeFrameIndex, activeFrameIndex - 1)}
              disabled={activeFrameIndex === 0}
              title="Move frame left"
              data-testid="move-frame-left-btn"
            >
              ◀
            </button>
            <button
              className="sprite-frame-move-btn"
              onClick={() => moveFrame(activeFrameIndex, activeFrameIndex + 1)}
              disabled={activeFrameIndex === doc.frames.length - 1}
              title="Move frame right"
              data-testid="move-frame-right-btn"
            >
              ▶
            </button>
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
          </>
        )}
      </div>
    </div>
  );
}
