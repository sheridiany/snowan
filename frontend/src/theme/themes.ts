import { useSyncExternalStore } from 'react';
import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { ThemeAppearance, ThemeMode } from 'antd-style';

const FONT =
  "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

// A full, hand-tuned palette for one appearance.
type Palette = {
  accent: string;
  bg: string;
  surface: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSecondary: string;
};

export type ThemePreset = { id: string; name: string; light: Palette; dark: Palette };

// Named, full-palette themes. Named schemes use their official specs
// (web-verified); Snowan is the warm house brand. Both appearances are tuned.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'snowan',
    name: 'Snowan 暖橙',
    light: { accent: '#EF6C00', bg: '#FAF6EF', surface: '#FFFDF8', elevated: '#FFFFFF', text: '#1F1A14', textSecondary: '#5C544A', textTertiary: '#938A7C', border: '#E3DACB', borderSecondary: '#EFE8DC' },
    dark: { accent: '#FF8C2E', bg: '#1A1613', surface: '#242019', elevated: '#2E2920', text: '#F2EADD', textSecondary: '#B5AB99', textTertiary: '#857C6C', border: '#3D3730', borderSecondary: '#2E2922' },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    light: { accent: '#8839ef', bg: '#eff1f5', surface: '#e6e9ef', elevated: '#f4f5f8', text: '#4c4f69', textSecondary: '#5c5f77', textTertiary: '#6c6f85', border: '#bcc0cc', borderSecondary: '#ccd0da' },
    dark: { accent: '#cba6f7', bg: '#1e1e2e', surface: '#313244', elevated: '#45475a', text: '#cdd6f4', textSecondary: '#bac2de', textTertiary: '#a6adc8', border: '#45475a', borderSecondary: '#313244' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    light: { accent: '#7c5cbf', bg: '#f6f4fb', surface: '#fbfaff', elevated: '#ffffff', text: '#282a36', textSecondary: '#5b5d72', textTertiary: '#8b8da6', border: '#d9d4ea', borderSecondary: '#ebe7f5' },
    dark: { accent: '#bd93f9', bg: '#282a36', surface: '#2e303e', elevated: '#383a4a', text: '#f8f8f2', textSecondary: '#b8bad4', textTertiary: '#6272a4', border: '#44475a', borderSecondary: '#383a4a' },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    light: { accent: '#d65d0e', bg: '#fbf1c7', surface: '#f9f5d7', elevated: '#fffbef', text: '#3c3836', textSecondary: '#7c6f64', textTertiary: '#928374', border: '#a89984', borderSecondary: '#d5c4a1' },
    dark: { accent: '#fe8019', bg: '#282828', surface: '#32302f', elevated: '#3c3836', text: '#ebdbb2', textSecondary: '#a89984', textTertiary: '#928374', border: '#665c54', borderSecondary: '#504945' },
  },
  {
    id: 'nord',
    name: 'Nord',
    light: { accent: '#5e81ac', bg: '#eceff4', surface: '#f9fafc', elevated: '#ffffff', text: '#2e3440', textSecondary: '#4c566a', textTertiary: '#6b7689', border: '#d3d8e0', borderSecondary: '#e1e6ee' },
    dark: { accent: '#88c0d0', bg: '#2e3440', surface: '#3b4252', elevated: '#434c5e', text: '#eceff4', textSecondary: '#d8dee9', textTertiary: '#9aa6bd', border: '#4a5266', borderSecondary: '#3f4759' },
  },
  {
    id: 'github',
    name: 'GitHub',
    light: { accent: '#0969da', bg: '#f6f8fa', surface: '#ffffff', elevated: '#ffffff', text: '#1f2328', textSecondary: '#59636e', textTertiary: '#818b98', border: '#d1d9e0', borderSecondary: '#e4e8ec' },
    dark: { accent: '#2f81f7', bg: '#0d1117', surface: '#161b22', elevated: '#1c2128', text: '#e6edf3', textSecondary: '#9198a1', textTertiary: '#6e7681', border: '#30363d', borderSecondary: '#21262d' },
  },
];

export const DEFAULT_THEME_ID = 'snowan';

function presetById(id: string): ThemePreset {
  return THEME_PRESETS.find((t) => t.id === id) ?? THEME_PRESETS[0];
}

// WCAG relative luminance, used to pick legible text on the accent button.
function relLum(hex: string): number {
  const c = hex.replace('#', '');
  const ch = (i: number) => {
    const x = parseInt(c.slice(i, i + 2), 16) / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
}
function contrast(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
// White or near-black on the accent — whichever is more legible.
function onAccent(accent: string): string {
  const la = relLum(accent);
  return contrast(la, 1) >= contrast(la, relLum('#1a1a1a')) ? '#ffffff' : '#1a1a1a';
}

// Appearance-aware antd ThemeConfig. `algorithm` is included so this wins over
// lobe-ui's own algorithm; base/text seeds make derived fills (hover/active) sit
// in-theme; the primary button text auto-contrasts against the accent.
export function makeThemeConfig(themeId: string) {
  const preset = presetById(themeId);
  return function themeFn(appearance: ThemeAppearance): ThemeConfig {
    const dark = appearance === 'dark';
    const p = dark ? preset.dark : preset.light;
    return {
      algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
      token: {
        colorPrimary: p.accent,
        colorBgBase: p.bg,
        colorTextBase: p.text,
        colorBgLayout: p.bg,
        colorBgContainer: p.surface,
        colorBgElevated: p.elevated,
        colorText: p.text,
        colorTextSecondary: p.textSecondary,
        colorTextTertiary: p.textTertiary,
        colorTextQuaternary: p.textTertiary,
        colorBorder: p.border,
        colorBorderSecondary: p.borderSecondary,
        // Craft-style small radii: base 6 derives sm 4 / base 6 / lg 8.
        borderRadius: 6,
        fontFamily: FONT,
      },
      components: { Button: { primaryColor: onAccent(p.accent) } },
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

// Shared external store so EVERY consumer (Root + the settings dropdown) sees the
// same theme id and re-renders together — a per-hook useState would split the
// state and the live switch wouldn't reach Root.
let currentTheme =
  (typeof window !== 'undefined' && window.localStorage.getItem(THEME_KEY)) ||
  DEFAULT_THEME_ID;
const themeListeners = new Set<() => void>();

export function setThemePreset(id: string) {
  currentTheme = id;
  if (typeof window !== 'undefined') window.localStorage.setItem(THEME_KEY, id);
  themeListeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && e.newValue && e.newValue !== currentTheme) {
      currentTheme = e.newValue;
      themeListeners.forEach((l) => l());
    }
  });
}

export function useThemePreset(): [string, (id: string) => void] {
  const id = useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    () => currentTheme,
    () => DEFAULT_THEME_ID,
  );
  return [id, setThemePreset];
}
