// One tool call is a single row that transitions in place: a guarded call is
// 'pending' until the user decides, then 'approved'/'denied'; a result arriving
// marks it done. So announce -> approve -> run collapse into one row, not three.
export type ToolStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  approval?: 'pending' | 'approved' | 'denied';
};

// A turn's content is an ordered stream of text and tool steps, so tool rows
// land inline exactly where the agent invoked them.
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; step: ToolStep }
  | { kind: 'artifact'; path: string; title: string };

export type Attachment = { name: string; mime: string };

export type Message = {
  role: 'user' | 'assistant';
  blocks: Block[];
  attachments?: Attachment[]; // shown on user messages
};

export type SessionStatus = 'active' | 'todo' | 'done';

export type Session = {
  id: string;
  title: string;
  status: SessionStatus;
  tags: string[];
  updatedAt: number;
};
