// AI engine: providers + their models + the active selection. API keys are
// write-only (the server returns only `has_api_key`).
export type ModelInfo = {
  id: string;
  name: string;
  vision: boolean | null; // null = unknown / not probed
  probe: string; // 'heuristic' | 'probed' | 'manual'
};

export type ProviderInfo = {
  id: string;
  kind: string; // 'anthropic' | 'openai' | 'google' | 'custom'
  name: string;
  base_url: string | null;
  is_custom: boolean;
  has_api_key: boolean;
  models: ModelInfo[];
};

export type Active = { provider: string | null; model: string };
export type ProvidersState = { active: Active; providers: ProviderInfo[] };

export type TestResult = { ok: boolean; message: string };

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${await res.text().catch(() => '')}`);
  return res.json();
}
const post = (url: string, body?: unknown) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

export const listProviders = () => fetch('/api/providers').then(j<ProvidersState>);

export const configureProvider = (
  id: string,
  patch: { name?: string; base_url?: string; api_key?: string },
) =>
  fetch(`/api/providers/${id}/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  }).then(j<ProvidersState>);

export const createCustom = (body: { name: string; base_url: string; api_key?: string }) =>
  post('/api/providers/custom', body).then(j<{ id: string }>);

export const deleteProvider = (id: string) =>
  fetch(`/api/providers/${id}`, { method: 'DELETE' }).then(j<ProvidersState>);

export const addModel = (id: string, model: { id: string; name?: string }) =>
  post(`/api/providers/${id}/models`, model).then(j<ModelInfo>);

export const deleteModel = (id: string, modelId: string) =>
  post(`/api/providers/${id}/models/delete`, { model_id: modelId }).then(j<ProvidersState>);

export const discoverModels = (id: string) =>
  post(`/api/providers/${id}/discover`).then(j<{ added: ModelInfo[]; total: number }>);

export const testProvider = (id: string) =>
  post(`/api/providers/${id}/test`).then(j<TestResult>);

export const testModel = (id: string, modelId: string) =>
  post(`/api/providers/${id}/models/test`, { model_id: modelId }).then(j<TestResult>);

export const probeVision = (id: string, modelId: string) =>
  post(`/api/providers/${id}/models/probe`, { model_id: modelId }).then(
    j<{ vision: boolean | null; message: string }>,
  );

export const setActive = (provider: string, model: string) =>
  fetch('/api/providers/active', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, model }),
  }).then(j<ProvidersState>);
