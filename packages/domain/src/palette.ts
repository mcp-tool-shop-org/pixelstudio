/** A single color slot in a palette */
export interface PaletteSlot {
  id: string;
  rgba: [number, number, number, number];
  name: string | null;
  semanticRole: string | null;
  locked: boolean;
  rampId: string | null;
}

/** A grouped ramp of palette slots */
export interface PaletteRamp {
  id: string;
  name: string;
  slotIds: string[];
}

/** A palette definition containing slots and ramps */
export interface PaletteDefinition {
  id: string;
  name: string;
  slots: PaletteSlot[];
  ramps: PaletteRamp[];
}

/** Outline enforcement policy */
export type OutlinePolicy = 'free' | 'single-outline' | 'restricted-outline' | 'colorized-outline';

/** A palette contract that constrains color usage */
export interface PaletteContract {
  id: string;
  name: string;
  allowedSlotIds: string[];
  maxColorsPerSprite: number | null;
  outlinePolicy: OutlinePolicy;
  semanticRestrictions: Record<string, string[]>;
}

/** Quantization algorithm choices */
export type QuantizeAlgorithm = 'median-cut' | 'octree' | 'kmeans';

/** Dithering mode choices */
export type DitheringMode = 'none' | 'bayer' | 'floyd-steinberg';
