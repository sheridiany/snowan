// Self-hosted serif display face (offline — bundled, never a CDN). Provides
// 'Fraunces Variable', the head of the fontFamilyDisplay stack.
import '@fontsource-variable/fraunces';
import './index.css';
import React, { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@lobehub/ui';
import type { ThemeMode } from 'antd-style';
import {
  makeThemeConfig,
  persistThemeMode,
  readStoredThemeMode,
  snowanCustomToken,
  useThemePreset,
} from './theme/themes';
import { useUiPref } from './hooks/useUiPrefs';
import App from './App';

// System sans-serif stack used when ui_font is 'system' (no bundled Inter).
const SYSTEM_FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

// lobe-ui's ThemeProvider merges the `theme` prop as a plain object, so we must
// hand it a STATIC ThemeConfig (not a function). themeMode is therefore controlled
// here: children flip it via antd-style useThemeMode() → onThemeModeChange. The
// selected named theme provides the full palette (with `algorithm`, so it wins
// over lobe-ui's own algorithm and the whole app re-themes).
function Root() {
  const [themeId] = useThemePreset();
  const [mode, setMode] = useState<ThemeMode>(() => readStoredThemeMode());
  useEffect(() => persistThemeMode(mode), [mode]);

  const appearance =
    mode === 'auto'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;

  const uiFont = useUiPref('ui_font');

  const theme = useMemo(() => {
    const base = makeThemeConfig(themeId)(appearance);
    if (uiFont !== 'system') return base;
    return {
      ...base,
      token: { ...base.token, fontFamily: SYSTEM_FONT },
    };
  }, [themeId, appearance, uiFont]);

  return (
    <ThemeProvider
      themeMode={mode}
      onThemeModeChange={setMode}
      theme={theme}
      customToken={() => snowanCustomToken(themeId, appearance)}
    >
      <App />
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
