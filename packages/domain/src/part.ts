/** Unique reusable part identifier. */
export type PartId = string;

/** Schema version for the part library format. */
export const PART_LIBRARY_VERSION = 1;

/** A reusable pixel part saved to the part library. */
export interface Part {
  id: PartId;
  name: string;
  width: number;
  height: number;
  /** RGBA pixel data as plain number array (JSON/localStorage serializable). */
  pixelData: number[];
  /** Optional tags for filtering. */
  tags?: string[];
  /** ISO timestamp when first created. */
  createdAt: string;
  /** ISO timestamp when last modified. */
  updatedAt: string;
}

/** The persisted part library. */
export interface PartLibrary {
  schemaVersion: number;
  parts: Part[];
}

/** Generate a unique part ID. */
export function generatePartId(): string {
  return `part_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
