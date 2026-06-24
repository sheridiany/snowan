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

// --- speech-to-text model + one-off voice transcription -------------------------
export type AsrStatus = {
  model: string;
  size_mb: number;
  ready: boolean;
  downloading: boolean;
  error?: string | null;
};

export const getAsrStatus = () => fetch(api('/api/recordings/asr')).then((r) => j<AsrStatus>(r));

export const downloadAsr = () =>
  fetch(api('/api/recordings/asr/download'), { method: 'POST' }).then((r) =>
    j<{ ready: boolean; downloading: boolean }>(r),
  );

export const transcribeAudio = (blob: Blob) => {
  const form = new FormData();
  form.append('file', blob, 'voice.webm');
  return fetch(api('/api/recordings/transcribe'), { method: 'POST', body: form }).then((r) =>
    j<{ text: string }>(r),
  );
};
