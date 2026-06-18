import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@lobehub/ui';
import { snowanTheme } from './theme/tokens';
import App from './App';

// lobe-ui/antd-style ThemeProvider owns the light/dark state (uncontrolled via
// defaultThemeMode); read/flip it anywhere with antd-style's useThemeMode().
// AntdProvider applies darkAlgorithm automatically per appearance.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultThemeMode="light" theme={snowanTheme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
);
