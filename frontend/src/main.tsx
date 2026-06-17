import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import { snowanTheme } from './theme/tokens';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={snowanTheme}>
      <App />
    </ConfigProvider>
  </React.StrictMode>,
);
