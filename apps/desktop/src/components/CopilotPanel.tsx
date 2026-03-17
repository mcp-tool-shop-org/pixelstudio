import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadAiSettings,
  getCanvasContext,
  ollamaChat,
  checkOllamaStatus,
  type CanvasContext,
  type OllamaChatResponse,
} from '../lib/aiSettings';
import { getRelevantTools, toolsToOllamaFormat } from '../lib/aiToolRegistry';
import { executeToolCall, parseToolCalls, type ToolCallResult } from '../lib/aiToolDispatcher';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  toolResults?: ToolCallResult[];
  pending?: boolean;
}

type PanelState = 'idle' | 'thinking' | 'executing' | 'awaiting-approval';

interface PendingOperation {
  calls: Array<{ name: string; arguments: Record<string, unknown> }>;
  explanation: string;
}

export function CopilotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<PanelState>('idle');
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [pendingOps, setPendingOps] = useState<PendingOperation | null>(null);
  const [contextSummary, setContextSummary] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check Ollama on mount
  useEffect(() => {
    const settings = loadAiSettings();
    checkOllamaStatus(settings.ollamaEndpoint).then((s) => {
      setOllamaOnline(s.available);
    });
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Refresh context summary
  const refreshContext = useCallback(async () => {
    try {
      const ctx = await getCanvasContext(false);
      const layerNames = ctx.layers.map((l) => l.name).join(', ');
      const summary = `${ctx.document.width}x${ctx.document.height} | Frame ${ctx.animation.activeFrameIndex + 1}/${ctx.animation.frameCount} "${ctx.document.activeFrameName}" | Layers: ${layerNames || 'none'} | ${ctx.selection ? `Selection: ${ctx.selection.width}x${ctx.selection.height}` : 'No selection'}`;
      setContextSummary(summary);
      return ctx;
    } catch {
      setContextSummary('No project open');
      return null;
    }
  }, []);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  const buildSystemPrompt = useCallback((ctx: CanvasContext) => {
    return `You are the GlyphStudio AI Copilot — an editing assistant for a pixel art sprite editor.

Current canvas state:
- Size: ${ctx.document.width}x${ctx.document.height} pixels
- Active frame: "${ctx.document.activeFrameName}" (${ctx.animation.activeFrameIndex + 1}/${ctx.animation.frameCount})
- Active layer: ${ctx.document.activeLayerName ?? 'none'}
- Layers (bottom to top): ${ctx.layers.map((l) => `${l.name}${l.visible ? '' : ' (hidden)'}${l.locked ? ' (locked)' : ''}`).join(', ') || 'none'}
- Selection: ${ctx.selection ? `${ctx.selection.width}x${ctx.selection.height} at (${ctx.selection.x}, ${ctx.selection.y})` : 'none'}
- Undo: ${ctx.history.undoDepth} steps available
- Recent tools: ${ctx.history.recentTools.join(', ') || 'none'}

You can execute editing operations by calling the provided tools. When you want to make changes:
1. Explain what you plan to do
2. Call the appropriate tools
3. Report the result

Keep responses concise. You are editing pixel art — coordinates are in pixels. Colors are RGBA (0-255).
For multi-pixel operations, use begin_stroke/stroke_points/end_stroke.`;
  }, []);

  const handleSend = useCallback(async () => {
    if (!input.trim() || state !== 'idle') return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setState('thinking');

    try {
      // Get fresh context
      const ctx = await refreshContext();
      if (!ctx) {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'No project is open. Please open or create a project first.' }]);
        setState('idle');
        return;
      }

      const settings = loadAiSettings();

      // Build tool definitions based on context
      const relevantTools = getRelevantTools({
        hasSelection: ctx.selection !== null,
        frameCount: ctx.animation.frameCount,
        canUndo: ctx.history.canUndo,
        canRedo: ctx.history.canRedo,
      });
      const ollamaTools = toolsToOllamaFormat(relevantTools);

      // Build conversation with system prompt
      const systemPrompt = buildSystemPrompt(ctx);
      const chatMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.filter((m) => m.role === 'user' || m.role === 'assistant').slice(-10).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: 'user', content: userMessage },
      ];

      // Add pending assistant message
      setMessages((prev) => [...prev, { role: 'assistant', content: '...', pending: true }]);

      const response: OllamaChatResponse = await ollamaChat(
        settings.ollamaEndpoint,
        settings.ollamaTextModel,
        chatMessages,
        ollamaTools,
      );

      // Parse tool calls
      const toolCalls = parseToolCalls({
        tool_calls: response.toolCalls?.map((tc) => ({
          function: { name: tc.function.name, arguments: tc.function.arguments },
        })),
        content: response.content,
      });

      if (toolCalls.length > 0) {
        // Show tool calls for approval
        const explanation = response.content || 'I want to execute these operations:';
        setPendingOps({ calls: toolCalls, explanation });
        setState('awaiting-approval');
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            role: 'assistant',
            content: explanation,
            toolCalls,
            pending: false,
          };
          return updated;
        });
      } else {
        // Just a text response
        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          updated[lastIdx] = {
            role: 'assistant',
            content: response.content || '(no response)',
            pending: false,
          };
          return updated;
        });
        setState('idle');
      }

      const durationMs = response.totalDurationNs ? Math.round(response.totalDurationNs / 1e6) : null;
      if (durationMs) {
        console.log(`Copilot response in ${durationMs}ms`);
      }
    } catch (err: unknown) {
      setMessages((prev) => {
        const updated = [...prev];
        if (updated.length > 0 && updated[updated.length - 1].pending) {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            pending: false,
          };
        } else {
          updated.push({ role: 'assistant', content: `Error: ${err instanceof Error ? err.message : String(err)}` });
        }
        return updated;
      });
      setState('idle');
    }
  }, [input, state, messages, refreshContext, buildSystemPrompt]);

  const handleApprove = useCallback(async () => {
    if (!pendingOps) return;
    setState('executing');

    const results: ToolCallResult[] = [];
    for (const call of pendingOps.calls) {
      const result = await executeToolCall(call);
      results.push(result);
      if (!result.success) break;
    }

    const summary = results.map((r) =>
      r.success ? `${r.name}: OK (${r.durationMs}ms)` : `${r.name}: FAILED — ${r.error}`
    ).join('\n');

    setMessages((prev) => [
      ...prev,
      { role: 'tool', content: summary, toolResults: results },
    ]);

    setPendingOps(null);
    setState('idle');
    refreshContext();
  }, [pendingOps, refreshContext]);

  const handleReject = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      { role: 'tool', content: 'Operations cancelled by user.' },
    ]);
    setPendingOps(null);
    setState('idle');
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="copilot-panel" data-testid="copilot-panel">
      {/* Context summary bar */}
      <div className="copilot-context-bar" data-testid="context-summary">
        {contextSummary || 'Loading...'}
      </div>

      {/* Connection status */}
      {ollamaOnline === false && (
        <div className="ai-settings-error">Ollama is offline. Check AI Settings.</div>
      )}

      {/* Chat messages */}
      <div className="copilot-messages">
        {messages.length === 0 && (
          <div className="copilot-empty">
            Ask the copilot to edit your sprite. It can draw pixels, manage layers, analyze colors, and more.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`copilot-msg copilot-msg-${msg.role}`}>
            <span className="copilot-msg-role">
              {msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : 'Result'}
            </span>
            <span className="copilot-msg-content">
              {msg.pending ? '...' : msg.content}
            </span>
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="copilot-tool-calls">
                {msg.toolCalls.map((tc, j) => (
                  <div key={j} className="copilot-tool-call">
                    {tc.name}({Object.entries(tc.arguments).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')})
                  </div>
                ))}
              </div>
            )}
            {msg.toolResults && (
              <div className="copilot-tool-results">
                {msg.toolResults.map((r, j) => (
                  <div key={j} className={`copilot-tool-result ${r.success ? 'success' : 'failure'}`}>
                    {r.success ? '\u2713' : '\u2717'} {r.name} {r.success ? `(${r.durationMs}ms)` : `— ${r.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Approval bar */}
      {state === 'awaiting-approval' && pendingOps && (
        <div className="copilot-approval-bar" data-testid="approval-bar">
          <span>{pendingOps.calls.length} operation{pendingOps.calls.length !== 1 ? 's' : ''} proposed</span>
          <button className="ai-settings-btn" onClick={handleApprove} data-testid="approve-btn">
            Approve
          </button>
          <button className="ai-settings-btn secondary" onClick={handleReject} data-testid="reject-btn">
            Reject
          </button>
        </div>
      )}

      {/* Input */}
      <div className="copilot-input-row">
        <textarea
          className="copilot-input"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={state === 'idle' ? 'Tell the copilot what to do...' : 'Waiting...'}
          disabled={state !== 'idle'}
          data-testid="copilot-input"
        />
        <button
          className="ai-settings-btn"
          onClick={handleSend}
          disabled={state !== 'idle' || !input.trim()}
          data-testid="send-btn"
        >
          Send
        </button>
      </div>
    </div>
  );
}
