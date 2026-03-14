/** Secondary-motion template identifiers (environmental / scenery motion) */
export type SecondaryMotionTemplateId =
  | 'wind_soft'
  | 'wind_medium'
  | 'wind_gust'
  | 'idle_sway'
  | 'hanging_swing'
  | 'foliage_rustle';

/** Anchor readiness requirement for a secondary-motion template */
export interface SecondaryAnchorReq {
  kind: string;
  required: boolean;
  role: string;
}

/** Secondary-motion template definition */
export interface SecondaryTemplateInfo {
  id: SecondaryMotionTemplateId;
  name: string;
  description: string;
  anchorRequirements: SecondaryAnchorReq[];
  benefitsFromHierarchy: boolean;
  hint: string;
}

/** Bounded parameters for secondary-motion generation */
export interface SecondaryMotionParams {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  /** 0.1–2.0, default 1.0 */
  strength: number;
  /** 2, 4, or 6 */
  frameCount: number;
  /** Phase offset in radians (0–TAU), default 0.0 */
  phaseOffset: number;
}

/** Readiness tier for a secondary-motion template */
export type SecondaryReadinessTier = 'ready' | 'limited' | 'blocked';

/** Structured readiness info for a secondary-motion template */
export interface SecondaryReadinessInfo {
  templateId: string;
  templateName: string;
  tier: SecondaryReadinessTier;
  totalAnchors: number;
  rootAnchors: string[];
  childAnchors: string[];
  hierarchyPresent: boolean;
  hierarchyBeneficial: boolean;
  notes: string[];
  fixHints: string[];
}

/** Motion panel mode — locomotion vs secondary */
export type MotionPanelMode = 'locomotion' | 'secondary';
