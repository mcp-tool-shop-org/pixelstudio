import { useState, useEffect } from 'react';
import { VectorCanvas, type VectorToolId } from './VectorCanvas';
import { VectorToolRail } from './VectorToolRail';
import { useVectorMasterStore } from '@glyphstudio/state';
import type { Rgba } from '@glyphstudio/domain';

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

  const doc = useVectorMasterStore((s) => s.document);
  const createDocument = useVectorMasterStore((s) => s.createDocument);

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
      />
    </>
  );
}
