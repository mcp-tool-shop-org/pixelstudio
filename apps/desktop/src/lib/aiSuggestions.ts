/**
 * Smart Suggestions — lightweight canvas analysis that produces
 * clickable quick-action chips for the copilot panel.
 *
 * These are cheap pattern detections, not LLM calls.
 * They run on each context refresh.
 */

import type { CanvasContext } from './aiSettings';

export interface Suggestion {
  id: string;
  label: string;
  prompt: string;
  priority: number; // lower = more important
}

/**
 * Analyze canvas context and return a prioritized list of suggestions.
 * Returns at most `maxSuggestions` items.
 */
export function generateSuggestions(
  ctx: CanvasContext,
  maxSuggestions: number = 4,
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const { document: doc, layers, animation, selection, history } = ctx;
  const totalPixels = doc.width * doc.height;

  // Suggestion: Fill background (when canvas is mostly transparent)
  // We can't count pixels from the context alone, but we can check if there's
  // only one layer and no selection — likely a new/empty canvas
  if (layers.length === 1 && !selection && history.undoDepth === 0) {
    suggestions.push({
      id: 'fill-bg',
      label: 'Fill background',
      prompt: `Fill the entire canvas (${doc.width}x${doc.height}) with a solid background color.`,
      priority: 1,
    });
  }

  // Suggestion: Add animation frame (single frame)
  if (animation.frameCount === 1) {
    suggestions.push({
      id: 'add-frame',
      label: 'Add animation frame',
      prompt: 'Duplicate the current frame to start an animation sequence.',
      priority: 3,
    });
  }

  // Suggestion: Create new layer (for organization)
  if (layers.length === 1 && history.undoDepth > 0) {
    suggestions.push({
      id: 'add-layer',
      label: 'Add outline layer',
      prompt: 'Create a new layer called "Outline" above the current layer for line work.',
      priority: 4,
    });
  }

  // Suggestion: Analyze colors (when there's content)
  if (history.undoDepth > 2) {
    suggestions.push({
      id: 'analyze-colors',
      label: 'Analyze palette',
      prompt: 'Analyze the color palette of the current frame. How many unique colors are there?',
      priority: 5,
    });
  }

  // Suggestion: Mirror sprite (when there's content and a single frame)
  if (history.undoDepth > 3 && !selection) {
    suggestions.push({
      id: 'mirror-sprite',
      label: 'Mirror sprite',
      prompt: `Select the left half of the canvas (0, 0, ${Math.floor(doc.width / 2)}, ${doc.height}), copy it, flip horizontally, and paste on the right half to create symmetry.`,
      priority: 6,
    });
  }

  // Suggestion: Center content (when sprite may be off-center)
  if (history.undoDepth > 5 && totalPixels <= 4096) {
    suggestions.push({
      id: 'center-content',
      label: 'Center content',
      prompt: 'Analyze the bounding box of the sprite content, then move it to be centered on the canvas.',
      priority: 7,
    });
  }

  // Suggestion: Compare frames (when multi-frame)
  if (animation.frameCount >= 2) {
    suggestions.push({
      id: 'compare-frames',
      label: 'Compare frames',
      prompt: 'Compare the current frame with the next frame. What changed between them?',
      priority: 8,
    });
  }

  // Suggestion: Clean up (generic, always available if there's content)
  if (history.undoDepth > 8) {
    suggestions.push({
      id: 'cleanup',
      label: 'Check for issues',
      prompt: 'Analyze the current frame for potential issues: orphan pixels, color inconsistencies, or bounds problems.',
      priority: 10,
    });
  }

  // Sort by priority, truncate
  suggestions.sort((a, b) => a.priority - b.priority);
  return suggestions.slice(0, maxSuggestions);
}
