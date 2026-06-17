import { createContext, useContext } from 'react';

export type ThemeModeCtx = {
  isDark: boolean;
  toggle: () => void;
};

export const ThemeModeContext = createContext<ThemeModeCtx>({
  isDark: false,
  toggle: () => {},
});

export const useThemeMode = () => useContext(ThemeModeContext);
