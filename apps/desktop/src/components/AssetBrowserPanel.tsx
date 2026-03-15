import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import type {
  AssetSummary, AssetKind, AssetStatus,
  CatalogBundlePreviewResult, CatalogBundleExportResult,
  ExportBundleFormat,
} from '@glyphstudio/domain';
import { useProjectStore } from '@glyphstudio/state';
import { loadPackagingSettings, savePackagingSettings } from '../lib/packagingSettings';

type SortMode = 'recent' | 'alpha' | 'kind';

export function AssetBrowserPanel() {
  const [savedPkg] = useState(() => loadPackagingSettings());
  const [assets, setAssets] = useState<AssetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<AssetKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<AssetStatus | 'all'>('all');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Multi-select mode
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [catalogPreview, setCatalogPreview] = useState<CatalogBundlePreviewResult | null>(null);
  const [catalogResult, setCatalogResult] = useState<CatalogBundleExportResult | null>(null);
  const [catalogBundleFormat, setCatalogBundleFormat] = useState<ExportBundleFormat>(savedPkg.catalogBundleFormat);
  const [catalogIncludeManifest, setCatalogIncludeManifest] = useState(savedPkg.catalogIncludeManifest);
  const [catalogIncludePreview, setCatalogIncludePreview] = useState(savedPkg.catalogIncludePreview);
  const [packaging, setPackaging] = useState(false);
  const [lastCatalogOutputDir, setLastCatalogOutputDir] = useState<string | null>(null);
  const [catalogPreviewStale, setCatalogPreviewStale] = useState(false);

  const currentFilePath = useProjectStore((s) => s.filePath);
  const projectSaveStatus = useProjectStore((s) => s.saveStatus);
  const markDirty = useProjectStore((s) => s.markDirty);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<AssetSummary[]>('list_assets');
      setAssets(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Auto-refresh when project file path changes (open/save-as) or save completes
  useEffect(() => {
    if (currentFilePath || projectSaveStatus === 'saved') {
      fetchAssets();
    }
  }, [currentFilePath, projectSaveStatus, fetchAssets]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await invoke<AssetSummary[]>('refresh_asset_catalog');
      setAssets(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  const handleRemove = useCallback(async (assetId: string) => {
    try {
      await invoke<boolean>('remove_asset_catalog_entry', { assetId });
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
      markDirty();
      invoke('mark_dirty').catch(() => {});
    } catch (err) {
      console.error('remove_asset_catalog_entry failed:', err);
    }
  }, [markDirty]);

  const handleOpen = useCallback(async (filePath: string) => {
    try {
      await invoke('open_project', { filePath });
    } catch (err) {
      console.error('open_project failed:', err);
    }
  }, []);

  // Derived filtered + sorted list
  const filteredAssets = useMemo(() => {
    let list = assets;

    // Kind filter
    if (kindFilter !== 'all') {
      list = list.filter((a) => a.kind === kindFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter((a) => a.status === statusFilter);
    }

    // Search (name + tags + kind)
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((a) =>
        a.name.toLowerCase().includes(q) ||
        a.kind.includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
    const sorted = [...list];
    switch (sortMode) {
      case 'recent':
        sorted.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        break;
      case 'alpha':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'kind':
        sorted.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
        break;
    }

    return sorted;
  }, [assets, kindFilter, statusFilter, search, sortMode]);

  // Preserve selection across refresh — clear if asset no longer exists
  useEffect(() => {
    if (selectedAssetId && !assets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(null);
      setShowPreview(false);
    }
  }, [assets, selectedAssetId]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const handleSelect = useCallback((assetId: string) => {
    if (multiSelect) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(assetId)) {
          next.delete(assetId);
        } else {
          next.add(assetId);
        }
        return next;
      });
      setCatalogPreview(null);
      setCatalogResult(null);
      return;
    }
    setSelectedAssetId((prev) => {
      if (prev === assetId) {
        setShowPreview((sp) => !sp);
        return prev;
      }
      setShowPreview(true);
      return assetId;
    });
  }, [multiSelect]);

  const toggleMultiSelect = useCallback(() => {
    setMultiSelect((prev) => {
      if (!prev) {
        // Entering multi-select: clear single-select preview
        setShowPreview(false);
      } else {
        // Exiting multi-select: clear selections
        setSelectedIds(new Set());
        setCatalogPreview(null);
        setCatalogResult(null);
      }
      return !prev;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    setSelectedIds(new Set(filteredAssets.map((a) => a.id)));
    setCatalogPreview(null);
    setCatalogResult(null);
  }, [filteredAssets]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setCatalogPreview(null);
    setCatalogResult(null);
  }, []);

  // Preserve multi-select across refresh — remove stale IDs
  useEffect(() => {
    if (selectedIds.size > 0) {
      const validIds = new Set(assets.map((a) => a.id));
      setSelectedIds((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (validIds.has(id)) next.add(id);
        }
        return next.size === prev.size ? prev : next;
      });
    }
  }, [assets]);

  const selectedCount = selectedIds.size;
  const hasMissing = useMemo(
    () => [...selectedIds].some((id) => assets.find((a) => a.id === id)?.status === 'missing'),
    [selectedIds, assets],
  );

  // Count selected assets hidden by current filters
  const hiddenSelectedCount = useMemo(() => {
    if (selectedCount === 0) return 0;
    const visibleIds = new Set(filteredAssets.map((a) => a.id));
    let hidden = 0;
    for (const id of selectedIds) {
      if (!visibleIds.has(id)) hidden++;
    }
    return hidden;
  }, [selectedIds, selectedCount, filteredAssets]);

  // Missing selected asset names for display
  const missingSelectedNames = useMemo(() => {
    if (!hasMissing) return [];
    return [...selectedIds]
      .map((id) => assets.find((a) => a.id === id))
      .filter((a) => a?.status === 'missing')
      .map((a) => a!.name);
  }, [selectedIds, hasMissing, assets]);

  const clearMissingFromSelection = useCallback(() => {
    const missingIds = new Set(
      assets.filter((a) => a.status === 'missing').map((a) => a.id),
    );
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (!missingIds.has(id)) next.add(id);
      }
      return next;
    });
    setCatalogPreview(null);
    setCatalogResult(null);
  }, [assets]);

  // Persist catalog packaging settings on change
  useEffect(() => {
    savePackagingSettings({
      catalogBundleFormat,
      catalogIncludeManifest,
      catalogIncludePreview,
    });
  }, [catalogBundleFormat, catalogIncludeManifest, catalogIncludePreview]);

  // Mark catalog preview stale when settings change
  useEffect(() => {
    if (catalogPreview) setCatalogPreviewStale(true);
  }, [catalogBundleFormat, catalogIncludeManifest, catalogIncludePreview, selectedIds]);

  // Catalog bundle handlers
  const handleCatalogPreview = useCallback(async () => {
    if (selectedCount === 0) return;
    setPackaging(true);
    try {
      const result = await invoke<CatalogBundlePreviewResult>('preview_catalog_bundle', {
        assetIds: [...selectedIds],
        includeManifest: catalogIncludeManifest,
        includePreview: catalogIncludePreview,
      });
      setCatalogPreview(result);
      setCatalogResult(null);
      setCatalogPreviewStale(false);
    } catch (err) {
      setError(String(err));
    }
    setPackaging(false);
  }, [selectedIds, selectedCount, catalogIncludeManifest, catalogIncludePreview]);

  const handleCatalogExport = useCallback(async () => {
    if (selectedCount === 0 || hasMissing) return;
    setPackaging(true);
    try {
      const defaultName = `catalog_bundle_${selectedCount}`;
      const savedDir = savedPkg.lastPackageOutputDir;
      const defaultPath = savedDir ? `${savedDir}/${defaultName}` : defaultName;
      const dirPath = await save({
        title: 'Export Catalog Bundle — Choose output directory',
        defaultPath,
      });
      if (!dirPath) { setPackaging(false); return; }

      const outputDir = dirPath.replace(/[\\/][^\\/]*$/, '');
      const result = await invoke<CatalogBundleExportResult>('export_catalog_bundle', {
        assetIds: [...selectedIds],
        outputPath: outputDir,
        bundleName: `catalog_bundle`,
        format: catalogBundleFormat,
        includeManifest: catalogIncludeManifest,
        includePreview: catalogIncludePreview,
        layout: { type: 'horizontal_strip' as const },
      });
      setCatalogResult(result);
      setLastCatalogOutputDir(outputDir);
      savePackagingSettings({ lastPackageOutputDir: outputDir, lastPackagingMode: 'catalog' });
    } catch (err) {
      setError(String(err));
    }
    setPackaging(false);
  }, [selectedIds, selectedCount, hasMissing, catalogBundleFormat, catalogIncludeManifest, catalogIncludePreview, savedPkg.lastPackageOutputDir]);

  // Package Again — re-run last catalog export without dialog
  const handleCatalogPackageAgain = useCallback(async () => {
    if (!lastCatalogOutputDir || selectedCount === 0 || hasMissing || packaging || catalogPreviewStale) return;
    setPackaging(true);
    try {
      const result = await invoke<CatalogBundleExportResult>('export_catalog_bundle', {
        assetIds: [...selectedIds],
        outputPath: lastCatalogOutputDir,
        bundleName: `catalog_bundle`,
        format: catalogBundleFormat,
        includeManifest: catalogIncludeManifest,
        includePreview: catalogIncludePreview,
        layout: { type: 'horizontal_strip' as const },
      });
      setCatalogResult(result);
    } catch (err) {
      setError(String(err));
    }
    setPackaging(false);
  }, [lastCatalogOutputDir, selectedIds, selectedCount, hasMissing, packaging, catalogPreviewStale, catalogBundleFormat, catalogIncludeManifest, catalogIncludePreview]);

  const canCatalogPackageAgain = !packaging && !!lastCatalogOutputDir && !hasMissing && selectedCount > 0 && !catalogPreviewStale;

  return (
    <div className="asset-browser-panel">
      <div className="asset-browser-header">
        <span className="asset-browser-title">Asset Library</span>
        <div className="asset-browser-header-actions">
          <button
            className={`asset-browser-multi-btn ${multiSelect ? 'active' : ''}`}
            title={multiSelect ? 'Exit multi-select' : 'Multi-select for packaging'}
            onClick={toggleMultiSelect}
          >
            {multiSelect ? 'Done' : 'Select'}
          </button>
          <button className="asset-browser-refresh" title="Refresh catalog" onClick={handleRefresh}>
            {'\u21BB'}
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="asset-browser-controls">
        <input
          type="text"
          className="asset-browser-search"
          placeholder="Search name, tag, kind..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="asset-browser-filters">
          <select
            className="asset-browser-select"
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as AssetKind | 'all')}
          >
            <option value="all">All kinds</option>
            <option value="character">Character</option>
            <option value="prop">Prop</option>
            <option value="environment">Environment</option>
            <option value="effect">Effect</option>
            <option value="ui">UI</option>
            <option value="custom">Custom</option>
          </select>
          <select
            className="asset-browser-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as AssetStatus | 'all')}
          >
            <option value="all">All status</option>
            <option value="ok">OK</option>
            <option value="missing">Missing</option>
          </select>
          <select
            className="asset-browser-select"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value as SortMode)}
          >
            <option value="recent">Recent</option>
            <option value="alpha">A–Z</option>
            <option value="kind">Kind</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="asset-browser-content">
        {loading && <span className="asset-browser-loading">Loading catalog...</span>}
        {error && <span className="asset-browser-error">{error}</span>}
        {!loading && !error && assets.length === 0 && (
          <div className="asset-browser-empty">
            <span>No assets in catalog</span>
            <span className="asset-browser-empty-hint">
              Save a project to add it to the catalog, or use the catalog API to register assets.
            </span>
          </div>
        )}
        {!loading && !error && assets.length > 0 && filteredAssets.length === 0 && (
          <span className="asset-browser-no-match">No assets match current filters</span>
        )}
        {!loading && filteredAssets.map((asset) => (
          <AssetRow
            key={asset.id}
            asset={asset}
            isSelected={multiSelect ? selectedIds.has(asset.id) : selectedAssetId === asset.id}
            isMultiSelect={multiSelect}
            isCurrent={!!currentFilePath && normalizeSlashes(asset.filePath) === normalizeSlashes(currentFilePath)}
            onSelect={handleSelect}
            onOpen={handleOpen}
            onRemove={handleRemove}
          />
        ))}
      </div>

      {/* Multi-select actions bar */}
      {multiSelect && (
        <div className="asset-multi-bar">
          <div className="asset-multi-bar-left">
            <span className="asset-multi-bar-count">
              {selectedCount} selected
              {hiddenSelectedCount > 0 && (
                <span className="asset-multi-bar-hidden" title={`${hiddenSelectedCount} selected asset${hiddenSelectedCount !== 1 ? 's' : ''} hidden by current filters`}>
                  {' '}({hiddenSelectedCount} hidden)
                </span>
              )}
            </span>
            <button className="asset-multi-bar-btn" onClick={selectAllVisible} title="Select all visible assets">
              All
            </button>
            <button className="asset-multi-bar-btn" onClick={clearSelection} disabled={selectedCount === 0} title="Clear selection">
              Clear
            </button>
          </div>
          {selectedCount > 0 && (
            <div className="asset-multi-bar-right">
              {hasMissing && (
                <>
                  <span className="asset-multi-bar-warn" title={missingSelectedNames.join(', ')}>
                    {'\u26A0'} {missingSelectedNames.length} missing
                  </span>
                  <button
                    className="asset-multi-bar-btn"
                    onClick={clearMissingFromSelection}
                    title="Remove missing assets from selection"
                  >
                    Clear missing
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Catalog packaging section */}
      {multiSelect && selectedCount > 0 && (
        <div className="asset-catalog-package">
          <div className="asset-catalog-package-header">Package {selectedCount} asset{selectedCount !== 1 ? 's' : ''}</div>
          <div className="asset-catalog-package-controls">
            <select
              className="asset-browser-select"
              value={catalogBundleFormat}
              onChange={(e) => setCatalogBundleFormat(e.target.value as ExportBundleFormat)}
            >
              <option value="folder">Folder</option>
              <option value="zip">Zip</option>
            </select>
            <label className="asset-catalog-toggle">
              <input type="checkbox" checked={catalogIncludeManifest} onChange={(e) => setCatalogIncludeManifest(e.target.checked)} />
              <span>Manifest</span>
            </label>
            <label className="asset-catalog-toggle">
              <input type="checkbox" checked={catalogIncludePreview} onChange={(e) => setCatalogIncludePreview(e.target.checked)} />
              <span>Preview</span>
            </label>
          </div>
          <div className="asset-catalog-package-actions">
            <button
              className="asset-catalog-package-btn"
              onClick={handleCatalogPreview}
              disabled={packaging}
            >
              Preview
            </button>
            <button
              className="asset-catalog-package-btn asset-catalog-package-btn-export"
              onClick={handleCatalogExport}
              disabled={packaging || hasMissing}
              title={hasMissing ? 'Cannot export — missing assets in selection' : 'Export catalog bundle'}
            >
              {packaging ? 'Exporting...' : 'Export'}
            </button>
            {canCatalogPackageAgain && (
              <button
                className="asset-catalog-package-btn"
                onClick={handleCatalogPackageAgain}
                disabled={packaging}
                title={`Re-export to ${lastCatalogOutputDir}`}
              >
                Package Again
              </button>
            )}
          </div>

          {/* Stale preview hint */}
          {catalogPreview && catalogPreviewStale && (
            <div className="asset-catalog-stale-hint">Settings changed — preview again to package</div>
          )}

          {/* Catalog preview */}
          {catalogPreview && (
            <div className="asset-catalog-preview">
              <div className="asset-catalog-preview-summary">
                {catalogPreview.assets.length} asset{catalogPreview.assets.length !== 1 ? 's' : ''}, {catalogPreview.totalFiles} file{catalogPreview.totalFiles !== 1 ? 's' : ''}
              </div>
              {catalogPreview.assets.map((entry) => (
                <div key={entry.assetId} className={`asset-catalog-preview-row ${entry.status !== 'ok' ? 'asset-catalog-preview-row-warn' : ''}`}>
                  <span className="asset-catalog-preview-name">{entry.assetName}</span>
                  <span className="asset-catalog-preview-status">
                    {entry.status === 'ok' ? `${entry.fileCount} files` : entry.status}
                  </span>
                  {entry.warnings.length > 0 && (
                    <span className="asset-catalog-preview-warnings" title={entry.warnings.join('; ')}>{'\u26A0'}</span>
                  )}
                </div>
              ))}
              {catalogPreview.warnings.length > 0 && (
                <div className="asset-catalog-preview-global-warn">
                  {catalogPreview.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Catalog export result */}
          {catalogResult && (
            <div className="asset-catalog-result">
              <div className="asset-catalog-result-summary">
                Exported {catalogResult.assetCount} asset{catalogResult.assetCount !== 1 ? 's' : ''}
                {catalogResult.skippedCount > 0 && ` (${catalogResult.skippedCount} skipped)`}
                {' — '}{formatBytes(catalogResult.totalBytes)}
              </div>
              <div className="asset-catalog-result-path" title={catalogResult.outputPath}>
                {catalogResult.outputPath}
              </div>
              {catalogResult.warnings.length > 0 && (
                <div className="asset-catalog-preview-global-warn">
                  {catalogResult.warnings.map((w, i) => <div key={i}>{w}</div>)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Quick preview pane */}
      {showPreview && selectedAsset && (
        <AssetPreviewPane
          asset={selectedAsset}
          isCurrent={!!currentFilePath && normalizeSlashes(selectedAsset.filePath) === normalizeSlashes(currentFilePath)}
          onOpen={handleOpen}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Footer stats */}
      {!loading && assets.length > 0 && (
        <div className="asset-browser-footer">
          <span>{filteredAssets.length} of {assets.length} assets</span>
          {assets.some((a) => a.status === 'missing') && (
            <span className="asset-browser-missing-count">
              {assets.filter((a) => a.status === 'missing').length} missing
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function AssetRow({
  asset,
  isSelected,
  isMultiSelect,
  isCurrent,
  onSelect,
  onOpen,
  onRemove,
}: {
  asset: AssetSummary;
  isSelected: boolean;
  isMultiSelect: boolean;
  isCurrent: boolean;
  onSelect: (assetId: string) => void;
  onOpen: (filePath: string) => void;
  onRemove: (assetId: string) => void;
}) {
  const isMissing = asset.status === 'missing';
  const updatedLabel = formatRelativeDate(asset.updatedAt);

  return (
    <div
      className={`asset-row ${isMissing ? 'asset-row-missing' : ''} ${isCurrent ? 'asset-row-current' : ''} ${isSelected ? 'asset-row-selected' : ''}`}
      onClick={() => onSelect(asset.id)}
    >
      {isMultiSelect && (
        <div className="asset-row-checkbox">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(asset.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className="asset-row-thumb">
        <AssetThumbnail thumbnailPath={asset.thumbnailPath} kind={asset.kind} />
      </div>
      <div className="asset-row-info">
        <div className="asset-row-name-line">
          <span className="asset-row-name">{asset.name}</span>
          {isCurrent && <span className="asset-row-current-badge">Open</span>}
          {isMissing && <span className="asset-row-status-badge" title="Project file not found">{'\u26A0'} Missing</span>}
        </div>
        <div className="asset-row-meta">
          <span>{asset.canvasWidth}x{asset.canvasHeight}</span>
          <span>{asset.frameCount}f</span>
          {asset.clipCount > 0 && <span>{asset.clipCount} clip{asset.clipCount !== 1 ? 's' : ''}</span>}
          <span>{updatedLabel}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="asset-row-tags">
            {asset.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="asset-row-tag">{tag}</span>
            ))}
            {asset.tags.length > 6 && <span className="asset-row-tag">+{asset.tags.length - 6}</span>}
          </div>
        )}
      </div>
      {!isMultiSelect && (
        <div className="asset-row-actions">
          <button
            className="asset-row-btn"
            onClick={(e) => { e.stopPropagation(); onOpen(asset.filePath); }}
            disabled={isMissing}
            title={isMissing ? 'File not found — cannot open' : 'Open project'}
          >
            Open
          </button>
          <button
            className="asset-row-btn asset-row-btn-remove"
            onClick={(e) => { e.stopPropagation(); onRemove(asset.id); }}
            title="Remove from catalog (file not deleted)"
          >
            {'\u00D7'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Renders a thumbnail image or kind-badge placeholder. */
function AssetThumbnail({ thumbnailPath, kind }: { thumbnailPath: string | null; kind: AssetKind }) {
  const [failed, setFailed] = useState(false);

  if (!thumbnailPath || failed) {
    return <span className="asset-row-kind-badge">{kindLabel(kind)}</span>;
  }

  const src = convertFileSrc(thumbnailPath);
  return (
    <img
      className="asset-row-thumb-img"
      src={src}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

/** Quick preview pane for the selected asset. */
function AssetPreviewPane({
  asset,
  isCurrent,
  onOpen,
  onClose,
}: {
  asset: AssetSummary;
  isCurrent: boolean;
  onOpen: (filePath: string) => void;
  onClose: () => void;
}) {
  const isMissing = asset.status === 'missing';
  const [thumbFailed, setThumbFailed] = useState(false);
  const prevIdRef = useRef(asset.id);

  // Reset thumb error when selection changes
  if (prevIdRef.current !== asset.id) {
    prevIdRef.current = asset.id;
    setThumbFailed(false);
  }

  const thumbSrc = asset.thumbnailPath && !thumbFailed
    ? convertFileSrc(asset.thumbnailPath)
    : null;

  return (
    <div className="asset-preview-pane">
      <div className="asset-preview-header">
        <span className="asset-preview-title">{asset.name}</span>
        <button className="asset-preview-close" onClick={onClose} title="Close preview">{'\u00D7'}</button>
      </div>

      <div className="asset-preview-thumb-area">
        {thumbSrc ? (
          <img
            className="asset-preview-thumb-img"
            src={thumbSrc}
            alt={asset.name}
            draggable={false}
            onError={() => setThumbFailed(true)}
          />
        ) : (
          <div className="asset-preview-no-thumb">
            <span className="asset-preview-kind-label">{kindLabel(asset.kind)}</span>
            <span className="asset-preview-no-thumb-hint">No thumbnail</span>
          </div>
        )}
      </div>

      <div className="asset-preview-details">
        <div className="asset-preview-detail-row">
          <span className="asset-preview-label">Kind</span>
          <span>{asset.kind}</span>
        </div>
        <div className="asset-preview-detail-row">
          <span className="asset-preview-label">Canvas</span>
          <span>{asset.canvasWidth} × {asset.canvasHeight}</span>
        </div>
        <div className="asset-preview-detail-row">
          <span className="asset-preview-label">Frames</span>
          <span>{asset.frameCount}</span>
        </div>
        {asset.clipCount > 0 && (
          <div className="asset-preview-detail-row">
            <span className="asset-preview-label">Clips</span>
            <span>{asset.clipCount}</span>
          </div>
        )}
        <div className="asset-preview-detail-row">
          <span className="asset-preview-label">Status</span>
          <span className={isMissing ? 'asset-preview-status-missing' : ''}>{isMissing ? '\u26A0 Missing' : 'OK'}</span>
        </div>
        <div className="asset-preview-detail-row">
          <span className="asset-preview-label">Updated</span>
          <span>{formatRelativeDate(asset.updatedAt)}</span>
        </div>
        {asset.tags.length > 0 && (
          <div className="asset-preview-tags">
            {asset.tags.map((tag) => (
              <span key={tag} className="asset-row-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div className="asset-preview-actions">
        <button
          className="asset-row-btn"
          onClick={() => onOpen(asset.filePath)}
          disabled={isMissing}
        >
          {isCurrent ? 'Currently open' : 'Open project'}
        </button>
      </div>

      <div className="asset-preview-path" title={asset.filePath}>
        {asset.filePath}
      </div>
    </div>
  );
}

function kindLabel(kind: AssetKind): string {
  switch (kind) {
    case 'character': return 'CHR';
    case 'prop': return 'PRP';
    case 'environment': return 'ENV';
    case 'effect': return 'FX';
    case 'ui': return 'UI';
    case 'custom': return 'CUS';
    default: return '?';
  }
}

/** Normalize path separators for cross-platform comparison. */
function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}
