import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { buildLibraryIndex, filterLibraryItems, groupByKind, sortWithPriority, sortLibraryItems } from '@glyphstudio/state';
import { useLibraryStore } from '@glyphstudio/state';
import type { LibraryItem, LibraryItemKind, LibraryViewMode, LibrarySortMode } from '@glyphstudio/state';
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

function LibraryItemRow({
  item,
  onClick,
  onTogglePin,
  isFocused,
}: {
  item: LibraryItem;
  onClick: () => void;
  onTogglePin: () => void;
  isFocused?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isFocused]);

  return (
    <div
      ref={rowRef}
      className={`lib-item${item.isActive ? ' active' : ''}${item.isPinned ? ' pinned' : ''}${isFocused ? ' focused' : ''}`}
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
      <button
        className={`lib-pin-btn${item.isPinned ? ' pinned' : ''}`}
        onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
        title={item.isPinned ? 'Unpin' : 'Pin'}
        data-testid={`lib-pin-${item.id}`}
      >
        {item.isPinned ? '\u2759' : '\u25CB'}
      </button>
    </div>
  );
}

function LibrarySection({
  title,
  items,
  onItemClick,
  onTogglePin,
  collapsed,
  onToggle,
  focusedId,
}: {
  title: string;
  items: LibraryItem[];
  onItemClick: (item: LibraryItem) => void;
  onTogglePin: (id: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  focusedId: string | null;
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
            <LibraryItemRow
              key={item.id}
              item={item}
              onClick={() => onItemClick(item)}
              onTogglePin={() => onTogglePin(item.id)}
              isFocused={focusedId === item.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Flat list for Recent/Pinned view modes. */
function FlatList({
  items,
  onItemClick,
  onTogglePin,
  focusedId,
}: {
  items: LibraryItem[];
  onItemClick: (item: LibraryItem) => void;
  onTogglePin: (id: string) => void;
  focusedId: string | null;
}) {
  if (items.length === 0) {
    return <div className="lib-empty">Nothing here yet.</div>;
  }

  return (
    <div className="lib-flat-list">
      {items.map((item) => (
        <LibraryItemRow
          key={item.id}
          item={item}
          onClick={() => onItemClick(item)}
          onTogglePin={() => onTogglePin(item.id)}
          isFocused={focusedId === item.id}
        />
      ))}
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

  const pinnedIds = useLibraryStore((s) => s.pinnedIds);
  const recentIds = useLibraryStore((s) => s.recentIds);
  const viewMode = useLibraryStore((s) => s.viewMode);
  const pushRecent = useLibraryStore((s) => s.pushRecent);
  const togglePin = useLibraryStore((s) => s.togglePin);
  const setViewMode = useLibraryStore((s) => s.setViewMode);

  const [partLibrary] = useState<PartLibrary>(() => loadPartLibrary());
  const [query, setQuery] = useState('');
  const [activeKinds, setActiveKinds] = useState<Set<LibraryItemKind>>(
    new Set(['part', 'palette-set', 'variant']),
  );
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [sortMode, setSortMode] = useState<LibrarySortMode>('priority');
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const allItems = useMemo(
    () => buildLibraryIndex(doc, partLibrary, activeStampPartId, activePaletteSetId, activeVariantId, pinnedIds, recentIds),
    [doc, partLibrary, activeStampPartId, activePaletteSetId, activeVariantId, pinnedIds, recentIds],
  );

  const filtered = useMemo(
    () => filterLibraryItems(allItems, query, activeKinds),
    [allItems, query, activeKinds],
  );

  const sortedFiltered = useMemo(() => sortLibraryItems(filtered, sortMode), [filtered, sortMode]);

  const groups = useMemo(() => groupByKind(sortedFiltered), [sortedFiltered]);

  // View-mode filtered lists (must be before flatVisibleItems)
  const recentItems = useMemo(
    () => {
      // Maintain recent order from recentIds
      const itemMap = new Map(allItems.map((i) => [i.id, i]));
      return recentIds.map((id) => itemMap.get(id)).filter((i): i is LibraryItem => !!i);
    },
    [allItems, recentIds],
  );

  const pinnedItems = useMemo(
    () => allItems.filter((i) => i.isPinned),
    [allItems],
  );

  // Flat list of all visible items for keyboard navigation
  const flatVisibleItems = useMemo((): LibraryItem[] => {
    if (viewMode === 'recent') return recentItems;
    if (viewMode === 'pinned') return pinnedItems;
    return [...groups['part'], ...groups['palette-set'], ...groups['variant']];
  }, [viewMode, recentItems, pinnedItems, groups]);

  const toggleKind = useCallback((kind: LibraryItemKind) => {
    setActiveKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        if (next.size > 1) next.delete(kind);
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
    pushRecent(item.id);
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
  }, [setActiveStampPart, previewPaletteSet, switchToVariant, activeStampPartId, activeVariantId, pushRecent]);

  // Reset focused index when results change
  useEffect(() => { setFocusedIndex(-1); }, [sortedFiltered.length, query, viewMode]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.min(prev + 1, flatVisibleItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => Math.max(prev - 1, -1));
      if (focusedIndex <= 0) searchRef.current?.focus();
    } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < flatVisibleItems.length) {
      e.preventDefault();
      handleItemClick(flatVisibleItems[focusedIndex]);
    }
  }, [flatVisibleItems, focusedIndex, handleItemClick]);

  // Focus search on panel mount or Ctrl+F
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const panel = panelRef.current;
        if (panel && panel.offsetParent !== null) {
          e.preventDefault();
          searchRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKey);
    return () => document.removeEventListener('keydown', handleGlobalKey);
  }, []);

  if (!doc) {
    return (
      <div className="lib-panel">
        <div className="lib-empty">No document open</div>
      </div>
    );
  }

  const totalCount = allItems.length;

  return (
    <div className="lib-panel" data-testid="library-panel" ref={panelRef} onKeyDown={handleKeyDown}>
      {/* Search */}
      <div className="lib-search-bar">
        <input
          ref={searchRef}
          className="lib-search-input"
          type="text"
          placeholder="Search assets..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setFocusedIndex(0);
            }
          }}
          data-testid="lib-search"
        />
      </div>

      {/* View mode + Type filters */}
      <div className="lib-toolbar">
        <div className="lib-view-modes">
          {(['all', 'recent', 'pinned'] as LibraryViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`lib-view-btn${viewMode === mode ? ' active' : ''}`}
              onClick={() => setViewMode(mode)}
              data-testid={`lib-view-${mode}`}
            >
              {mode === 'all' ? 'All' : mode === 'recent' ? 'Recent' : 'Pinned'}
            </button>
          ))}
        </div>
        {viewMode === 'all' && (
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
        )}
        <div className="lib-sort-row">
          <span className="lib-sort-label">Sort:</span>
          {(['priority', 'name', 'recent'] as LibrarySortMode[]).map((mode) => (
            <button
              key={mode}
              className={`lib-sort-btn${sortMode === mode ? ' active' : ''}`}
              onClick={() => setSortMode(mode)}
              data-testid={`lib-sort-${mode}`}
            >
              {mode === 'priority' ? 'Default' : mode === 'name' ? 'A-Z' : 'Latest'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {(() => {
        const focusedId = focusedIndex >= 0 && focusedIndex < flatVisibleItems.length
          ? flatVisibleItems[focusedIndex].id : null;

        if (totalCount === 0) {
          return <div className="lib-empty">No authored assets yet.</div>;
        }
        if (viewMode === 'recent') {
          return <FlatList items={recentItems} onItemClick={handleItemClick} onTogglePin={togglePin} focusedId={focusedId} />;
        }
        if (viewMode === 'pinned') {
          return <FlatList items={pinnedItems} onItemClick={handleItemClick} onTogglePin={togglePin} focusedId={focusedId} />;
        }
        if (filtered.length === 0) {
          return <div className="lib-empty">No matches.</div>;
        }
        return (
          <div className="lib-sections">
            <LibrarySection
              title="Parts"
              items={groups['part']}
              onItemClick={handleItemClick}
              onTogglePin={togglePin}
              collapsed={collapsedSections.has('Parts')}
              onToggle={() => toggleSection('Parts')}
              focusedId={focusedId}
            />
            <LibrarySection
              title="Palette Sets"
              items={groups['palette-set']}
              onItemClick={handleItemClick}
              onTogglePin={togglePin}
              collapsed={collapsedSections.has('Palette Sets')}
              onToggle={() => toggleSection('Palette Sets')}
              focusedId={focusedId}
            />
            <LibrarySection
              title="Variants"
              items={groups['variant']}
              onItemClick={handleItemClick}
              onTogglePin={togglePin}
              collapsed={collapsedSections.has('Variants')}
              onToggle={() => toggleSection('Variants')}
              focusedId={focusedId}
            />
          </div>
        );
      })()}
    </div>
  );
}
