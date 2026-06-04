import { useEffect } from 'react';
import { resolveEffectiveTheme, useThemeStore } from '@/stores/theme-store';

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeStore((state) => state.theme);

  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const effective = resolveEffectiveTheme(theme);
      root.classList.toggle('dark', effective === 'dark');
    };

    apply();

    if (theme !== 'system') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);

  return <>{children}</>;
}
