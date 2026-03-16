import { useRef, useState } from 'react';
import { useSpriteEditorStore, serializeSpriteFile } from '@glyphstudio/state';
import {
  pixelBufferToPngBlob,
  decodeImageFile,
  downloadBlob,
  saveSpriteFile,
  saveSpriteFileAs,
  openSpriteFile,
} from '../lib/spriteFileHelpers';

/**
 * Import/export controls for the sprite editor.
 *
 * - Save / Open / Save As: native .glyph file persistence
 * - Import sprite sheet: reads a PNG, slices into frames
 * - Export sprite sheet: assembles frames into a horizontal strip PNG
 * - Export sheet + JSON: sprite sheet PNG + metadata manifest
 * - Export GIF: animated GIF with authored durations
 * - Export current frame: exports the active frame as a standalone PNG
 */
export function SpriteImportExportBar() {
  const doc = useSpriteEditorStore((s) => s.document);
  const dirty = useSpriteEditorStore((s) => s.dirty);
  const filePath = useSpriteEditorStore((s) => s.filePath);
  const importSpriteSheet = useSpriteEditorStore((s) => s.importSpriteSheet);
  const exportSpriteSheet = useSpriteEditorStore((s) => s.exportSpriteSheet);
  const exportCurrentFrame = useSpriteEditorStore((s) => s.exportCurrentFrame);
  const exportSheetWithMeta = useSpriteEditorStore((s) => s.exportSheetWithMeta);
  const exportGif = useSpriteEditorStore((s) => s.exportGif);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  if (!doc) return null;

  const safeName = doc.name.replace(/[^a-zA-Z0-9_-]/g, '_');

  // ── Persistence ──

  const handleSave = async () => {
    setError(null);
    const state = useSpriteEditorStore.getState();
    if (!state.document) return;

    const json = serializeSpriteFile(state.document, state.pixelBuffers);
    try {
      const savedPath = await saveSpriteFile(json, state.filePath);
      if (savedPath) {
        useSpriteEditorStore.setState({ filePath: savedPath, dirty: false });
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to save');
    }
  };

  const handleSaveAs = async () => {
    setError(null);
    const state = useSpriteEditorStore.getState();
    if (!state.document) return;

    const json = serializeSpriteFile(state.document, state.pixelBuffers);
    try {
      const savedPath = await saveSpriteFileAs(json);
      if (savedPath) {
        useSpriteEditorStore.setState({ filePath: savedPath, dirty: false });
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to save');
    }
  };

  const handleOpen = async () => {
    setError(null);
    try {
      const result = await openSpriteFile();
      if (!result) return;

      const err = useSpriteEditorStore.getState().loadDocument(result.json, result.filePath);
      if (err) {
        setError(err);
      }
    } catch (ex) {
      setError(ex instanceof Error ? ex.message : 'Failed to open file');
    }
  };

  // ── Import/Export ──

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
      {/* Persistence */}
      <button
        className="sprite-save-btn"
        onClick={handleSave}
        title={filePath ? `Save to ${filePath}` : 'Save sprite (Ctrl+S)'}
        data-testid="sprite-save-btn"
      >
        {dirty ? 'Save *' : 'Save'}
      </button>
      <button
        className="sprite-save-as-btn"
        onClick={handleSaveAs}
        title="Save as new file (Ctrl+Shift+S)"
        data-testid="sprite-save-as-btn"
      >
        Save As
      </button>
      <button
        className="sprite-open-btn"
        onClick={handleOpen}
        title="Open sprite file (Ctrl+O)"
        data-testid="sprite-open-btn"
      >
        Open
      </button>

      {/* Separator */}
      <span className="sprite-toolbar-separator" aria-hidden="true">|</span>

      {/* Import/Export */}
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
