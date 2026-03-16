import type { WorkflowDef } from '@glyphstudio/domain';

export const WORKFLOW_NEW_STATIC: WorkflowDef = {
  id: 'new-static-sprite',
  name: 'New Static Sprite',
  description: 'Create a blank sprite with standard layers, ready to draw.',
  category: 'create',
  steps: [
    { id: 'create-project', label: 'Create project', description: 'Initialize a new canvas project' },
    { id: 'init-canvas', label: 'Initialize canvas', description: 'Set up pixel buffers and layers' },
    { id: 'configure-palette', label: 'Set palette', description: 'Apply default palette', skippable: true },
    { id: 'enter-editor', label: 'Open editor', description: 'Switch to edit mode' },
  ],
};

export const WORKFLOW_NEW_ANIMATION: WorkflowDef = {
  id: 'new-animation-sprite',
  name: 'New Animation Sprite',
  description: 'Create a multi-frame sprite with timing defaults, ready to animate.',
  category: 'create',
  steps: [
    { id: 'create-project', label: 'Create project', description: 'Initialize a new canvas project' },
    { id: 'init-canvas', label: 'Initialize canvas', description: 'Set up pixel buffers and layers' },
    { id: 'create-frames', label: 'Create frames', description: 'Add animation frames with timing' },
    { id: 'configure-palette', label: 'Set palette', description: 'Apply default palette', skippable: true },
    { id: 'enter-editor', label: 'Open editor', description: 'Switch to animate mode' },
  ],
};

export const WORKFLOW_ANALYZE: WorkflowDef = {
  id: 'analyze-sprite',
  name: 'Analyze Current Sprite',
  description: 'Run bounds, color, and frame analysis on the current document.',
  category: 'analyze',
  steps: [
    { id: 'check-document', label: 'Check document', description: 'Verify a sprite is loaded' },
    { id: 'analyze-bounds', label: 'Analyze bounds', description: 'Calculate bounding box of opaque pixels' },
    { id: 'analyze-colors', label: 'Analyze colors', description: 'Build color histogram' },
    { id: 'compare-frames', label: 'Compare frames', description: 'Diff adjacent frames', skippable: true },
  ],
};

export const WORKFLOW_VALIDATE: WorkflowDef = {
  id: 'validate-sprite',
  name: 'Validate Current Sprite',
  description: 'Run validation rules and show issues with severity.',
  category: 'analyze',
  steps: [
    { id: 'check-document', label: 'Check document', description: 'Verify a sprite is loaded' },
    { id: 'run-validation', label: 'Run validation', description: 'Check palette, animation, and export rules' },
    { id: 'show-results', label: 'Show results', description: 'Display issue summary' },
  ],
};

export const WORKFLOW_EXPORT_REVIEW: WorkflowDef = {
  id: 'export-review-pack',
  name: 'Export Review Pack',
  description: 'Export PNG, GIF (if animated), and analysis report.',
  category: 'export',
  steps: [
    { id: 'check-document', label: 'Check document', description: 'Verify a sprite is loaded' },
    { id: 'export-png', label: 'Export PNG', description: 'Save current frame as PNG' },
    { id: 'export-gif', label: 'Export GIF', description: 'Save animated GIF', skippable: true },
    { id: 'export-report', label: 'Save report', description: 'Write analysis + validation summary' },
  ],
};

export const ALL_WORKFLOWS: WorkflowDef[] = [
  WORKFLOW_NEW_STATIC,
  WORKFLOW_NEW_ANIMATION,
  WORKFLOW_ANALYZE,
  WORKFLOW_VALIDATE,
  WORKFLOW_EXPORT_REVIEW,
];
