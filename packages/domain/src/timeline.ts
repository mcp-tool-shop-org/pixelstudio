/** A single animation frame */
export interface Frame {
  id: string;
  index: number;
  durationMs: number;
  celLayerIds: string[];
  tagIds: string[];
}

/** A named range of frames */
export interface AnimationTag {
  id: string;
  name: string;
  frameIds: string[];
  loop: boolean;
  fpsOverride: number | null;
}

/** Source of a draft track */
export type DraftTrackSource = 'manual' | 'ai-inbetween' | 'ai-locomotion' | 'workflow';

/** An AI-generated or manual draft frame track */
export interface DraftTrack {
  id: string;
  name: string;
  frameToLayerIds: Record<string, string[]>;
  source: DraftTrackSource;
  visible: boolean;
}
