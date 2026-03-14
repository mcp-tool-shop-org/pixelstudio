/** Layer types in the graph */
export type LayerType = 'raster' | 'group' | 'mask' | 'draft' | 'generated' | 'guide';

/** Origin of a layer */
export type LayerOrigin = 'manual' | 'ai' | 'imported' | 'workflow';

/** A node in the layer graph */
export interface LayerNode {
  id: string;
  type: LayerType;
  name: string;
  parentId: string | null;
  childIds: string[];
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: string;
  pixelRefId: string | null;
  maskLayerId: string | null;
  socketIds: string[];
  origin: LayerOrigin;
  acceptedFromCandidateId: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}
