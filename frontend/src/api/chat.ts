// SSE client for POST /api/chat/stream — parses the typed event protocol.
import { api } from './base';

export type ToolCall = { id: string; name: string; args: Record<string, unknown> };
export type ToolResult = { id: string; name: string; result: string };

export type ChatHandlers = {
  onDelta?: (text: string) => void;
  onToolCall?: (call: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onApprovalRequired?: (calls: ToolCall[]) => void;
  onDone?: () => void;
};

type SSEEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; name: string; result: string }
  | { type: 'approval_required'; calls: ToolCall[] }
  | { type: 'done' };

export async function streamChat(
  message: string,
  sessionId: string,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const res = await fetch(api('/api/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, session_id: sessionId }),
      signal,
    });
    await consume(res, handlers);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e; // stop = quietly end the stream
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(api(`/api/sessions/${sessionId}`), { method: 'DELETE' });
}

// Resume a paused turn: approved tools execute, denied tools return a denial to
// the model. The continuation streams back the same typed event protocol.
export async function approveChat(
  sessionId: string,
  decisions: Record<string, boolean>,
  handlers: ChatHandlers,
): Promise<void> {
  const res = await fetch(api('/api/chat/approve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, decisions }),
  });
  await consume(res, handlers);
}

async function consume(res: Response, handlers: ChatHandlers): Promise<void> {
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
    case 'approval_required':
      handlers.onApprovalRequired?.(payload.calls);
      break;
    case 'done':
      handlers.onDone?.();
      break;
  }
}
