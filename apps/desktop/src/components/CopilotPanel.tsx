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
import { generateSuggestions, type Suggestion } from '../lib/aiSuggestions';

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

const MAX_TURNS = 5;

export function CopilotPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [state, setState] = useState<PanelState>('idle');
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [pendingOps, setPendingOps] = useState<PendingOperation | null>(null);
  const [contextSummary, setContextSummary] = useState<string>('');
  const [turnCount, setTurnCount] = useState(0);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const latestContextRef = useRef<CanvasContext | null>(null);

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
      setSuggestions(generateSuggestions(ctx));
      latestContextRef.current = ctx;
      return ctx;
    } catch {
      setContextSummary('No project open');
      setSuggestions([]);
      return null;
    }
  }, []);

  useEffect(() => {
    refreshContext();
  }, [refreshContext]);

  const buildSystemPrompt = useCallback((ctx: CanvasContext) => {
    const layerList = ctx.layers.map((l) =>
      `  - "${l.name}" (id: ${l.id})${l.visible ? '' : ' [hidden]'}${l.locked ? ' [locked]' : ''} opacity=${l.opacity}`
    ).join('\n') || '  (none)';
    const frameList = ctx.animation.frames.map((f, i) =>
      `  - ${i + 1}. "${f.name}" (id: ${f.id})${f.durationMs ? ` ${f.durationMs}ms` : ''}`
    ).join('\n');

    return `You are the GlyphStudio AI Copilot — an editing assistant for a pixel art sprite editor.

Current canvas state:
- Size: ${ctx.document.width}x${ctx.document.height} pixels
- Active frame: "${ctx.document.activeFrameName}" (${ctx.animation.activeFrameIndex + 1}/${ctx.animation.frameCount})
- Active layer: ${ctx.document.activeLayerName ?? 'none'}
- Layers (bottom to top):
${layerList}
- Frames:
${frameList}
- Selection: ${ctx.selection ? `${ctx.selection.width}x${ctx.selection.height} at (${ctx.selection.x}, ${ctx.selection.y})` : 'none'}
- Undo: ${ctx.history.undoDepth} steps available
- Recent tools: ${ctx.history.recentTools.join(', ') || 'none'}

You can execute editing operations by calling the provided tools. When you want to make changes:
1. Explain what you plan to do
2. Call the appropriate tools
3. Report the result

Keep responses concise. You are editing pixel art — coordinates are in pixels. Colors are RGBA (0-255).
For area fills, use fill_rect. For freeform drawing, use begin_stroke/stroke_points/end_stroke.
Layer and frame operations require UUIDs — use the IDs listed above.
After tool results come back, you may call more tools or give a text summary. Max ${MAX_TURNS} tool rounds per request.`;
  }, []);

  /** Send chat messages to Ollama and handle the response (tool calls or text). */
  const sendToLlm = useCallback(async (
    chatMessages: Array<{ role: string; content: string }>,
    currentMessages: ChatMessage[],
    currentTurn: number,
  ): Promise<void> => {
    const ctx = await refreshContext();
    if (!ctx) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'No project is open.' }]);
      setState('idle');
      return;
    }

    const settings = loadAiSettings();
    const relevantTools = getRelevantTools({
      hasSelection: ctx.selection !== null,
      frameCount: ctx.animation.frameCount,
      canUndo: ctx.history.canUndo,
      canRedo: ctx.history.canRedo,
    });
    const ollamaTools = toolsToOllamaFormat(relevantTools);
    const systemPrompt = buildSystemPrompt(ctx);

    const fullMessages = [
      { role: 'system', content: systemPrompt },
      ...chatMessages,
    ];

    // Add pending assistant message
    setMessages((prev) => [...prev, { role: 'assistant', content: '...', pending: true }]);

    const response: OllamaChatResponse = await ollamaChat(
      settings.ollamaEndpoint,
      settings.ollamaTextModel,
      fullMessages,
      ollamaTools,
    );

    const toolCalls = parseToolCalls({
      tool_calls: response.toolCalls?.map((tc) => ({
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
      content: response.content,
    });

    if (toolCalls.length > 0 && currentTurn < MAX_TURNS) {
      const explanation = response.content || 'I want to execute these operations:';
      setPendingOps({ calls: toolCalls, explanation });
      setState('awaiting-approval');
      setTurnCount(currentTurn + 1);
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
      // Text-only response or max turns reached
      const content = toolCalls.length > 0
        ? `${response.content || ''}\n\n(Reached max ${MAX_TURNS} tool rounds — stopping here.)`
        : (response.content || '(no response)');
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          role: 'assistant',
          content,
          pending: false,
        };
        return updated;
      });
      setState('idle');
      setTurnCount(0);
    }

    const durationMs = response.totalDurationNs ? Math.round(response.totalDurationNs / 1e6) : null;
    if (durationMs) {
      console.log(`Copilot response in ${durationMs}ms (turn ${currentTurn + 1})`);
    }
  }, [refreshContext, buildSystemPrompt]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || state !== 'idle') return;

    const userMessage = input.trim();
    setInput('');

    // Add user message
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setState('thinking');
    setTurnCount(0);

    try {
      // Build conversation from history
      const chatHistory = messages
        .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool')
        .slice(-20)
        .map((m) => ({ role: m.role, content: m.content }));
      chatHistory.push({ role: 'user', content: userMessage });

      await sendToLlm(chatHistory, messages, 0);
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
      setTurnCount(0);
    }
  }, [input, state, messages, sendToLlm]);

  const handleApprove = useCallback(async () => {
    if (!pendingOps) return;
    setState('executing');

    const frameIds = latestContextRef.current?.animation.frames.map((f) => f.id) ?? [];
    const toolContext = { frameIds };

    const results: ToolCallResult[] = [];
    for (const call of pendingOps.calls) {
      const result = await executeToolCall(call, toolContext);
      results.push(result);
      if (!result.success) break;
    }

    const summary = results.map((r) =>
      r.success ? `${r.name}: OK (${r.durationMs}ms)` : `${r.name}: FAILED — ${r.error}`
    ).join('\n');

    // Add tool results message
    setMessages((prev) => [
      ...prev,
      { role: 'tool', content: summary, toolResults: results },
    ]);

    setPendingOps(null);
    await refreshContext();

    // Feed results back to LLM for follow-up (multi-turn loop)
    if (turnCount < MAX_TURNS) {
      setState('thinking');
      try {
        // Rebuild full conversation including the new tool results
        // We need to read the latest messages state
        setMessages((prev) => {
          // Build chat history from all messages (including the tool results just added)
          const chatHistory = prev
            .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'tool')
            .slice(-20)
            .map((m) => ({ role: m.role === 'tool' ? 'user' : m.role, content: m.role === 'tool' ? `[Tool results]\n${m.content}` : m.content }));

          // Fire LLM call asynchronously
          sendToLlm(chatHistory, prev, turnCount).catch((err) => {
            setMessages((p) => [
              ...p,
              { role: 'assistant', content: `Error in follow-up: ${err instanceof Error ? err.message : String(err)}` },
            ]);
            setState('idle');
            setTurnCount(0);
          });

          return prev;
        });
      } catch {
        setState('idle');
        setTurnCount(0);
      }
    } else {
      setState('idle');
      setTurnCount(0);
    }
  }, [pendingOps, refreshContext, turnCount, sendToLlm]);

  const handleReject = useCallback(() => {
    setMessages((prev) => [
      ...prev,
      { role: 'tool', content: 'Operations cancelled by user.' },
    ]);
    setPendingOps(null);
    setState('idle');
    setTurnCount(0);
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

      {/* Smart suggestions */}
      {suggestions.length > 0 && state === 'idle' && messages.length === 0 && (
        <div className="copilot-suggestions" data-testid="suggestions">
          {suggestions.map((s) => (
            <button
              key={s.id}
              className="copilot-suggestion-chip"
              data-testid={`suggestion-${s.id}`}
              onClick={() => setInput(s.prompt)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

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
          <span>
            {pendingOps.calls.length} operation{pendingOps.calls.length !== 1 ? 's' : ''} proposed
            {turnCount > 0 && ` (turn ${turnCount}/${MAX_TURNS})`}
          </span>
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
