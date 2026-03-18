import { useCallback, useMemo, useState } from 'react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { generateBundlePlan } from '@glyphstudio/state';
import type { BundleScope, BundlePlan } from '@glyphstudio/state';

type BundleFormat = 'sheet' | 'gif';

export function BundlePanel() {
  const doc = useSpriteEditorStore((s) => s.document);

  const [selectedDocVariants, setSelectedDocVariants] = useState<Set<string | null>>(new Set([null]));
  const [selectedPaletteSets, setSelectedPaletteSets] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<BundleFormat>('sheet');

  const variants = doc?.variants ?? [];
  const paletteSets = doc?.paletteSets ?? [];

  const scope: BundleScope = useMemo(() => ({
    documentVariants: Array.from(selectedDocVariants),
    paletteSets: Array.from(selectedPaletteSets),
    format,
  }), [selectedDocVariants, selectedPaletteSets, format]);

  const plan: BundlePlan | null = useMemo(() => {
    if (!doc) return null;
    if (selectedDocVariants.size === 0) return null;
    return generateBundlePlan(doc, scope);
  }, [doc, scope, selectedDocVariants.size]);

  const toggleDocVariant = useCallback((id: string | null) => {
    setSelectedDocVariants((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const togglePaletteSet = useCallback((id: string) => {
    setSelectedPaletteSets((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllDocVariants = useCallback(() => {
    const all = new Set<string | null>([null, ...variants.map((v) => v.id)]);
    setSelectedDocVariants(all);
  }, [variants]);

  const selectAllPaletteSets = useCallback(() => {
    setSelectedPaletteSets(new Set(paletteSets.map((ps) => ps.id)));
  }, [paletteSets]);

  if (!doc) {
    return (
      <div className="bundle-panel">
        <div className="bundle-empty">No document open</div>
      </div>
    );
  }

  return (
    <div className="bundle-panel" data-testid="bundle-panel">
      {/* Document variants */}
      <div className="bundle-section">
        <div className="bundle-section-header">
          <span className="bundle-section-title">Sequences</span>
          {variants.length > 0 && (
            <button
              className="bundle-select-all-btn"
              onClick={selectAllDocVariants}
              data-testid="bundle-select-all-doc"
            >
              All
            </button>
          )}
        </div>
        <label className="bundle-checkbox" data-testid="bundle-doc-base">
          <input
            type="checkbox"
            checked={selectedDocVariants.has(null)}
            onChange={() => toggleDocVariant(null)}
          />
          Base
        </label>
        {variants.map((v) => (
          <label key={v.id} className="bundle-checkbox" data-testid={`bundle-doc-${v.id}`}>
            <input
              type="checkbox"
              checked={selectedDocVariants.has(v.id)}
              onChange={() => toggleDocVariant(v.id)}
            />
            {v.name}
          </label>
        ))}
      </div>

      {/* Palette sets */}
      {paletteSets.length > 0 && (
        <div className="bundle-section">
          <div className="bundle-section-header">
            <span className="bundle-section-title">Palettes</span>
            <button
              className="bundle-select-all-btn"
              onClick={selectAllPaletteSets}
              data-testid="bundle-select-all-pal"
            >
              All
            </button>
          </div>
          {paletteSets.map((ps) => (
            <label key={ps.id} className="bundle-checkbox" data-testid={`bundle-pal-${ps.id}`}>
              <input
                type="checkbox"
                checked={selectedPaletteSets.has(ps.id)}
                onChange={() => togglePaletteSet(ps.id)}
              />
              {ps.name}
            </label>
          ))}
        </div>
      )}

      {/* Format */}
      <div className="bundle-section">
        <span className="bundle-section-title">Format</span>
        <div className="bundle-format-row">
          <label className="bundle-radio">
            <input
              type="radio"
              name="bundle-format"
              value="sheet"
              checked={format === 'sheet'}
              onChange={() => setFormat('sheet')}
            />
            Sheet
          </label>
          <label className="bundle-radio">
            <input
              type="radio"
              name="bundle-format"
              value="gif"
              checked={format === 'gif'}
              onChange={() => setFormat('gif')}
            />
            GIF
          </label>
        </div>
      </div>

      {/* Plan preview */}
      {plan && plan.totalFiles > 0 && (
        <div className="bundle-plan" data-testid="bundle-plan">
          <div className="bundle-plan-header">
            <span className="bundle-plan-title">Output Plan</span>
            <span className="bundle-plan-count" data-testid="bundle-plan-count">
              {plan.totalFiles} file{plan.totalFiles !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="bundle-plan-list">
            {plan.entries.map((entry, i) => (
              <div key={i} className="bundle-plan-entry" data-testid={`bundle-plan-entry-${i}`}>
                <span className="bundle-plan-filename">{entry.filename}</span>
                <span className="bundle-plan-meta">
                  {entry.documentVariantName}
                  {entry.paletteSetId !== null ? ` + ${entry.paletteSetName}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Export button */}
      <div className="bundle-actions">
        <button
          className="bundle-export-btn"
          disabled={!plan || plan.totalFiles === 0}
          data-testid="bundle-export"
        >
          Export {plan?.totalFiles ?? 0} File{(plan?.totalFiles ?? 0) !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  );
}
