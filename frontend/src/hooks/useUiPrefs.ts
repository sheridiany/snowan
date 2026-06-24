import { useSyncExternalStore } from 'react';
import { getPrefs, savePrefs } from '../api/system';

// The three UI-only prefs, mirrored from the backend PREF_DEFAULTS. Kept in a
// shared external store so every consumer (settings page, ModelSelect,
// SessionsView, ToolCallCard) reads the same live value and re-renders together
// the instant one of them flips a flag.
export type UiPrefs = {
  show_provider_icons: boolean;
  rich_tool_desc: boolean;
  ui_font: string; // 'inter' | 'system'
};

const DEFAULTS: UiPrefs = {
  show_provider_icons: true,
  rich_tool_desc: true,
  ui_font: 'inter',
};

let current: UiPrefs = { ...DEFAULTS };
const listeners = new Set<() => void>();

// Cache snapshots per key so useSyncExternalStore's getSnapshot stays referentially
// stable (returning the same primitive avoids spurious re-renders).
function notify() {
  listeners.forEach((l) => l());
}

let loaded = false;
function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  getPrefs()
    .then((p) => {
      current = {
        show_provider_icons: p.show_provider_icons,
        rich_tool_desc: p.rich_tool_desc,
        ui_font: p.ui_font,
      };
      notify();
    })
    .catch(() => {});
}

export function setUiPref<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) {
  if (current[key] === value) return;
  current = { ...current, [key]: value };
  notify();
  savePrefs({ [key]: value } as Partial<UiPrefs>).catch(() => {});
}

export function useUiPref<K extends keyof UiPrefs>(key: K): UiPrefs[K] {
  ensureLoaded();
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current[key],
    () => DEFAULTS[key],
  );
}
