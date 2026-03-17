import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  loadAiSettings,
  comfyuiGenerate,
  comfyuiWaitForCompletion,
  comfyuiFetchImage,
  type ComfyUIJobStatus,
  type ComfyUIImageData,
} from '../lib/aiSettings';
import {
  WORKFLOW_TEMPLATES,
  buildTxt2ImgWorkflow,
  DEFAULT_CHECKPOINT,
  type WorkflowTemplate,
} from '../lib/comfyuiWorkflows';

type GenerateState = 'idle' | 'generating' | 'done' | 'error';

export function ComfyUIGeneratePanel() {
  const [template, setTemplate] = useState<WorkflowTemplate>(WORKFLOW_TEMPLATES[0]);
  const [prompt, setPrompt] = useState(WORKFLOW_TEMPLATES[0].defaultPrompt);
  const [checkpoint, setCheckpoint] = useState(DEFAULT_CHECKPOINT);
  const [steps, setSteps] = useState(20);
  const [cfg, setCfg] = useState(7);
  const [state, setState] = useState<GenerateState>('idle');
  const [statusText, setStatusText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultImage, setResultImage] = useState<ComfyUIImageData | null>(null);
  const [importedLayer, setImportedLayer] = useState<string | null>(null);

  const handleTemplateChange = useCallback((id: string) => {
    const t = WORKFLOW_TEMPLATES.find((w) => w.id === id);
    if (t) {
      setTemplate(t);
      setPrompt(t.defaultPrompt);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    setState('generating');
    setError(null);
    setResultImage(null);
    setImportedLayer(null);
    setStatusText('Queuing workflow...');

    const settings = loadAiSettings();

    try {
      const workflow = buildTxt2ImgWorkflow(
        prompt,
        template.negativePrompt,
        checkpoint,
        -1,
        steps,
        cfg,
      );
      const workflowJson = JSON.stringify(workflow);

      const { prompt_id } = await comfyuiGenerate(settings.comfyuiEndpoint, workflowJson);
      setStatusText(`Generating... (${prompt_id.slice(0, 8)})`);

      const finalStatus = await comfyuiWaitForCompletion(
        settings.comfyuiEndpoint,
        prompt_id,
        2000,
        120000,
        (status: ComfyUIJobStatus) => {
          if (!status.done) {
            setStatusText(`Generating... (${prompt_id.slice(0, 8)})`);
          }
        },
      );

      if (finalStatus.error) {
        setState('error');
        setError(finalStatus.error);
        return;
      }

      if (finalStatus.images.length === 0) {
        setState('error');
        setError('No images returned by ComfyUI');
        return;
      }

      setStatusText('Fetching image...');
      const img = finalStatus.images[0];
      const imageData = await comfyuiFetchImage(
        settings.comfyuiEndpoint,
        img.filename,
        img.subfolder,
        img.image_type,
      );

      setResultImage(imageData);
      setState('done');
      setStatusText(`Done! ${imageData.width}x${imageData.height}`);
    } catch (err: unknown) {
      setState('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [prompt, template, checkpoint, steps, cfg]);

  const handleImport = useCallback(async () => {
    if (!resultImage) return;

    try {
      setStatusText('Importing to canvas...');
      // Decode base64 PNG → pixel data, create a new layer
      await invoke('create_layer', { name: `AI: ${prompt.slice(0, 30)}` });
      // Write the PNG pixels to the new layer via batch_draw
      // For now we store the base64 and let the user import manually
      setImportedLayer(`AI: ${prompt.slice(0, 30)}`);
      setStatusText('Layer created! Use paste to place the image.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [resultImage, prompt]);

  const handleDiscard = useCallback(() => {
    setResultImage(null);
    setState('idle');
    setStatusText('');
    setImportedLayer(null);
  }, []);

  return (
    <div className="comfyui-generate-panel" data-testid="comfyui-generate-panel">
      <h3 className="panel-heading">ComfyUI Generate</h3>

      {/* Template selector */}
      <label className="ai-settings-label">
        Template
        <select
          className="ai-settings-select"
          value={template.id}
          onChange={(e) => handleTemplateChange(e.target.value)}
          data-testid="template-select"
        >
          {WORKFLOW_TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </label>
      <div className="ai-settings-model-count">{template.description}</div>

      {/* Prompt */}
      <label className="ai-settings-label">
        Prompt
        <textarea
          className="ai-prompt-input"
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your sprite..."
          data-testid="prompt-input"
        />
      </label>

      {/* Options row */}
      <div className="ai-options-row">
        <label className="ai-option">
          <span>Steps</span>
          <input
            type="number"
            className="ai-settings-input"
            min={1}
            max={50}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
        <label className="ai-option">
          <span>CFG</span>
          <input
            type="number"
            className="ai-settings-input"
            min={1}
            max={20}
            step={0.5}
            value={cfg}
            onChange={(e) => setCfg(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label>
      </div>

      {/* Checkpoint */}
      <label className="ai-settings-label">
        Checkpoint
        <input
          type="text"
          className="ai-settings-input"
          value={checkpoint}
          onChange={(e) => setCheckpoint(e.target.value)}
          data-testid="checkpoint-input"
        />
      </label>

      {/* Generate button */}
      <button
        className="ai-settings-btn generate-btn"
        onClick={handleGenerate}
        disabled={state === 'generating' || !prompt.trim()}
        data-testid="generate-btn"
      >
        {state === 'generating' ? 'Generating...' : 'Generate Sprite'}
      </button>

      {/* Status */}
      {statusText && <div className="ai-log">{statusText}</div>}
      {error && <div className="ai-settings-error">{error}</div>}

      {/* Result preview */}
      {resultImage && (
        <div className="comfyui-result">
          <img
            src={`data:image/png;base64,${resultImage.base64_png}`}
            alt="Generated sprite"
            className="comfyui-preview-img"
            style={{ imageRendering: 'pixelated' }}
          />
          <div className="comfyui-result-actions">
            <button className="ai-settings-btn" onClick={handleImport} data-testid="import-btn">
              Import to Canvas
            </button>
            <button className="ai-settings-btn secondary" onClick={handleGenerate}>
              Regenerate
            </button>
            <button className="ai-settings-btn secondary" onClick={handleDiscard}>
              Discard
            </button>
          </div>
          {importedLayer && (
            <div className="ai-log">Created layer: {importedLayer}</div>
          )}
        </div>
      )}
    </div>
  );
}
