import { useCallback, useRef, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useReferenceStore } from '@glyphstudio/state';
import type { ReferenceImage } from '@glyphstudio/state';

function basename(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const file = parts[parts.length - 1] ?? 'reference';
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

function ReferenceImageRow({ image }: { image: ReferenceImage }) {
  const setOpacity = useReferenceStore((s) => s.setOpacity);
  const setScale = useReferenceStore((s) => s.setScale);
  const toggleVisible = useReferenceStore((s) => s.toggleVisible);
  const toggleLocked = useReferenceStore((s) => s.toggleLocked);
  const removeImage = useReferenceStore((s) => s.removeImage);
  const setActiveImage = useReferenceStore((s) => s.setActiveImage);
  const activeImageId = useReferenceStore((s) => s.activeImageId);

  const isActive = activeImageId === image.id;
  const [imgError, setImgError] = useState(false);

  return (
    <div
      className={`ref-image-row ${isActive ? 'active' : ''}`}
      onClick={() => setActiveImage(image.id)}
    >
      <div className="ref-image-preview">
        {imgError ? (
          <span className="ref-image-fallback">?</span>
        ) : (
          <img
            src={convertFileSrc(image.filePath)}
            alt={image.name}
            draggable={false}
            onError={() => setImgError(true)}
          />
        )}
      </div>

      <div className="ref-image-controls">
        <div className="ref-image-name-row">
          <span className="ref-image-name" title={image.filePath}>
            {image.name}
          </span>
          <div className="ref-image-actions">
            <button
              className={`ref-btn ${image.visible ? '' : 'off'}`}
              onClick={(e) => { e.stopPropagation(); toggleVisible(image.id); }}
              title={image.visible ? 'Hide' : 'Show'}
            >
              {image.visible ? 'V' : '-'}
            </button>
            <button
              className={`ref-btn ${image.locked ? 'on' : ''}`}
              onClick={(e) => { e.stopPropagation(); toggleLocked(image.id); }}
              title={image.locked ? 'Unlock' : 'Lock'}
            >
              L
            </button>
            <button
              className="ref-btn danger"
              onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
              title="Remove"
            >
              X
            </button>
          </div>
        </div>

        <label className="ref-slider-label">
          Opacity
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(image.opacity * 100)}
            onChange={(e) => setOpacity(image.id, Number(e.target.value) / 100)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="ref-slider-value">{Math.round(image.opacity * 100)}%</span>
        </label>

        <label className="ref-slider-label">
          Scale
          <input
            type="range"
            min={10}
            max={500}
            value={Math.round(image.scale * 100)}
            onChange={(e) => setScale(image.id, Number(e.target.value) / 100)}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="ref-slider-value">{Math.round(image.scale * 100)}%</span>
        </label>
      </div>
    </div>
  );
}

export function ReferencePanel() {
  const images = useReferenceStore((s) => s.images);
  const addImage = useReferenceStore((s) => s.addImage);
  const clearAll = useReferenceStore((s) => s.clearAll);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      setError('');

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // webkitRelativePath gives full path in Tauri file inputs
        const path = (file as File & { path?: string }).path ?? file.name;
        if (!path) {
          setError('Could not read file path');
          continue;
        }
        addImage(path, basename(path));
      }

      // Reset so the same file can be re-imported
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addImage],
  );

  return (
    <div className="reference-panel">
      <div className="ref-panel-header">
        <span className="ref-panel-title">REFERENCE</span>
        <div className="ref-panel-actions">
          {images.length > 0 && (
            <button
              className="ref-btn danger"
              onClick={clearAll}
              title="Clear all references"
            >
              Clear
            </button>
          )}
          <button
            className="ref-btn primary"
            onClick={() => fileInputRef.current?.click()}
          >
            + Add
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/bmp,image/webp"
        multiple
        onChange={handleImport}
        style={{ display: 'none' }}
      />

      {error && <div className="ref-error">{error}</div>}

      {images.length === 0 ? (
        <div className="ref-empty">
          <p>No reference images.</p>
          <p className="ref-empty-hint">
            Import reference images to guide your sprite design.
            References are visible while drawing but excluded from export.
          </p>
        </div>
      ) : (
        <div className="ref-image-list">
          {images.map((img) => (
            <ReferenceImageRow key={img.id} image={img} />
          ))}
        </div>
      )}
    </div>
  );
}
