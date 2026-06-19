import { api } from './base';

export type ToolPolicy = 'ask' | 'auto' | 'off';

export type McpServer = {
  name: string;
  transport: 'stdio' | 'http';
  enabled: boolean;
  command: string;
  args: string[];
  env: Record<string, string>;
  url: string;
  headers: Record<string, string>;
  tools: Record<string, ToolPolicy>;
};

export type McpProbe = {
  ok: boolean;
  tools?: { name: string; description: string }[];
  error?: string;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

const send = <T>(method: string, path: string, body?: unknown): Promise<T> =>
  fetch(api(path), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).then((r) => j<T>(r));

export const listServers = () => fetch(api('/api/mcp')).then((r) => j<McpServer[]>(r));

export const addServer = (form: {
  name: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}) => send<{ ok: boolean }>('POST', '/api/mcp', form);

export const pasteConfig = (config: unknown) =>
  send<{ ok: boolean; names: string[] }>('POST', '/api/mcp/paste', { config });

export const setEnabled = (name: string, enabled: boolean) =>
  send<{ ok: boolean }>('PATCH', `/api/mcp/${encodeURIComponent(name)}/enabled`, { enabled });

export const setToolPolicy = (name: string, tool: string, policy: ToolPolicy) =>
  send<{ ok: boolean }>('PATCH', `/api/mcp/${encodeURIComponent(name)}/tool-policy`, { tool, policy });

export const removeServer = (name: string) =>
  fetch(api(`/api/mcp/${encodeURIComponent(name)}`), { method: 'DELETE' });

export const probe = (name: string) =>
  send<McpProbe>('POST', `/api/mcp/${encodeURIComponent(name)}/probe`);
