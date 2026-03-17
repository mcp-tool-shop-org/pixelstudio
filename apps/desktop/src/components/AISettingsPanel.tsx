import { useCallback, useEffect, useState } from 'react';
import {
  loadAiSettings,
  saveAiSettings,
  getAiSettingsDefaults,
  checkOllamaStatus,
  checkComfyuiStatus,
  fetchOllamaModels,
  formatModelSize,
  type AiSettings,
  type AiServiceStatus,
  type OllamaModel,
} from '../lib/aiSettings';

type ConnectionState = 'idle' | 'checking' | 'connected' | 'error';

export function AISettingsPanel() {
  const [settings, setSettings] = useState<AiSettings>(loadAiSettings);
  const [ollamaState, setOllamaState] = useState<ConnectionState>('idle');
  const [comfyuiState, setComfyuiState] = useState<ConnectionState>('idle');
  const [ollamaVersion, setOllamaVersion] = useState<string | null>(null);
  const [comfyuiVersion, setComfyuiVersion] = useState<string | null>(null);
  const [ollamaError, setOllamaError] = useState<string | null>(null);
  const [comfyuiError, setComfyuiError] = useState<string | null>(null);
  const [models, setModels] = useState<OllamaModel[]>([]);

  const persist = useCallback((patch: Partial<AiSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveAiSettings(next);
      return next;
    });
  }, []);

  const checkOllama = useCallback(async () => {
    setOllamaState('checking');
    setOllamaError(null);
    try {
      const status: AiServiceStatus = await checkOllamaStatus(settings.ollamaEndpoint);
      if (status.available) {
        setOllamaState('connected');
        setOllamaVersion(status.version);
        const list = await fetchOllamaModels(settings.ollamaEndpoint);
        setModels(list.models);
      } else {
        setOllamaState('error');
        setOllamaError(status.error ?? 'Connection failed');
      }
    } catch (err: unknown) {
      setOllamaState('error');
      setOllamaError(err instanceof Error ? err.message : String(err));
    }
  }, [settings.ollamaEndpoint]);

  const checkComfyui = useCallback(async () => {
    setComfyuiState('checking');
    setComfyuiError(null);
    try {
      const status: AiServiceStatus = await checkComfyuiStatus(settings.comfyuiEndpoint);
      if (status.available) {
        setComfyuiState('connected');
        setComfyuiVersion(status.version);
      } else {
        setComfyuiState('error');
        setComfyuiError(status.error ?? 'Connection failed');
      }
    } catch (err: unknown) {
      setComfyuiState('error');
      setComfyuiError(err instanceof Error ? err.message : String(err));
    }
  }, [settings.comfyuiEndpoint]);

  // Auto-check on mount
  useEffect(() => {
    checkOllama();
    checkComfyui();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReset = useCallback(() => {
    const defaults = getAiSettingsDefaults();
    setSettings(defaults);
    saveAiSettings(defaults);
  }, []);

  const statusDot = (state: ConnectionState) => {
    if (state === 'connected') return 'status-dot connected';
    if (state === 'error') return 'status-dot error';
    if (state === 'checking') return 'status-dot checking';
    return 'status-dot idle';
  };

  const statusLabel = (state: ConnectionState, version: string | null) => {
    if (state === 'connected') return version ? `Connected (v${version})` : 'Connected';
    if (state === 'checking') return 'Checking...';
    if (state === 'error') return 'Offline';
    return 'Not checked';
  };

  return (
    <div className="ai-settings-panel" data-testid="ai-settings-panel">
      <h3 className="panel-heading">AI Infrastructure</h3>

      {/* Ollama section */}
      <section className="ai-settings-section">
        <div className="ai-settings-header">
          <span className={statusDot(ollamaState)} />
          <strong>Ollama</strong>
          <span className="ai-settings-status">{statusLabel(ollamaState, ollamaVersion)}</span>
        </div>

        <label className="ai-settings-label">
          Endpoint
          <input
            type="text"
            className="ai-settings-input"
            value={settings.ollamaEndpoint}
            onChange={(e) => persist({ ollamaEndpoint: e.target.value })}
            data-testid="ollama-endpoint-input"
          />
        </label>

        {ollamaError && <div className="ai-settings-error">{ollamaError}</div>}

        <button className="ai-settings-btn" onClick={checkOllama} disabled={ollamaState === 'checking'}>
          {ollamaState === 'checking' ? 'Checking...' : 'Test Connection'}
        </button>

        {models.length > 0 && (
          <>
            <label className="ai-settings-label">
              Text Model
              <select
                className="ai-settings-select"
                value={settings.ollamaTextModel}
                onChange={(e) => persist({ ollamaTextModel: e.target.value })}
                data-testid="ollama-text-model-select"
              >
                {models.map((m) => (
                  <option key={`text-${m.name}`} value={m.name}>
                    {m.name} ({formatModelSize(m.size)}{m.parameter_size ? `, ${m.parameter_size}` : ''})
                  </option>
                ))}
              </select>
            </label>

            <label className="ai-settings-label">
              Vision Model
              <select
                className="ai-settings-select"
                value={settings.ollamaVisionModel}
                onChange={(e) => persist({ ollamaVisionModel: e.target.value })}
                data-testid="ollama-vision-model-select"
              >
                <option value="">None</option>
                {models.map((m) => (
                  <option key={`vision-${m.name}`} value={m.name}>
                    {m.name} ({formatModelSize(m.size)}{m.parameter_size ? `, ${m.parameter_size}` : ''})
                  </option>
                ))}
              </select>
            </label>

            <div className="ai-settings-model-count">{models.length} model{models.length !== 1 ? 's' : ''} available</div>
          </>
        )}
      </section>

      {/* ComfyUI section */}
      <section className="ai-settings-section">
        <div className="ai-settings-header">
          <span className={statusDot(comfyuiState)} />
          <strong>ComfyUI</strong>
          <span className="ai-settings-status">{statusLabel(comfyuiState, comfyuiVersion)}</span>
        </div>

        <label className="ai-settings-label">
          Endpoint
          <input
            type="text"
            className="ai-settings-input"
            value={settings.comfyuiEndpoint}
            onChange={(e) => persist({ comfyuiEndpoint: e.target.value })}
            data-testid="comfyui-endpoint-input"
          />
        </label>

        {comfyuiError && <div className="ai-settings-error">{comfyuiError}</div>}

        <button className="ai-settings-btn" onClick={checkComfyui} disabled={comfyuiState === 'checking'}>
          {comfyuiState === 'checking' ? 'Checking...' : 'Test Connection'}
        </button>
      </section>

      <button className="ai-settings-btn secondary" onClick={handleReset}>
        Reset to Defaults
      </button>
    </div>
  );
}
