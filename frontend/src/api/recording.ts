import { api } from './base';

export type Recording = {
  id: string;
  title: string;
  created_at: string;
  duration_ms: number;
  summary: string;
  transcript: string;
};

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

export const listRecordings = () =>
  fetch(api('/api/recordings'))
    .then((r) => j<{ recordings: Recording[] }>(r))
    .then((d) => d.recordings);

export const getRecording = (id: string) =>
  fetch(api(`/api/recordings/${id}`)).then((r) => j<Recording>(r));

export const uploadRecording = (blob: Blob, durationMs: number) => {
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  form.append('duration_ms', String(durationMs));
  return fetch(api('/api/recordings'), { method: 'POST', body: form }).then((r) => j<Recording>(r));
};

export const deleteRecording = (id: string) =>
  fetch(api(`/api/recordings/${id}`), { method: 'DELETE' }).then((r) => {
    if (!r.ok && r.status !== 404) throw new Error(`${r.status}`);
  });

export const recordingAudioUrl = (id: string) => api(`/api/recordings/${id}/audio`);
