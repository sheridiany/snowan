export type ToolStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
};

export type ApprovalCall = {
  id: string;
  name: string;
  args: Record<string, unknown>;
};

// A turn's content is an ordered stream of text and tool steps, so tool cards
// land inline exactly where the agent invoked them. An approval block pauses the
// turn inline until the user allows or denies the pending calls.
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; step: ToolStep }
  | { kind: 'approval'; calls: ApprovalCall[]; decided?: boolean; approved?: boolean };

export type Message = {
  role: 'user' | 'assistant';
  blocks: Block[];
};

export type Session = {
  id: string;
  title: string;
};
