/** Asset kind — classification for browsing and filtering */
export type AssetKind = 'character' | 'prop' | 'environment' | 'effect' | 'ui' | 'custom';

/** Asset status — whether the backing file is reachable */
export type AssetStatus = 'ok' | 'missing';

/** Summary of an asset catalog entry, returned by list/get commands */
export interface AssetSummary {
  id: string;
  name: string;
  filePath: string;
  kind: AssetKind;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  canvasWidth: number;
  canvasHeight: number;
  frameCount: number;
  clipCount: number;
  thumbnailPath: string | null;
  status: AssetStatus;
}
