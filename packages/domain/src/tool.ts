/** Available editing tools */
export type ToolId =
  | 'pencil'
  | 'eraser'
  | 'fill'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'marquee'
  | 'lasso'
  | 'magic-select'
  | 'color-select'
  | 'move'
  | 'transform'
  | 'slice'
  | 'socket'
  | 'measure'
  | 'sketch-brush'
  | 'sketch-eraser';

/** Tools designed for rough/sketch work */
export const SKETCH_TOOLS: readonly ToolId[] = ['sketch-brush', 'sketch-eraser'] as const;

/** Returns true if the tool is a sketch-mode tool */
export function isSketchTool(tool: ToolId): boolean {
  return tool === 'sketch-brush' || tool === 'sketch-eraser';
}
