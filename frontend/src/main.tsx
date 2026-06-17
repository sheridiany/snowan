import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@lobehub/ui';
import { snowanTheme } from './theme/tokens';
import { ThemeModeContext } from './theme/ThemeModeContext';
import App from './App';

function Root() {
  const [isDark, setIsDark] = useState(false);
  return (
    <ThemeModeContext.Provider value={{ isDark, toggle: () => setIsDark((v) => !v) }}>
      <ThemeProvider
        themeMode={isDark ? 'dark' : 'light'}
        appearance={isDark ? 'dark' : 'light'}
        theme={snowanTheme(isDark ? 'dark' : 'light')}
      >
        <App />
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
