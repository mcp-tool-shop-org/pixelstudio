import { useState, useEffect, useMemo } from 'react';
import { VectorCanvas, type VectorToolId } from './VectorCanvas';
import { VectorToolRail } from './VectorToolRail';
import { useVectorMasterStore, useSizeProfileStore, computeCollapseOverlay } from '@glyphstudio/state';
import type { CollapseOverlayData } from '@glyphstudio/state';
import type { Rgba, SizeProfile } from '@glyphstudio/domain';

/**
 * VectorWorkspace — full workspace mode for vector master editing.
 *
 * Replaces ToolRail + Canvas when in 'vector' mode.
 * Owns vector tool state, fill/stroke state, and auto-creates
 * a document if none exists.
 */
export function VectorWorkspace() {
  const [activeTool, setActiveTool] = useState<VectorToolId>('v-select');
  const [fillColor, setFillColor] = useState<Rgba | null>([100, 100, 100, 255]);
  const [strokeColor, setStrokeColor] = useState<Rgba | null>(null);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [overlayEnabled, setOverlayEnabled] = useState(false);
  const [overlayProfileId, setOverlayProfileId] = useState<string>('');

  const doc = useVectorMasterStore((s) => s.document);
  const createDocument = useVectorMasterStore((s) => s.createDocument);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Default to smallest active profile when overlay is enabled
  useEffect(() => {
    if (overlayEnabled && !overlayProfileId && activeProfiles.length > 0) {
      const smallest = [...activeProfiles].sort((a, b) =>
        (a.targetWidth * a.targetHeight) - (b.targetWidth * b.targetHeight)
      )[0];
      setOverlayProfileId(smallest.id);
    }
  }, [overlayEnabled, overlayProfileId, activeProfiles]);

  // Compute collapse overlay
  const collapseOverlay = useMemo((): CollapseOverlayData | null => {
    if (!overlayEnabled || !doc || activeProfiles.length === 0) return null;
    const targetProfile = activeProfiles.find((p) => p.id === overlayProfileId);
    if (!targetProfile) return null;
    return computeCollapseOverlay(doc, activeProfiles, targetProfile);
  }, [overlayEnabled, doc, activeProfiles, overlayProfileId]);

  // Auto-create a vector document if none exists
  useEffect(() => {
    if (!doc) {
      createDocument('Untitled Vector Master');
    }
  }, [doc, createDocument]);

  // Keyboard shortcuts for tools
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      switch (e.key.toLowerCase()) {
        case 'v': setActiveTool('v-select'); break;
        case 'r': setActiveTool('v-rect'); break;
        case 'e': setActiveTool('v-ellipse'); break;
        case 'l': setActiveTool('v-line'); break;
        case 'p': setActiveTool('v-polygon'); break;
        case 'q': setActiveTool('v-path'); break;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <>
      <VectorToolRail
        activeTool={activeTool}
        onToolChange={setActiveTool}
        fillColor={fillColor}
        onFillChange={setFillColor}
        strokeColor={strokeColor}
        onStrokeChange={setStrokeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
      />
      <VectorCanvas
        activeTool={activeTool}
        fillColor={fillColor}
        strokeColor={strokeColor}
        strokeWidth={strokeWidth}
        collapseOverlay={collapseOverlay}
      />
      {/* Collapse overlay controls */}
      <div className="collapse-overlay-controls">
        <label className="collapse-overlay-toggle">
          <input
            type="checkbox"
            checked={overlayEnabled}
            onChange={(e) => setOverlayEnabled(e.target.checked)}
          />
          <span>Risk Overlay</span>
        </label>
        {overlayEnabled && activeProfiles.length > 0 && (
          <select
            className="collapse-overlay-profile-select"
            value={overlayProfileId}
            onChange={(e) => setOverlayProfileId(e.target.value)}
          >
            {activeProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.targetWidth}x{p.targetHeight}
              </option>
            ))}
          </select>
        )}
        {overlayEnabled && collapseOverlay && (
          <div className="collapse-overlay-summary">
            {collapseOverlay.collapsesCount > 0 && (
              <span className="overlay-badge collapses">{collapseOverlay.collapsesCount} collapse</span>
            )}
            {collapseOverlay.atRiskCount > 0 && (
              <span className="overlay-badge at-risk">{collapseOverlay.atRiskCount} at-risk</span>
            )}
            {collapseOverlay.collapsesCount === 0 && collapseOverlay.atRiskCount === 0 && (
              <span className="overlay-badge safe">All safe</span>
            )}
          </div>
        )}
        {overlayEnabled && activeProfiles.length === 0 && (
          <span className="collapse-overlay-hint">Enable size profiles in Reduction tab</span>
        )}
      </div>
    </>
  );
}
