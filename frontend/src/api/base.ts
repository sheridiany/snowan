// In dev, Vite proxies /api → the backend (vite.config.ts). In the packaged
// desktop app there is no proxy, so calls must hit the backend directly.
export const API_BASE = import.meta.env.PROD ? 'http://localhost:8787' : '';
export const api = (path: string) => `${API_BASE}${path}`;
