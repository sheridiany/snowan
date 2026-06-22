import { api } from './base';

export type ToolInfo = { name: string; description: string; mutating: boolean; enabled: boolean };
export type AuditEntry = { ts: string; tool: string; summary: string; status: string };
export type Profile = { name: string; location: string; notes: string };
export type Prefs = {
  approval_mode: string; // 'auto' | 'ask' | 'strict'
  max_iters: number;
  timezone: string;
  auto_title: boolean;
  system_prompt: string;
  profile: Profile;
  web_search_provider: string; // 'duckduckgo' | 'tavily' | 'brave'
  tavily_api_key: string;
  brave_api_key: string;
  jina_api_key: string;
  disabled_tools: string[];
  memory_enabled: boolean;
  onboarded: boolean;
};
export type About = {
  version: string;
  data_dir: string;
  provider: string;
  model: string;
  has_api_key: boolean;
};
export type Usage = {
  turns: number;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  hit_rate: number;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

export const getTools = () => fetch(api('/api/tools')).then((r) => j<ToolInfo[]>(r));
export const getAudit = (limit = 100) =>
  fetch(api(`/api/audit?limit=${limit}`)).then((r) => j<AuditEntry[]>(r));
export const getPrefs = () => fetch(api('/api/prefs')).then((r) => j<Prefs>(r));
export const savePrefs = (patch: Partial<Prefs>) =>
  fetch(api('/api/prefs'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then((r) => j<Prefs>(r));
export const getAbout = () => fetch(api('/api/about')).then((r) => j<About>(r));
export const getUsage = () => fetch(api('/api/usage')).then((r) => j<Usage>(r));
export const openDataDir = () => fetch(api('/api/about/open-data-dir'), { method: 'POST' });
