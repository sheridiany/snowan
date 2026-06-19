// Native helpers that only work inside the packaged desktop app. In the dev
// browser these no-op so callers can fall back (e.g. a path input).
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

// Opens the OS folder chooser; returns the chosen absolute path, or null if the
// user cancelled or we're not in the desktop app.
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const res = await open({ directory: true, multiple: false, title: '选择要加入知识库的文件夹' });
    return typeof res === 'string' ? res : null;
  } catch {
    return null;
  }
}
