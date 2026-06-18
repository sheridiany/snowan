import type { ThemeConfig } from 'antd';
import type { ThemeAppearance } from 'antd-style';

const ACCENT = '#FF7F16';

const FONT =
  "'Inter', -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";

// Warm "snowan" palette. Light keeps the cream document feel; dark keeps the
// warm accent against a deep neutral so the whole UI flips but stays on-brand.
export function snowanTheme(appearance: ThemeAppearance): ThemeConfig {
  if (appearance === 'dark') {
    return {
      token: {
        colorPrimary: ACCENT,
        borderRadius: 12,
        colorBgLayout: '#1A1714',
        colorBgContainer: '#231F1B',
        colorBgElevated: '#2A2521',
        fontFamily: FONT,
      },
    };
  }
  return {
    token: {
      colorPrimary: ACCENT,
      borderRadius: 12,
      colorBgLayout: '#F3EFE7',
      colorBgContainer: '#FBF8F2',
      colorBgElevated: '#FFFFFF',
      fontFamily: FONT,
    },
  };
}
