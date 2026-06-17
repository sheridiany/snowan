// SSE client for POST /api/chat/stream — parses the typed event protocol.
export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ToolResult = { id: string; name: string; result: string };

export type ChatHandlers = {
  onDelta?: (text: string) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onDone?: () => void;
};

type SSEEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'done' };

export async function streamChat(
  message: string,
  sessionId: string,
  handlers: ChatHandlers,
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const events = buf.split('\n\n');
    buf = events.pop() ?? '';
    for (const evt of events) dispatch(evt, handlers);
  }
  if (buf.trim()) dispatch(buf, handlers);
}

function dispatch(raw: string, handlers: ChatHandlers): void {
  const line = raw.trim();
  if (!line.startsWith('data:')) return;
  const payload = JSON.parse(line.slice(5).trim()) as SSEEvent;
  switch (payload.type) {
    case 'delta':
      handlers.onDelta?.(payload.text);
      break;
    case 'tool_call':
      handlers.onToolCall?.({ id: payload.id, name: payload.name, args: payload.args });
      break;
    case 'tool_result':
      handlers.onToolResult?.({ id: payload.id, name: payload.name, result: payload.result });
      break;
    case 'done':
      handlers.onDone?.();
      break;
  }
}
