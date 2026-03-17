export { useReferenceStore } from './referenceStore';
export type { ReferenceImage } from './referenceStore';
export { useAppShellStore } from './appShellStore';
export { useProjectStore } from './projectStore';
export { useWorkspaceStore } from './workspaceStore';
export { useWorkflowStore } from './workflowStore';
export { useCanvasViewStore, ZOOM_STEPS } from './canvasViewStore';
export type { SilhouetteColor } from './canvasViewStore';
export { useToolStore } from './toolStore';
export type { RgbaColor } from './toolStore';
export { useBrushSettingsStore, SKETCH_BRUSH_DEFAULTS, SKETCH_ERASER_DEFAULTS, SKETCH_LAYER_DEFAULTS } from './brushSettingsStore';
export type { BrushSettings } from './brushSettingsStore';
export { expandDab, expandStrokeDabs } from './sketchDab';
export type { DabParams } from './sketchDab';
export { useTranslationStore, TRANSLATION_RESOLUTIONS } from './translationStore';
export type { TranslationSession, TranslationResolution } from './translationStore';
export { useVectorMasterStore } from './vectorMasterStore';
export { useSizeProfileStore } from './sizeProfileStore';
export { rasterizeVectorMaster, rasterizeShape, wouldShapeCollapse, transformPoint } from './vectorRasterize';
export { rasterizeAllProfiles, analyzeReduction, generateMultiSizeLayout, summarizeReduction } from './vectorComparison';
export { captureCopilotContext, captureCopilotRaster } from './copilotContext';
export type { CopilotContext, CopilotShapeSummary, CopilotProfileSummary } from './copilotContext';
export {
  analyzeTopChanges,
  analyzeCollapse,
  analyzeProfileStrength,
  analyzeExaggeration,
  runFullAnalysis,
} from './copilotAnalysis';
export type {
  CopilotCritique,
  TopChangesResponse,
  CollapseResponse,
  ProfileComparisonResponse,
  ProfileStrength,
  ExaggerationResponse,
  ExaggerationRec,
  CopilotAnalysisBundle,
} from './copilotAnalysis';
export { askVisionWhatDoesThisReadAs, checkOllamaAvailability, pixelBufferToBase64Png, DEFAULT_OLLAMA_CONFIG } from './copilotVision';
export type { OllamaVisionConfig, VisionResponse } from './copilotVision';
export { vectorToSpriteHandoff, extractPaletteFromBuffer } from './vectorHandoff';
export type { VectorHandoffResult } from './vectorHandoff';
export { regenerateFromVector, checkRegenerationStatus } from './vectorRegenerate';
export type { RegenerateResult } from './vectorRegenerate';
export {
  nearestNeighborDownscale,
  countFilledPixels,
  analyzeSilhouetteSurvival,
  computeComparisonScale,
  pixelPerfectUpscale,
  generateComparisonLayout,
} from './translationComparison';
export type { SilhouetteSurvivalResult } from './translationComparison';
export { useSelectionStore } from './selectionStore';
export type { TransformPreviewData } from './selectionStore';
export { useLayerStore } from './layerStore';
export { useSnapshotStore } from './snapshotStore';
export type { CanvasSnapshot } from './snapshotStore';
export { usePaletteStore } from './paletteStore';
export { useTimelineStore } from './timelineStore';
export type { FrameInfo } from './timelineStore';
export { useAIStore } from './aiStore';
export { useLocomotionStore } from './locomotionStore';
export { useMotionStore } from './motionStore';
export { useAnchorStore } from './anchorStore';
export { useValidationStore } from './validationStore';
export { useProvenanceStore } from './provenanceStore';
export { useExportStore } from './exportStore';
export { useSandboxStore } from './sandboxStore';
export {
  useScenePlaybackStore,
  resolveCameraAtTick,
  deriveShotsFromCameraKeyframes,
  deriveCameraTimelineMarkers,
  findCurrentCameraShotAtTick,
  findCameraKeyframeAtTick,
} from './scenePlaybackStore';
export type { CameraTimelineMarker } from './scenePlaybackStore';
export {
  equipPart,
  unequipSlot,
  replacePart,
  isSlotCompatible,
  collectProvidedSockets,
  collectProvidedAnchors,
  validateCharacterBuild,
  deriveMissingRequiredSlots,
  deriveEquippedParts,
  isCharacterBuildValid,
} from './characterHelpers';
export {
  classifyPresetCompatibility,
  getCompatiblePresetsForSlot,
  classifyAllPresetsForSlot,
} from './characterPresetHelpers';
export {
  useCharacterStore,
  getEquippedPartForSlot,
  getMissingRequiredSlots,
  getCharacterErrors,
  getCharacterWarnings,
  isCharacterValid,
  getEquippedSlotsInDisplayOrder,
} from './characterStore';
export type { CharacterBuildLibrary, SavedCharacterBuild } from '@glyphstudio/domain';
export type { SceneInstanceKind, CharacterSlotSnapshot, CharacterInstanceOverrides, CharacterSlotOverride, CharacterSlotOverrideMode, CharacterSourceLinkMode } from '@glyphstudio/domain';
export {
  placeCharacterBuild,
  reapplyCharacterBuild,
  createSlotSnapshot,
  checkPlaceability,
  isCharacterInstance,
  isSourceBuildAvailable,
  deriveSourceStatus,
  sourceStatusLabel,
  instanceBuildName,
  snapshotSummary,
  isSnapshotPossiblyStale,
  generateCharacterInstanceId,
  CHARACTER_PLACEMENT_DEFAULTS,
  applyOverridesToSnapshot,
  deriveEffectiveSlots,
  hasOverrides,
  getOverriddenSlots,
  isSlotOverridden,
  getSlotOverride,
  setSlotOverride,
  clearSlotOverride,
  clearAllOverrides,
  deriveEffectiveCharacterSlotStates,
  getOverrideCount,
  getEffectiveEquippedCount,
  getRemovedOverrideSlots,
  getReplacedOverrideSlots,
  overrideSummary,
  effectiveSlotSummary,
  effectiveCompositionAsBuild,
  canReapplyFromSource,
  canRelinkToSource,
  unlinkFromSource,
  relinkToSource,
} from './characterSceneBridge';
export type { CharacterPlacementOptions, PlaceabilityResult, CharacterSourceStatus, EffectiveSlotComposition, EffectiveCharacterSlotState, EffectiveSlotSource } from './characterSceneBridge';
export {
  createEmptyLibrary,
  generateSavedBuildId,
  toSavedBuild,
  toCharacterBuild,
  saveBuildToLibrary,
  deleteBuildFromLibrary,
  duplicateBuildInLibrary,
  deriveDuplicateName,
  findBuildById,
  renameBuildInLibrary,
  hasBuildInLibrary,
  getLibraryBuildCount,
} from './characterBuildLibrary';
export {
  describeSceneHistoryOperation,
  isSceneHistoryChange,
  createSceneHistoryEntry,
  captureSceneSnapshot,
  ALL_SCENE_HISTORY_OPERATION_KINDS,
} from './sceneHistory';
export type {
  SceneHistoryOperationKind,
  SceneHistorySnapshot,
  SceneHistoryEntry,
  SceneHistoryInstanceMeta,
  SceneHistoryOverrideMeta,
  SceneHistoryCameraMeta,
  SceneHistoryKeyframeMeta,
  SceneHistoryRestoreMeta,
  SceneHistoryOperationMetadata,
} from './sceneHistory';
export {
  createEmptySceneHistoryState,
  canUndoScene,
  canRedoScene,
  recordSceneHistoryEntry,
  undoSceneHistory,
  redoSceneHistory,
  finishApplyingHistory,
  applySceneEditWithHistory,
} from './sceneHistoryEngine';
export type {
  SceneHistoryState,
  SceneHistoryUndoResult,
  SceneHistoryRedoResult,
  ApplySceneEditResult,
} from './sceneHistoryEngine';
export { useSceneEditorStore } from './sceneEditorStore';
export type { SceneEditorState, SceneUndoRedoResult, SceneRestoreActionResult } from './sceneEditorStore';
export {
  createSceneProvenanceEntry,
  describeSceneProvenanceEntry,
  resetProvenanceSequence,
  setProvenanceSequence,
} from './sceneProvenance';
export type { SceneProvenanceEntry } from './sceneProvenance';
export {
  deriveProvenanceDiff,
  deriveProvenanceDrilldown,
  describeProvenanceDiff,
  captureProvenanceDrilldownSource,
} from './sceneProvenanceDrilldown';
export type {
  SceneProvenanceDiff,
  SceneProvenanceDrilldown,
  SceneProvenanceDrilldownSource,
} from './sceneProvenanceDrilldown';
export {
  extractChangedFields,
  summarizeMultiFieldChange,
  summarizeScalarChange,
  fallbackSummary,
  classifySummaryFamily,
  fmtNumber,
  fmtPercent,
  fmtBool,
  CAMERA_FIELD_CONFIGS,
  KEYFRAME_FIELD_CONFIGS,
  POSITION_FIELD_CONFIGS,
  PLAYBACK_FIELD_CONFIGS,
} from './structuredValueSummary';
export type {
  FieldChange,
  FieldConfig,
  StructuredValueSummary,
  SummaryFamily,
} from './structuredValueSummary';
export {
  createCurrentAnchor,
  createEntryAnchor,
  createComparisonRequest,
  validateComparisonRequest,
  describeComparison,
  resolveComparisonScopes,
  deriveSceneComparison,
  deriveRestorePreview,
} from './sceneComparison';
export type {
  SceneComparisonMode,
  RestorePreviewResult,
  SceneComparisonSnapshot,
  SceneComparisonAnchor,
  SceneComparisonRequest,
  InstanceFieldDiff,
  InstanceComparisonEntry,
  CameraComparisonSection,
  KeyframeComparisonEntry,
  KeyframeComparisonSection,
  PlaybackComparisonSection,
  InstanceComparisonSection,
  SceneComparisonResult,
  ComparisonUnavailableReason,
} from './sceneComparison';
export {
  deriveSceneRestore,
  describeSceneRestore,
  FULL_RESTORE_DOMAINS,
  RESTORE_SCOPE_LABELS,
  SELECTIVE_RESTORE_SCOPES,
} from './sceneRestore';
export type {
  SceneRestoreScope,
  SceneRestoreRequest,
  SceneRestoreSnapshot,
  SceneRestoreUnavailableReason,
  SceneRestoreResult,
  FullRestoreDomain,
} from './sceneRestore';
export { runSpriteValidation } from './spriteValidation';
export { useSpriteEditorStore } from './spriteEditorStore';
export type { SpriteEditorStoreState } from './spriteEditorStore';
export {
  getPixelIndex,
  isInBounds,
  samplePixel,
  setPixel,
  colorsEqual,
  drawBrushDab,
  bresenhamLine,
  removeCorners,
  floodFill,
  clonePixelBuffer,
  normalizeRect,
  extractSelection,
  clearSelectionArea,
  blitSelection,
  flipBufferHorizontal,
  flipBufferVertical,
  flattenLayers,
  silhouetteBuffer,
  TRANSPARENT,
} from './spriteRaster';
export type { Rgba } from './spriteRaster';
export {
  validateSheetDimensions,
  sliceSpriteSheet,
  assembleSpriteSheet,
  isImportExportError,
} from './spriteImportExport';
export type { SheetValidationResult } from './spriteImportExport';
export { generateSpriteSheetMeta, encodeAnimatedGif } from './spriteExport';
export {
  serializeSpriteFile,
  deserializeSpriteFile,
  encodePixelData,
  decodePixelData,
  GLYPH_SCHEMA_VERSION,
  GLYPH_FORMAT,
} from './spritePersistence';
export {
  rotateBuffer,
  resizeBuffer,
} from './spriteTransform';
export type { RotationAngle, FlipDirection } from './spriteTransform';
export {
  analyzeSpriteBounds,
  analyzeSpriteColors,
  compareFrames,
} from './spriteAnalysis';
export type {
  SpriteBounds,
  SpriteColorAnalysis,
  SpriteColorEntry,
  SpriteFrameDiff,
} from './spriteAnalysis';
export {
  SPRITE_HISTORY_OPERATION_KINDS,
  describeSpriteHistoryOperation,
  captureSpriteSnapshot,
  createSpriteHistoryEntry,
} from './spriteHistory';
export type {
  SpriteHistoryOperationKind,
  SpriteHistorySnapshot,
  SpriteHistoryEntry,
} from './spriteHistory';
export {
  createEmptySpriteHistoryState,
  canUndoSprite,
  canRedoSprite,
  getSpriteHistorySummary,
  recordSpriteHistoryEntry,
  undoSpriteHistory,
  redoSpriteHistory,
  finishApplyingSpriteHistory,
} from './spriteHistoryEngine';
export type {
  SpriteHistoryState,
  SpriteHistoryUndoResult,
  SpriteHistoryRedoResult,
} from './spriteHistoryEngine';
