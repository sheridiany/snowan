import { api } from './base';

export type CaptureKind = 'web' | 'ai_chat' | 'selection';

export type Capture = {
  id: string;
  kind: CaptureKind;
  url: string;
  title: string;
  captured_at: string;
  category: string;
  tags: string[];
  content?: string;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

export const listCaptures = () =>
  fetch(api('/api/capture'))
    .then((r) => j<{ captures: Capture[] }>(r))
    .then((d) => d.captures);

export const getCapture = (id: string) =>
  fetch(api(`/api/capture/${encodeURIComponent(id)}`)).then((r) => j<Capture>(r));

export const deleteCapture = (id: string) =>
  fetch(api(`/api/capture/${encodeURIComponent(id)}`), { method: 'DELETE' }).then((r) => {
    if (!r.ok && r.status !== 404) throw new Error(`${r.status}`);
  });
