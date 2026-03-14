import { useRef, useEffect } from 'react';

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawGrid(ctx, canvas.width, canvas.height);
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    return () => observer.disconnect();
  }, []);

  return (
    <main className="canvas-container">
      <canvas ref={canvasRef} className="pixel-canvas" />
      <div className="canvas-status">
        <span>64×64</span>
        <span>100%</span>
        <span>0, 0</span>
      </div>
    </main>
  );
}

function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#111114';
  ctx.fillRect(0, 0, w, h);

  // Draw a centered 64x64 sprite area with checker pattern
  const pixelSize = 8;
  const gridSize = 64;
  const totalSize = gridSize * pixelSize;
  const startX = Math.floor((w - totalSize) / 2);
  const startY = Math.floor((h - totalSize) / 2);

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const isLight = (x + y) % 2 === 0;
      ctx.fillStyle = isLight ? '#2a2a2e' : '#222226';
      ctx.fillRect(startX + x * pixelSize, startY + y * pixelSize, pixelSize, pixelSize);
    }
  }

  // Border around sprite area
  ctx.strokeStyle = '#3a3a40';
  ctx.lineWidth = 1;
  ctx.strokeRect(startX - 0.5, startY - 0.5, totalSize + 1, totalSize + 1);
}
