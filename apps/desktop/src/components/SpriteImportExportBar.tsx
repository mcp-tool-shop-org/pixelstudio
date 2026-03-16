import { useRef, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { pixelBufferToPngBlob, decodeImageFile, downloadBlob } from '../lib/spriteFileHelpers';

/**
 * Import/export controls for the sprite editor.
 *
 * - Import sprite sheet: reads a PNG, slices into frames
 * - Export sprite sheet: assembles frames into a horizontal strip PNG
 * - Export sheet + JSON: sprite sheet PNG + metadata manifest
 * - Export GIF: animated GIF with authored durations
 * - Export current frame: exports the active frame as a standalone PNG
 */
export function SpriteImportExportBar() {
  const doc = useSpriteEditorStore((s) => s.document);
  const importSpriteSheet = useSpriteEditorStore((s) => s.importSpriteSheet);
  const exportSpriteSheet = useSpriteEditorStore((s) => s.exportSpriteSheet);
  const exportCurrentFrame = useSpriteEditorStore((s) => s.exportCurrentFrame);
  const exportSheetWithMeta = useSpriteEditorStore((s) => s.exportSheetWithMeta);
  const exportGif = useSpriteEditorStore((s) => s.exportGif);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!doc) return null;

  const safeName = doc.name.replace(/[^a-zA-Z0-9_-]/g, '_');

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const decoded = await decodeImageFile(file);
      const err = importSpriteSheet(decoded.data, decoded.width, decoded.height);
      if (err) {
        setError(err);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to import image');
    }

    // Reset file input so the same file can be re-imported
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportSheet = async () => {
    setError(null);
    const result = exportSpriteSheet();
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    try {
      const blob = await pixelBufferToPngBlob(result);
      downloadBlob(blob, `${safeName}-sheet.png`);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to export sprite sheet');
    }
  };

  const handleExportSheetWithMeta = async () => {
    setError(null);
    const result = exportSheetWithMeta();
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    try {
      // Download PNG sheet
      const blob = await pixelBufferToPngBlob(result.sheet);
      downloadBlob(blob, `${safeName}-sheet.png`);

      // Download JSON metadata
      const json = JSON.stringify(result.meta, null, 2);
      const metaBlob = new Blob([json], { type: 'application/json' });
      downloadBlob(metaBlob, `${safeName}-sheet.json`);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to export sheet with metadata');
    }
  };

  const handleExportGif = () => {
    setError(null);
    const result = exportGif();
    if (typeof result === 'string') {
      setError(result);
      return;
    }
    const blob = new Blob([result], { type: 'image/gif' });
    downloadBlob(blob, `${safeName}.gif`);
  };

  const handleExportFrame = async () => {
    setError(null);
    const buf = exportCurrentFrame();
    if (!buf) {
      setError('No frame to export');
      return;
    }
    try {
      const blob = await pixelBufferToPngBlob(buf);
      const frameIdx = useSpriteEditorStore.getState().activeFrameIndex;
      const frameNum = String(frameIdx + 1).padStart(2, '0');
      downloadBlob(blob, `${safeName}-frame-${frameNum}.png`);
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to export frame');
    }
  };

  return (
    <div className="sprite-import-export-bar" data-testid="sprite-import-export-bar">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/gif,image/bmp,image/webp"
        onChange={handleImport}
        style={{ display: 'none' }}
        data-testid="sprite-import-input"
      />
      <button
        className="sprite-import-btn"
        onClick={() => fileInputRef.current?.click()}
        title="Import sprite sheet"
        data-testid="sprite-import-btn"
      >
        Import Sheet
      </button>
      <button
        className="sprite-export-sheet-btn"
        onClick={handleExportSheet}
        title="Export as sprite sheet PNG"
        data-testid="sprite-export-sheet-btn"
      >
        Export Sheet
      </button>
      <button
        className="sprite-export-meta-btn"
        onClick={handleExportSheetWithMeta}
        title="Export sprite sheet PNG + JSON metadata"
        data-testid="sprite-export-meta-btn"
      >
        Export Sheet + JSON
      </button>
      <button
        className="sprite-export-gif-btn"
        onClick={handleExportGif}
        title="Export as animated GIF"
        data-testid="sprite-export-gif-btn"
      >
        Export GIF
      </button>
      <button
        className="sprite-export-frame-btn"
        onClick={handleExportFrame}
        title="Export current frame as PNG"
        data-testid="sprite-export-frame-btn"
      >
        Export Frame
      </button>
      {error && (
        <span className="sprite-import-export-error" data-testid="sprite-import-export-error">
          {error}
        </span>
      )}
    </div>
  );
}
