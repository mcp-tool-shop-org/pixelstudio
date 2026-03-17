/**
 * Sprite Template Renderer — resolves a template + params into pixel operations
 * and dispatches a single Rust render_template command.
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  SpriteTemplate,
  TemplateParams,
  TemplateRenderResult,
  RGBA,
} from '@glyphstudio/domain';
import { findTemplate } from './spriteTemplateLibrary';

/** Resolved region ready for Rust rendering. */
interface RenderRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  shape: string;
  r: number;
  g: number;
  b: number;
  a: number;
  zOrder: number;
  outlineR?: number;
  outlineG?: number;
  outlineB?: number;
  outlineA?: number;
}

/** Resolved connection ready for Rust rendering. */
interface RenderConnection {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Resolve a color slot name to RGBA, using overrides or defaults. */
function resolveColor(
  slotName: string,
  template: SpriteTemplate,
  overrides: Record<string, RGBA>,
): RGBA {
  if (overrides[slotName]) return overrides[slotName];
  const slot = template.colorSlots.find((s) => s.name === slotName);
  return slot ? slot.defaultColor : [128, 128, 128, 255];
}

/** Resolve template + params into absolute pixel regions and connections. */
export function resolveTemplate(
  template: SpriteTemplate,
  params: TemplateParams,
): { regions: RenderRegion[]; connections: RenderConnection[] } {
  const scale = params.scale || 1.0;
  const canvasW = Math.round(template.suggestedWidth * scale);
  const canvasH = Math.round(template.suggestedHeight * scale);

  const regions: RenderRegion[] = template.regions.map((r) => {
    const color = resolveColor(r.colorSlot, template, params.colors);
    const region: RenderRegion = {
      x: Math.round(r.x * canvasW),
      y: Math.round(r.y * canvasH),
      width: Math.max(1, Math.round(r.width * canvasW)),
      height: Math.max(1, Math.round(r.height * canvasH)),
      shape: r.shape,
      r: color[0],
      g: color[1],
      b: color[2],
      a: color[3],
      zOrder: r.zOrder,
    };
    if (r.outlineColorSlot) {
      const oc = resolveColor(r.outlineColorSlot, template, params.colors);
      region.outlineR = oc[0];
      region.outlineG = oc[1];
      region.outlineB = oc[2];
      region.outlineA = oc[3];
    }
    return region;
  });

  // Build region center lookup for connections
  const regionCenters = new Map<string, { cx: number; cy: number }>();
  template.regions.forEach((r) => {
    const cx = Math.round((r.x + r.width / 2) * canvasW);
    const cy = Math.round((r.y + r.height / 2) * canvasH);
    regionCenters.set(r.id, { cx, cy });
  });

  const connections: RenderConnection[] = template.connections
    .map((c) => {
      const from = regionCenters.get(c.fromRegion);
      const to = regionCenters.get(c.toRegion);
      if (!from || !to) return null;
      const color = resolveColor(c.colorSlot, template, params.colors);
      return {
        fromX: from.cx,
        fromY: from.cy,
        toX: to.cx,
        toY: to.cy,
        r: color[0],
        g: color[1],
        b: color[2],
        a: color[3],
      };
    })
    .filter((c): c is RenderConnection => c !== null);

  return { regions, connections };
}

/** Render a template to the canvas via a single Rust command. */
export async function renderTemplate(
  params: TemplateParams,
  layerId?: string,
): Promise<TemplateRenderResult> {
  const template = findTemplate(params.templateId);
  if (!template) {
    throw new Error(`Template not found: ${params.templateId}`);
  }

  const { regions, connections } = resolveTemplate(template, params);

  const result = await invoke<{
    regionCount: number;
    connectionCount: number;
    pixelCount: number;
  }>('render_template', {
    input: {
      regions,
      connections,
      layerId: layerId ?? null,
    },
  });

  const scale = params.scale || 1.0;
  return {
    templateId: params.templateId,
    width: Math.round(template.suggestedWidth * scale),
    height: Math.round(template.suggestedHeight * scale),
    regionCount: result.regionCount,
    pixelCount: result.pixelCount,
  };
}
