import { api } from './base';

export type Skill = {
  name: string;
  description: string;
  enabled: boolean;
  tags?: string[];
  source?: string | null;
};
export type SkillDetail = Skill & { body: string };
export type ExternalSkill = {
  name: string;
  description: string;
  source: string;
  path: string;
  already: boolean;
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

export const listSkills = () => fetch(api('/api/skills')).then((r) => j<Skill[]>(r));

export const getSkill = (name: string) =>
  fetch(api(`/api/skills/${encodeURIComponent(name)}`)).then((r) => j<SkillDetail>(r));

export const createSkill = (name: string, description: string, body: string) =>
  send<SkillDetail>('POST', '/api/skills', { name, description, body });

export const updateSkill = (name: string, patch: { description?: string; body?: string }) =>
  send<SkillDetail>('PUT', `/api/skills/${encodeURIComponent(name)}`, patch);

export const setEnabled = (name: string, enabled: boolean) =>
  send<{ ok: boolean }>('PATCH', `/api/skills/${encodeURIComponent(name)}/enabled`, { enabled });

export const deleteSkill = (name: string) =>
  fetch(api(`/api/skills/${encodeURIComponent(name)}`), { method: 'DELETE' });

export const discoverExternalSkills = () =>
  fetch(api('/api/skills/external')).then((r) => j<ExternalSkill[]>(r));

export const importSkills = (paths: string[]) =>
  send<{ imported: Skill[] }>('POST', '/api/skills/import', { paths });
