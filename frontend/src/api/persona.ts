// 「我的画像」onboarding interview client. The backend asks a short set of warm
// questions; the user's free-text answers are sent back to be drafted into a
// 6-section persona markdown. The confirmed persona is persisted via the existing
// PUT /api/memory/profile (see api/memory.ts saveProfile) — not here.
import { api } from './base';

export type PersonaQuestion = { id: string; question: string; hint?: string };

const j = <T>(r: Response): Promise<T> => {
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

export const getPersonaQuestions = () =>
  fetch(api('/api/persona/questions')).then((r) => j<PersonaQuestion[]>(r));

export const draftPersona = (answers: Record<string, string>) =>
  fetch(api('/api/persona/draft'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers }),
  }).then((r) => j<{ draft: string }>(r));
