import { useEffect, useState } from 'react';
import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { ThemeAppearance, ThemeMode } from 'antd-style';

const FONT =
  "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

// A full palette for one appearance. We set the seed colorPrimary + the surface
// colors explicitly and ALSO pass antd's algorithm, which overrides lobe-ui's
// own algorithm so the whole palette (primary included) actually applies.
type Palette = {
  colorPrimary: string;
  colorBgLayout: string;
  colorBgContainer: string;
  colorBgElevated: string;
  colorText: string;
  colorBorderSecondary: string;
};

export type ThemePreset = {
  id: string;
  name: string;
  light?: Palette;
  dark?: Palette;
};

// Named, full-palette themes (Craft-style). Each retheme covers the whole app.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'snowan',
    name: 'Snowan 暖橙',
    light: { colorPrimary: '#FF7F16', colorBgLayout: '#F3EFE7', colorBgContainer: '#FBF8F2', colorBgElevated: '#FFFFFF', colorText: '#2B2620', colorBorderSecondary: '#E7E0D4' },
    dark: { colorPrimary: '#FF7F16', colorBgLayout: '#1A1714', colorBgContainer: '#231F1B', colorBgElevated: '#2A2521', colorText: '#F1EBE2', colorBorderSecondary: '#332D27' },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    light: { colorPrimary: '#8839ef', colorBgLayout: '#eff1f5', colorBgContainer: '#e6e9ef', colorBgElevated: '#ffffff', colorText: '#4c4f69', colorBorderSecondary: '#dce0e8' },
    dark: { colorPrimary: '#cba6f7', colorBgLayout: '#1e1e2e', colorBgContainer: '#181825', colorBgElevated: '#313244', colorText: '#cdd6f4', colorBorderSecondary: '#313244' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    light: { colorPrimary: '#7c4dff', colorBgLayout: '#f4f2fb', colorBgContainer: '#fbfaff', colorBgElevated: '#ffffff', colorText: '#383a59', colorBorderSecondary: '#e4e0f3' },
    dark: { colorPrimary: '#bd93f9', colorBgLayout: '#282a36', colorBgContainer: '#21222c', colorBgElevated: '#343746', colorText: '#f8f8f2', colorBorderSecondary: '#44475a' },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    light: { colorPrimary: '#d65d0e', colorBgLayout: '#fbf1c7', colorBgContainer: '#f2e5bc', colorBgElevated: '#ffffff', colorText: '#3c3836', colorBorderSecondary: '#ebdbb2' },
    dark: { colorPrimary: '#fe8019', colorBgLayout: '#282828', colorBgContainer: '#1d2021', colorBgElevated: '#3c3836', colorText: '#ebdbb2', colorBorderSecondary: '#3c3836' },
  },
  {
    id: 'nord',
    name: 'Nord',
    light: { colorPrimary: '#5e81ac', colorBgLayout: '#eceff4', colorBgContainer: '#e5e9f0', colorBgElevated: '#ffffff', colorText: '#2e3440', colorBorderSecondary: '#d8dee9' },
    dark: { colorPrimary: '#88c0d0', colorBgLayout: '#2e3440', colorBgContainer: '#3b4252', colorBgElevated: '#434c5e', colorText: '#eceff4', colorBorderSecondary: '#434c5e' },
  },
  {
    id: 'github',
    name: 'GitHub',
    light: { colorPrimary: '#0969da', colorBgLayout: '#ffffff', colorBgContainer: '#f6f8fa', colorBgElevated: '#ffffff', colorText: '#1f2328', colorBorderSecondary: '#d1d9e0' },
    dark: { colorPrimary: '#2f81f7', colorBgLayout: '#0d1117', colorBgContainer: '#161b22', colorBgElevated: '#21262d', colorText: '#e6edf3', colorBorderSecondary: '#30363d' },
  },
];

export const DEFAULT_THEME_ID = 'snowan';

function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

// Returns an appearance-aware antd ThemeConfig. Including `algorithm` makes this
// win over lobe-ui's own algorithm, so colorPrimary + surfaces apply exactly.
export function makeThemeConfig(themeId: string) {
  const preset = presetById(themeId);
  return function themeFn(appearance: ThemeAppearance): ThemeConfig {
    const dark = appearance === 'dark';
    const pal = (dark ? preset.dark : preset.light) ?? preset.light ?? preset.dark!;
    return {
      algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: { ...pal, borderRadius: 12, fontFamily: FONT },
    };
  };
}

// --- persistence -----------------------------------------------------------
const THEME_KEY = 'snowan.theme';
const MODE_KEY = 'snowan.themeMode';

export function readStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return (window.localStorage.getItem(MODE_KEY) as ThemeMode) || 'light';
}

export function persistThemeMode(mode: ThemeMode) {
  if (typeof window !== 'undefined') window.localStorage.setItem(MODE_KEY, mode);
}

// Selected theme preset id, persisted to localStorage (same-tab + cross-tab).
export function useThemePreset(): [string, (id: string) => void] {
  const [id, setId] = useState(
    () =>
      (typeof window !== 'undefined' && window.localStorage.getItem(THEME_KEY)) ||
      DEFAULT_THEME_ID,
  );
  useEffect(() => {
    const sync = (e: StorageEvent) => {
      if (e.key === THEME_KEY && e.newValue) setId(e.newValue);
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const set = (next: string) => {
    setId(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, next);
  };
  return [id, set];
}
