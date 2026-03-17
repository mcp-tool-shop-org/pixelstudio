/**
 * Sprite Template — body topology definitions for procedural sprite generation.
 *
 * Templates define named body regions with shapes, proportions, and color slots.
 * The LLM or user parameterizes a template (colors, scale, proportions) and the
 * renderer produces pixel data on the canvas.
 */

/** RGBA color tuple. */
export type RGBA = [number, number, number, number];

/** Named color slot that can be parameterized. */
export interface ColorSlot {
  name: string;
  description: string;
  defaultColor: RGBA;
}

/** Shape primitive used to fill a region. */
export type RegionShape = 'rect' | 'ellipse' | 'triangle-up' | 'triangle-down' | 'diamond';

/** A body region within a template — positioned relative to the template origin. */
export interface TemplateRegion {
  id: string;
  name: string;
  /** Offset from template origin (0,0 = top-left). Fractions of total template size. */
  x: number;
  y: number;
  /** Size as fractions of total template size. */
  width: number;
  height: number;
  /** Shape to fill this region with. */
  shape: RegionShape;
  /** Which color slot to use for this region. */
  colorSlot: string;
  /** Z-order for rendering (higher = on top). */
  zOrder: number;
  /** Optional outline: render 1px border in this color slot. */
  outlineColorSlot?: string;
}

/** Connection between two regions (rendered as a 1-2px bridge). */
export interface TemplateConnection {
  fromRegion: string;
  toRegion: string;
  colorSlot: string;
}

/** A sprite template archetype. */
export type TemplateArchetype =
  | 'humanoid'
  | 'quadruped'
  | 'flying'
  | 'item'
  | 'vehicle'
  | 'structure';

/** Full sprite template definition. */
export interface SpriteTemplate {
  id: string;
  name: string;
  description: string;
  archetype: TemplateArchetype;
  /** Suggested canvas size for this template. */
  suggestedWidth: number;
  suggestedHeight: number;
  /** Color palette slots that can be customized. */
  colorSlots: ColorSlot[];
  /** Body regions that compose the sprite. */
  regions: TemplateRegion[];
  /** Connections between regions. */
  connections: TemplateConnection[];
  /** Tags for searchability. */
  tags: string[];
}

/** Parameters the user/LLM provides to instantiate a template. */
export interface TemplateParams {
  templateId: string;
  /** Color overrides: slot name → RGBA. Missing slots use defaults. */
  colors: Record<string, RGBA>;
  /** Scale factor (1.0 = suggested size). */
  scale: number;
  /** Target layer name. */
  layerName?: string;
}

/** Result of rendering a template. */
export interface TemplateRenderResult {
  templateId: string;
  width: number;
  height: number;
  regionCount: number;
  pixelCount: number;
}
