/**
 * AnalysisPanel — bounds, color histogram, and frame comparison.
 *
 * Thin shell over Rust analysis commands. No duplicate logic.
 */

import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';

interface BoundsResult {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  opaquePixelCount: number;
  empty: boolean;
}

interface ColorEntry {
  hex: string;
  count: number;
}

interface ColorsResult {
  uniqueColors: number;
  histogram: ColorEntry[];
  opaquePixelCount: number;
  transparentPixelCount: number;
  totalPixels: number;
}

interface CompareResult {
  changedPixelCount: number;
  totalPixels: number;
  changedBounds: { minX: number; minY: number; maxX: number; maxY: number } | null;
  identical: boolean;
  changedPercent: number;
}

type AnalysisMode = 'bounds' | 'colors' | 'compare';

function CopyJsonButton({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button className="analysis-copy-btn" onClick={handleCopy}>
      {copied ? 'Copied' : 'Copy JSON'}
    </button>
  );
}

export function AnalysisPanel() {
  const frameData = useCanvasFrameStore((s) => s.frame);
  const [mode, setMode] = useState<AnalysisMode>('bounds');
  const [bounds, setBounds] = useState<BoundsResult | null>(null);
  const [colors, setColors] = useState<ColorsResult | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [compareA, setCompareA] = useState(0);
  const [compareB, setCompareB] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runBounds = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await invoke<BoundsResult>('analyze_bounds', {});
      setBounds(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  const runColors = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await invoke<ColorsResult>('analyze_colors', { maxColors: 50 });
      setColors(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, []);

  const runCompare = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const result = await invoke<CompareResult>('compare_frames', {
        frameA: compareA,
        frameB: compareB,
      });
      setCompare(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  }, [compareA, compareB]);

  if (!frameData) {
    return (
      <div className="analysis-panel">
        <span className="analysis-empty">No canvas loaded</span>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      <div className="analysis-tabs">
        <button
          className={`analysis-tab ${mode === 'bounds' ? 'active' : ''}`}
          onClick={() => setMode('bounds')}
        >
          Bounds
        </button>
        <button
          className={`analysis-tab ${mode === 'colors' ? 'active' : ''}`}
          onClick={() => setMode('colors')}
        >
          Colors
        </button>
        <button
          className={`analysis-tab ${mode === 'compare' ? 'active' : ''}`}
          onClick={() => setMode('compare')}
        >
          Compare
        </button>
      </div>

      <div className="analysis-body">
        {mode === 'bounds' && (
          <>
            <button className="analysis-run-btn" onClick={runBounds} disabled={loading}>
              {loading ? 'Analyzing…' : 'Analyze Bounds'}
            </button>
            {bounds && (
              <div className="analysis-result">
                {bounds.empty ? (
                  <span className="analysis-muted">Frame is empty (no opaque pixels)</span>
                ) : (
                  <table className="analysis-table">
                    <tbody>
                      <tr><td>Origin</td><td>{bounds.minX}, {bounds.minY}</td></tr>
                      <tr><td>Size</td><td>{bounds.width} × {bounds.height}</td></tr>
                      <tr><td>Max</td><td>{bounds.maxX}, {bounds.maxY}</td></tr>
                      <tr><td>Opaque px</td><td>{bounds.opaquePixelCount.toLocaleString()}</td></tr>
                    </tbody>
                  </table>
                )}
                <CopyJsonButton data={bounds} />
              </div>
            )}
          </>
        )}

        {mode === 'colors' && (
          <>
            <button className="analysis-run-btn" onClick={runColors} disabled={loading}>
              {loading ? 'Analyzing…' : 'Analyze Colors'}
            </button>
            {colors && (
              <div className="analysis-result">
                <div className="analysis-stat-row">
                  <span>{colors.uniqueColors} unique colors</span>
                  <span>{colors.opaquePixelCount.toLocaleString()} opaque / {colors.totalPixels.toLocaleString()} total</span>
                </div>
                <div className="analysis-histogram">
                  {colors.histogram.map((entry) => (
                    <div key={entry.hex} className="analysis-color-row">
                      <span
                        className="analysis-color-swatch"
                        style={{ backgroundColor: entry.hex.slice(0, 7) }}
                      />
                      <span className="analysis-color-hex">{entry.hex}</span>
                      <span className="analysis-color-count">{entry.count}</span>
                    </div>
                  ))}
                </div>
                <CopyJsonButton data={colors} />
              </div>
            )}
          </>
        )}

        {mode === 'compare' && (
          <>
            <div className="analysis-compare-inputs">
              <label>
                Frame A
                <input
                  type="number"
                  min={0}
                  value={compareA}
                  onChange={(e) => setCompareA(Number(e.target.value))}
                />
              </label>
              <label>
                Frame B
                <input
                  type="number"
                  min={0}
                  value={compareB}
                  onChange={(e) => setCompareB(Number(e.target.value))}
                />
              </label>
            </div>
            <button className="analysis-run-btn" onClick={runCompare} disabled={loading}>
              {loading ? 'Comparing…' : 'Compare Frames'}
            </button>
            {compare && (
              <div className="analysis-result">
                {compare.identical ? (
                  <span className="analysis-muted">Frames are identical</span>
                ) : (
                  <table className="analysis-table">
                    <tbody>
                      <tr><td>Changed px</td><td>{compare.changedPixelCount.toLocaleString()}</td></tr>
                      <tr><td>Changed %</td><td>{compare.changedPercent}%</td></tr>
                      <tr><td>Total px</td><td>{compare.totalPixels.toLocaleString()}</td></tr>
                      {compare.changedBounds && (
                        <tr>
                          <td>Bounds</td>
                          <td>
                            ({compare.changedBounds.minX}, {compare.changedBounds.minY}) →
                            ({compare.changedBounds.maxX}, {compare.changedBounds.maxY})
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
                <CopyJsonButton data={compare} />
              </div>
            )}
          </>
        )}

        {error && <span className="analysis-error">{error}</span>}
      </div>
    </div>
  );
}
