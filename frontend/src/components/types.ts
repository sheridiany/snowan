export type ToolStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
};

// A turn's content is an ordered stream of text and tool steps, so tool cards
// land inline exactly where the agent invoked them.
export type Block =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; step: ToolStep };

export type Message = {
  role: 'user' | 'assistant';
  blocks: Block[];
};

export type Session = {
  id: string;
  title: string;
};
