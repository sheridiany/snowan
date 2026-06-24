import { useSyncExternalStore } from 'react';
import { theme as antdTheme, type ThemeConfig } from 'antd';
import type { ThemeAppearance, ThemeMode } from 'antd-style';

// Custom tokens we inject via lobe-ui ThemeProvider's `customToken` prop (NOT
// antd's ThemeConfig.token — antd 6 drops unknown keys). Augmenting antd-style's
// CustomToken is what makes `token.colorCatX` typed inside createStyles.
declare module 'antd-style' {
  interface CustomToken {
    colorCatSearch: string;
    colorCatShell: string;
    colorCatFile: string;
    colorCatKnowledge: string;
    colorCatTime: string;
    colorBrandGradient: string;
    colorBrandGlow: string;
    colorSurfaceGlow: string;
    // Ambient app shell + glass overlays + hero glow. All rgb-budgeted (no
    // color-mix). See sceneTokens / glassTokens below.
    colorSceneBg: string;
    colorSceneSpotlight: string;
    colorGlassBg: string;
    colorGlassBorder: string;
    glassBlur: string;
    shadowGlass: string;
    colorHeroGlow: string;
    // Serif display stack — not an antd-native key, so it must ride CustomToken
    // (antd 6 drops unknown ThemeConfig.token keys).
    fontFamilyDisplay: string;
  }
}

// The single type scale (px). body=14 is the base; every component font-size
// references TYPE.* — no scattered magic numbers.
export const TYPE = {
  micro: 11,
  small: 12,
  dense: 13,
  body: 14,
  section: 16,
  block: 20,
  page: 28,
  display: 44,
} as const;

const FONT =
  "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

// Serif display stack. 'Fraunces Variable' is the self-hosted variable serif
// (imported in main.tsx); CJK falls back to Songti/Noto Serif, then Georgia.
const FONT_DISPLAY =
  "'Fraunces Variable', 'Songti SC', 'Noto Serif SC', Georgia, serif";

// A full, hand-tuned palette for one appearance.
type Palette = {
  accent: string;
  bg: string;
  surface: string;
  elevated: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textQuaternary: string;
  border: string;
  borderSecondary: string;
  // Status seeds — per-theme so antd's algorithm derives the whole
  // Bg/Border/Text/Hover family in-theme (a generic green/red looks "off-brand").
  success: string;
  warning: string;
  error: string;
  info: string;
};

export type ThemePreset = { id: string; name: string; light: Palette; dark: Palette };

// Named, full-palette themes. Named schemes use their official specs
// (web-verified); Snowan is the warm house brand. Both appearances are tuned.
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'snowan',
    name: 'Snowan 暖橙',
    light: { accent: '#C2703D', bg: '#F6F1E9', surface: '#FCF9F3', elevated: '#FFFFFF', text: '#3A322A', textSecondary: '#6E6357', textTertiary: '#9C8E7E', textQuaternary: '#BDB1A0', border: '#ECE4D7', borderSecondary: '#F3ECE1', success: '#6E8B5B', warning: '#C2922F', error: '#B5503C', info: '#5E7C8B' },
    dark: { accent: '#D89063', bg: '#1E1A17', surface: '#262220', elevated: '#2F2926', text: '#EDE6DD', textSecondary: '#B3A99C', textTertiary: '#80776B', textQuaternary: '#5E574E', border: '#3A332E', borderSecondary: '#322C28', success: '#8AA876', warning: '#D9A94A', error: '#CC6B54', info: '#7E9AAA' },
  },
  {
    id: 'catppuccin',
    name: 'Catppuccin',
    light: { accent: '#8839ef', bg: '#eff1f5', surface: '#e6e9ef', elevated: '#f4f5f8', text: '#4c4f69', textSecondary: '#5c5f77', textTertiary: '#6c6f85', textQuaternary: '#8c8fa1', border: '#bcc0cc', borderSecondary: '#ccd0da', success: '#40a02b', warning: '#df8e1d', error: '#d20f39', info: '#1e66f5' },
    dark: { accent: '#cba6f7', bg: '#1e1e2e', surface: '#313244', elevated: '#45475a', text: '#cdd6f4', textSecondary: '#bac2de', textTertiary: '#a6adc8', textQuaternary: '#7f849c', border: '#45475a', borderSecondary: '#313244', success: '#a6e3a1', warning: '#f9e2af', error: '#f38ba8', info: '#89b4fa' },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    light: { accent: '#7c5cbf', bg: '#f6f4fb', surface: '#fbfaff', elevated: '#ffffff', text: '#282a36', textSecondary: '#5b5d72', textTertiary: '#8b8da6', textQuaternary: '#aeafc2', border: '#d9d4ea', borderSecondary: '#ebe7f5', success: '#2faf5c', warning: '#b08800', error: '#d83a3a', info: '#5a7fc4' },
    dark: { accent: '#bd93f9', bg: '#282a36', surface: '#2e303e', elevated: '#383a4a', text: '#f8f8f2', textSecondary: '#b8bad4', textTertiary: '#6272a4', textQuaternary: '#4d5980', border: '#44475a', borderSecondary: '#383a4a', success: '#50fa7b', warning: '#f1fa8c', error: '#ff5555', info: '#8be9fd' },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox',
    light: { accent: '#d65d0e', bg: '#fbf1c7', surface: '#f9f5d7', elevated: '#fffbef', text: '#3c3836', textSecondary: '#7c6f64', textTertiary: '#928374', textQuaternary: '#b0a089', border: '#a89984', borderSecondary: '#d5c4a1', success: '#79740e', warning: '#b57614', error: '#9d0006', info: '#076678' },
    dark: { accent: '#fe8019', bg: '#282828', surface: '#32302f', elevated: '#3c3836', text: '#ebdbb2', textSecondary: '#a89984', textTertiary: '#928374', textQuaternary: '#736759', border: '#665c54', borderSecondary: '#504945', success: '#b8bb26', warning: '#fabd2f', error: '#fb4934', info: '#83a598' },
  },
  {
    id: 'nord',
    name: 'Nord',
    light: { accent: '#5e81ac', bg: '#eceff4', surface: '#f9fafc', elevated: '#ffffff', text: '#2e3440', textSecondary: '#4c566a', textTertiary: '#6b7689', textQuaternary: '#9099ab', border: '#d3d8e0', borderSecondary: '#e1e6ee', success: '#5b7a52', warning: '#b08a3e', error: '#a8434c', info: '#5e81ac' },
    dark: { accent: '#88c0d0', bg: '#2e3440', surface: '#3b4252', elevated: '#434c5e', text: '#eceff4', textSecondary: '#d8dee9', textTertiary: '#9aa6bd', textQuaternary: '#717c93', border: '#4a5266', borderSecondary: '#3f4759', success: '#a3be8c', warning: '#ebcb8b', error: '#bf616a', info: '#81a1c1' },
  },
  {
    id: 'github',
    name: 'GitHub',
    light: { accent: '#0969da', bg: '#f6f8fa', surface: '#ffffff', elevated: '#ffffff', text: '#1f2328', textSecondary: '#59636e', textTertiary: '#818b98', textQuaternary: '#a8b1bb', border: '#d1d9e0', borderSecondary: '#e4e8ec', success: '#1a7f37', warning: '#9a6700', error: '#cf222e', info: '#0969da' },
    dark: { accent: '#2f81f7', bg: '#0d1117', surface: '#161b22', elevated: '#1c2128', text: '#e6edf3', textSecondary: '#9198a1', textTertiary: '#6e7681', textQuaternary: '#545b64', border: '#30363d', borderSecondary: '#21262d', success: '#3fb950', warning: '#d29922', error: '#f85149', info: '#58a6ff' },
  },
];

export const DEFAULT_THEME_ID = 'snowan';

// App-chrome layout scale — fixed pixel sizes for the shell's header/nav/footer
// (not theme-aware, so plain consts rather than tokens).
export const LAYOUT = { headerHeight: 52, navBtn: 38, footerBtn: 34, rowGap: 11, handle: 6 } as const;

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

function hexToRgb(hex: string): string {
  const c = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)).join(', ');
}

// Linear mix of two hexes -> an rgb() string. Used to keep custom token colors
// in-theme (tint a fixed category hue toward the theme's text) and to derive the
// brand gradient stop — all pre-budgeted to rgb() so we never touch color-mix
// (unsupported risk in the Tauri WKWebView).
function mixHex(a: string, b: string, t: number): string {
  const ch = (h: string, i: number) => parseInt(h.replace('#', '').slice(i, i + 2), 16);
  const m = (i: number) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t);
  return `rgb(${m(0)}, ${m(2)}, ${m(4)})`;
}

// Top inner highlight + bottom inner shade — the cheap trick that lifts a flat
// card into a lit surface. Neutral, low-alpha in dark (pure white blows out).
function edgeHighlight(dark: boolean): string {
  return dark
    ? 'inset 0 1px 0 0 rgba(255,255,255,0.05)'
    : 'inset 0 1px 0 0 rgba(255,255,255,0.7)';
}

// Craft-style soft "card" shadow: a foreground-tinted 1px ring plus a whisper of
// blur (light), leaning to an outline in dark. This replaces hard card/pane
// borders — the source of the stark, boxed-in look.
function cardShadow(p: Palette, dark: boolean): string {
  const ring = hexToRgb(p.text);
  return dark
    ? `0 0 0 1px rgba(${ring}, 0.10), 0 4px 12px -4px rgba(0,0,0,0.4)`
    : `0 0 0 1px rgba(${ring}, 0.05), 0 4px 12px -4px rgba(0,0,0,0.06)`;
}
function cardShadowHover(p: Palette, dark: boolean): string {
  const ring = hexToRgb(p.text);
  return dark
    ? `0 0 0 1px rgba(${ring}, 0.14), 0 2px 6px -1px rgba(0,0,0,0.45), 0 8px 16px -5px rgba(0,0,0,0.35)`
    : `0 0 0 1px rgba(${ring}, 0.07), 0 2px 4px -1px rgba(0,0,0,0.06), 0 10px 18px -6px rgba(0,0,0,0.08)`;
}
// The elevated tier — for overlays (Modal/Dropdown/Select via antd's boxShadow).
function overlayShadow(p: Palette, dark: boolean): string {
  const ring = hexToRgb(p.text);
  return dark
    ? `0 0 0 1px rgba(${ring}, 0.16), 0 8px 24px -6px rgba(0,0,0,0.55), 0 16px 40px -12px rgba(0,0,0,0.45)`
    : `0 0 0 1px rgba(${ring}, 0.08), 0 8px 24px -8px rgba(0,0,0,0.12), 0 16px 40px -16px rgba(0,0,0,0.10)`;
}

// Fixed category hues, tinted slightly toward the theme's text so they read
// in-theme across all 6 schemes. Low mix or five categories muddy together.
function categoryTokens(p: Palette, dark: boolean) {
  const t = dark ? 0.18 : 0.1;
  return {
    colorCatSearch: mixHex('#5E7C8B', p.text, t),
    colorCatShell: mixHex('#7A6E8B', p.text, t),
    colorCatFile: mixHex('#6E8B5B', p.text, t),
    colorCatKnowledge: mixHex('#C2922F', p.text, t),
    colorCatTime: mixHex('#9C6F8B', p.text, t),
  };
}
// Brand gradient + glows for hero surfaces / the empty-state orb. rgb-budgeted.
// Glows nudged one notch braver than before (still restrained, still in-theme).
function gradientTokens(p: Palette, dark: boolean) {
  const a = hexToRgb(p.accent);
  return {
    colorBrandGradient: `linear-gradient(135deg, ${p.accent} 0%, ${mixHex(p.accent, p.bg, 0.35)} 100%)`,
    colorBrandGlow: `rgba(${a}, ${dark ? 0.28 : 0.2})`,
    colorSurfaceGlow: `radial-gradient(120% 120% at 50% 0%, rgba(${a}, ${dark ? 0.07 : 0.04}) 0%, transparent 62%)`,
    // One step stronger than colorSurfaceGlow — for hero / welcome regions.
    colorHeroGlow: `radial-gradient(130% 120% at 50% -10%, rgba(${a}, ${dark ? 0.12 : 0.075}) 0%, transparent 64%)`,
  };
}

// Aurora app-shell backdrop: 2-3 ultra-low-alpha soft blooms (accent + info)
// floated over palette.bg. Content-safe — meant to be felt, not seen.
function sceneTokens(p: Palette, dark: boolean) {
  const a = hexToRgb(p.accent);
  const i = hexToRgb(p.info);
  const bloomA = dark ? 0.05 : 0.03;
  const bloomB = dark ? 0.04 : 0.0225;
  const bloomC = dark ? 0.03 : 0.0175;
  return {
    colorSceneBg: [
      `radial-gradient(58% 42% at 12% 4%, rgba(${a}, ${bloomA}) 0%, transparent 60%)`,
      `radial-gradient(50% 46% at 92% 8%, rgba(${i}, ${bloomB}) 0%, transparent 62%)`,
      `radial-gradient(64% 50% at 78% 96%, rgba(${a}, ${bloomC}) 0%, transparent 64%)`,
      p.bg,
    ].join(', '),
    // Top spotlight overlay for hero strips — more present in the dark.
    colorSceneSpotlight: `radial-gradient(80% 60% at 50% -16%, rgba(${a}, ${dark ? 0.18 : 0.1}) 0%, transparent 60%)`,
  };
}

// Frosted-glass overlay surface: translucent fill + hairline highlight border +
// layered glass shadow. blur lives as a string so consumers feed backdrop-filter.
function glassTokens(p: Palette, dark: boolean) {
  const fill = hexToRgb(p.elevated);
  const ring = hexToRgb(p.text);
  return {
    colorGlassBg: `rgba(${fill}, ${dark ? 0.56 : 0.66})`,
    // Dark: a bright white hairline reads as the lit top edge. Light: a near-white
    // glass on a near-white scene makes a white border vanish, so trace the outline
    // in the foreground color instead — the white top highlight still lives in
    // shadowGlass's inset, keeping the lit-edge feel.
    colorGlassBorder: dark ? 'rgba(255,255,255,0.1)' : `rgba(${ring}, 0.1)`,
    glassBlur: '18px',
    shadowGlass: dark
      ? `inset 0 1px 0 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(${ring}, 0.14), 0 12px 36px -10px rgba(0,0,0,0.55)`
      : `inset 0 1px 0 0 rgba(255,255,255,0.8), 0 0 0 1px rgba(${ring}, 0.06), 0 12px 32px -12px rgba(0,0,0,0.14)`,
  };
}

// The custom-token bag injected via lobe-ui ThemeProvider's `customToken` prop.
export function snowanCustomToken(themeId: string, appearance: ThemeAppearance) {
  const preset = presetById(themeId);
  const dark = appearance === 'dark';
  const p = dark ? preset.dark : preset.light;
  return {
    ...categoryTokens(p, dark),
    ...gradientTokens(p, dark),
    ...sceneTokens(p, dark),
    ...glassTokens(p, dark),
    fontFamilyDisplay: FONT_DISPLAY,
  };
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
        colorTextQuaternary: p.textQuaternary,
        colorBorder: p.border,
        colorBorderSecondary: p.borderSecondary,
        // Status seeds only — antd's algorithm derives the Bg/Border/Text/Hover
        // family from these, so consumers (ToolCallCard, ApprovalCard, …) match
        // the theme without us hand-writing any *Bg/*Border/*Text.
        colorSuccess: p.success,
        colorWarning: p.warning,
        colorError: p.error,
        colorInfo: p.info,
        // Craft-style small radii: base 6 (sm 4 / base 6) for buttons/rows,
        // softer 10 for cards.
        borderRadius: 6,
        borderRadiusLG: 10,
        // Lit-surface card shadows (edge highlight + soft tinted shadow) that
        // stand in for borders; overlay tier for Modal/Dropdown/Select.
        boxShadowTertiary: `${edgeHighlight(dark)}, ${cardShadow(p, dark)}`,
        boxShadowSecondary: `${edgeHighlight(dark)}, ${cardShadowHover(p, dark)}`,
        boxShadow: overlayShadow(p, dark),
        fontFamily: FONT,
        fontSize: TYPE.body,
        fontSizeSM: TYPE.small,
        fontSizeLG: TYPE.section,
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
