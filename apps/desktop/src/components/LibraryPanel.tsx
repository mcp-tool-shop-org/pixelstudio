import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { buildLibraryIndex, filterLibraryItems, groupByKind } from '@glyphstudio/state';
import type { LibraryItem, LibraryItemKind } from '@glyphstudio/state';
import type { PartLibrary } from '@glyphstudio/domain';
import { loadPartLibrary } from '../lib/partLibraryStorage';

function rgbaToHex(rgba: [number, number, number, number]): string {
  return `#${rgba.slice(0, 3).map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** Tiny canvas thumbnail for a part. */
function PartThumb({ item }: { item: LibraryItem }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !item.pixelData || !item.width || !item.height) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 24;
    canvas.width = size;
    canvas.height = size;
    ctx.clearRect(0, 0, size, size);

    // Checker
    for (let y = 0; y < size; y += 4) {
      for (let x = 0; x < size; x += 4) {
        ctx.fillStyle = ((x / 4 + y / 4) % 2 === 0) ? '#3a3a3a' : '#2a2a2a';
        ctx.fillRect(x, y, 4, 4);
      }
    }

    if (item.pixelData.length === item.width * item.height * 4 && typeof ImageData !== 'undefined') {
      const tmp = document.createElement('canvas');
      tmp.width = item.width;
      tmp.height = item.height;
      const tmpCtx = tmp.getContext('2d');
      if (tmpCtx) {
        tmpCtx.putImageData(new ImageData(new Uint8ClampedArray(item.pixelData), item.width, item.height), 0, 0);
        ctx.imageSmoothingEnabled = false;
        const scale = Math.min(size / item.width, size / item.height);
        const w = item.width * scale;
        const h = item.height * scale;
        ctx.drawImage(tmp, (size - w) / 2, (size - h) / 2, w, h);
      }
    }
  }, [item.pixelData, item.width, item.height]);

  return <canvas ref={canvasRef} className="lib-part-thumb" />;
}

/** Color swatch strip for a palette set. */
function SwatchStrip({ colors, count }: { colors: [number, number, number, number][]; count: number }) {
  return (
    <div className="lib-swatch-strip">
      {colors.map((c, i) => (
        <span key={i} className="lib-swatch" style={{ backgroundColor: rgbaToHex(c) }} />
      ))}
      {count > colors.length && (
        <span className="lib-swatch-more">+{count - colors.length}</span>
      )}
    </div>
  );
}

function LibraryItemRow({ item, onClick }: { item: LibraryItem; onClick: () => void }) {
  return (
    <div
      className={`lib-item${item.isActive ? ' active' : ''}`}
      onClick={onClick}
      data-testid={`lib-item-${item.id}`}
    >
      {item.kind === 'part' && <PartThumb item={item} />}
      {item.kind === 'palette-set' && item.swatchColors && (
        <SwatchStrip colors={item.swatchColors} count={item.colorCount ?? 0} />
      )}
      {item.kind === 'variant' && (
        <span className="lib-variant-icon">&#x25A3;</span>
      )}
      <div className="lib-item-info">
        <span className="lib-item-name">{item.name}</span>
        <span className="lib-item-meta">
          {item.kind === 'part' && `${item.width}x${item.height}`}
          {item.kind === 'palette-set' && `${item.colorCount} colors`}
          {item.kind === 'variant' && `${item.frameCount} frame${item.frameCount !== 1 ? 's' : ''}`}
        </span>
      </div>
      {item.isActive && <span className="lib-active-badge">Active</span>}
    </div>
  );
}

function LibrarySection({
  title,
  items,
  onItemClick,
  collapsed,
  onToggle,
}: {
  title: string;
  items: LibraryItem[];
  onItemClick: (item: LibraryItem) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="lib-section" data-testid={`lib-section-${title.toLowerCase().replace(/\s/g, '-')}`}>
      <button className="lib-section-header" onClick={onToggle}>
        <span className="lib-section-arrow">{collapsed ? '\u25B6' : '\u25BC'}</span>
        <span className="lib-section-title">{title}</span>
        <span className="lib-section-count">{items.length}</span>
      </button>
      {!collapsed && (
        <div className="lib-section-list">
          {items.map((item) => (
            <LibraryItemRow key={item.id} item={item} onClick={() => onItemClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LibraryPanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const activeStampPartId = useSpriteEditorStore((s) => s.activeStampPartId);
  const setActiveStampPart = useSpriteEditorStore((s) => s.setActiveStampPart);
  const previewPaletteSet = useSpriteEditorStore((s) => s.previewPaletteSet);
  const switchToVariant = useSpriteEditorStore((s) => s.switchToVariant);

  const activePaletteSetId = doc?.activePaletteSetId ?? null;
  const activeVariantId = doc?.activeVariantId ?? null;

  const [partLibrary] = useState<PartLibrary>(() => loadPartLibrary());
  const [query, setQuery] = useState('');
  const [activeKinds, setActiveKinds] = useState<Set<LibraryItemKind>>(
    new Set(['part', 'palette-set', 'variant']),
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const allItems = useMemo(
    () => buildLibraryIndex(doc, partLibrary, activeStampPartId, activePaletteSetId, activeVariantId),
    [doc, partLibrary, activeStampPartId, activePaletteSetId, activeVariantId],
  );

  const filtered = useMemo(
    () => filterLibraryItems(allItems, query, activeKinds),
    [allItems, query, activeKinds],
  );

  const groups = useMemo(() => groupByKind(filtered), [filtered]);

  const toggleKind = useCallback((kind: LibraryItemKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind); // keep at least one active
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) { next.delete(section); } else { next.add(section); }
      return next;
    });
  }, []);

  const handleItemClick = useCallback((item: LibraryItem) => {
    switch (item.kind) {
      case 'part':
        setActiveStampPart(activeStampPartId === item.id ? null : item.id);
        break;
      case 'palette-set':
        previewPaletteSet(item.id);
        break;
      case 'variant':
        switchToVariant(activeVariantId === item.id ? null : item.id);
        break;
    }
  }, [setActiveStampPart, previewPaletteSet, switchToVariant, activeStampPartId, activeVariantId]);

  if (!doc) {
    return (
      <div className="lib-panel">
        <div className="lib-empty">No document open</div>
      </div>
    );
  }

  const totalCount = allItems.length;

  return (
    <div className="lib-panel" data-testid="library-panel">
      {/* Search */}
      <div className="lib-search-bar">
        <input
          className="lib-search-input"
          type="text"
          placeholder="Search assets..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="lib-search"
        />
      </div>

      {/* Type filters */}
      <div className="lib-filters">
        {(['part', 'palette-set', 'variant'] as LibraryItemKind[]).map((kind) => (
          <button
            key={kind}
            className={`lib-filter-btn${activeKinds.has(kind) ? ' active' : ''}`}
            onClick={() => toggleKind(kind)}
            data-testid={`lib-filter-${kind}`}
          >
            {kind === 'part' ? 'Parts' : kind === 'palette-set' ? 'Palettes' : 'Variants'}
          </button>
        ))}
      </div>

      {/* Sections */}
      {totalCount === 0 ? (
        <div className="lib-empty">No authored assets yet.</div>
      ) : filtered.length === 0 ? (
        <div className="lib-empty">No matches.</div>
      ) : (
        <div className="lib-sections">
          <LibrarySection
            title="Parts"
            items={groups['part']}
            onItemClick={handleItemClick}
            collapsed={collapsedSections.has('Parts')}
            onToggle={() => toggleSection('Parts')}
          />
          <LibrarySection
            title="Palette Sets"
            items={groups['palette-set']}
            onItemClick={handleItemClick}
            collapsed={collapsedSections.has('Palette Sets')}
            onToggle={() => toggleSection('Palette Sets')}
          />
          <LibrarySection
            title="Variants"
            items={groups['variant']}
            onItemClick={handleItemClick}
            collapsed={collapsedSections.has('Variants')}
            onToggle={() => toggleSection('Variants')}
          />
        </div>
      )}
    </div>
  );
}
