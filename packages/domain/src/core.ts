/** Axis-aligned rectangle */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 2D point */
export interface Point {
  x: number;
  y: number;
}

/** Whether an operation is deterministic or probabilistic */
export type OperationKind = 'deterministic' | 'probabilistic' | 'analysis' | 'workflow';

/** RGB or indexed color mode */
export type ColorMode = 'rgb' | 'indexed';

/** Validation categories */
export type ValidationCategory =
  | 'palette'
  | 'outline'
  | 'socket'
  | 'atlas'
  | 'export'
  | 'animation'
  | 'locomotion'
  | 'canon';

/** Scope of impact from a mutation */
export interface ImpactScope {
  layerIds?: string[];
  frameIds?: string[];
  region?: Rect | null;
  validationCategories?: ValidationCategory[];
}

/** Reference to a provenance entry */
export interface ProvenanceRef {
  provenanceId: string;
  kind: OperationKind;
  replayable: boolean;
  rerunnable: boolean;
}
