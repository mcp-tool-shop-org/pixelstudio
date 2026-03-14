/** Anchor kind — named presets for common sprite anatomy parts */
export type AnchorKind =
  | 'head'
  | 'torso'
  | 'arm_left'
  | 'arm_right'
  | 'leg_left'
  | 'leg_right'
  | 'custom';

/** A named anchor point on a frame */
export interface Anchor {
  id: string;
  name: string;
  kind: AnchorKind;
  /** Position relative to the frame origin */
  x: number;
  y: number;
  /** Optional rectangular bounds for region-based anchors */
  bounds: AnchorBounds | null;
  /** Optional parent anchor name for hierarchy (matched by name) */
  parentName?: string | null;
  /** Falloff weight for secondary motion amplitude scaling (0.1–3.0, default 1.0) */
  falloffWeight?: number;
}

/** Rectangular bounds attached to an anchor for region targeting */
export interface AnchorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Anchor kind display metadata */
export const ANCHOR_KIND_LABELS: Record<AnchorKind, string> = {
  head: 'Head',
  torso: 'Torso',
  arm_left: 'Left Arm',
  arm_right: 'Right Arm',
  leg_left: 'Left Leg',
  leg_right: 'Right Leg',
  custom: 'Custom',
};

/** Anchor kind colors for overlay rendering */
export const ANCHOR_KIND_COLORS: Record<AnchorKind, string> = {
  head: '#4fc3f7',
  torso: '#81c784',
  arm_left: '#ffb74d',
  arm_right: '#ff8a65',
  leg_left: '#ba68c8',
  leg_right: '#f06292',
  custom: '#90a4ae',
};
