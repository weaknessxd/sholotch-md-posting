import { useEffect, useState } from 'react';
import {
  disableVerticalSwipes,
  getColorScheme,
  getContentSafeArea,
  hapticImpact,
  isTMA as detectTMA,
  onContentSafeAreaChanged,
  onThemeChanged,
  setHeaderColor,
  tgExpand,
  tgReady,
} from '@/lib/tg';

export type ColorScheme = 'light' | 'dark';

export interface TelegramThemeState {
  colorScheme: ColorScheme;
  isTMA: boolean;
}

function initialScheme(tma: boolean): ColorScheme {
  if (tma) return (getColorScheme() ?? 'light') as ColorScheme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyScheme(scheme: ColorScheme) {
  document.documentElement.classList.toggle('dark', scheme === 'dark');
  document.documentElement.dataset.theme = scheme;
}

function applySafeArea() {
  const inset = getContentSafeArea();
  const root = document.documentElement;
  root.style.setProperty('--tg-safe-top', `${inset.top}px`);
  root.style.setProperty('--tg-safe-right', `${inset.right}px`);
  root.style.setProperty('--tg-safe-bottom', `${inset.bottom}px`);
  root.style.setProperty('--tg-safe-left', `${inset.left}px`);
}

export function useTelegramTheme(): TelegramThemeState {
  const [isTMA] = useState(detectTMA);
  const [scheme, setScheme] = useState<ColorScheme>(() => initialScheme(isTMA));

  useEffect(() => {
    applyScheme(scheme);
    if (isTMA) setHeaderColor(scheme === 'dark' ? '#0A0A0A' : '#FFFFFF');
  }, [scheme, isTMA]);

  useEffect(() => {
    if (isTMA) {
      tgReady();
      tgExpand();
      disableVerticalSwipes();
      applySafeArea();
      hapticImpact('light');

      const offSafe = onContentSafeAreaChanged(applySafeArea);
      const offTheme = onThemeChanged(() => {
        setScheme((getColorScheme() ?? 'light') as ColorScheme);
      });

      return () => {
        offSafe();
        offTheme();
      };
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onMediaChange = () => setScheme(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onMediaChange);
    return () => mq.removeEventListener('change', onMediaChange);
  }, [isTMA]);

  return { colorScheme: scheme, isTMA };
}
