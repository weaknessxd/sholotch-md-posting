import type { TgImpactStyle, TgSafeAreaInset, TgUser, TgWebApp } from '@/types/telegram';

function getTg(): TgWebApp | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.Telegram?.WebApp;
}

export function hapticImpact(style: TgImpactStyle = 'light'): void {
  try {
    getTg()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // ignore
  }
}

export function hapticSelection(): void {
  try {
    getTg()?.HapticFeedback?.selectionChanged();
  } catch {
    // ignore
  }
}

export function hapticNotification(type: 'error' | 'success' | 'warning'): void {
  try {
    getTg()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // ignore
  }
}

export function setHeaderColor(hex: `#${string}`): void {
  try {
    const tg = getTg();
    tg?.setHeaderColor?.(hex);
    tg?.setBackgroundColor?.(hex);
  } catch {
    // ignore
  }
}

export function disableVerticalSwipes(): void {
  try {
    getTg()?.disableVerticalSwipes?.();
  } catch {
    // ignore
  }
}

export type SafeAreaInset = TgSafeAreaInset;

export function getContentSafeArea(): SafeAreaInset {
  try {
    return getTg()?.contentSafeAreaInset ?? { top: 0, right: 0, bottom: 0, left: 0 };
  } catch {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
}

export function onContentSafeAreaChanged(cb: () => void): () => void {
  const tg = getTg();
  if (!tg?.onEvent) return () => {};
  try {
    tg.onEvent('contentSafeAreaChanged', cb);
    return () => {
      try {
        tg.offEvent?.('contentSafeAreaChanged', cb);
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

export function showBackButton(onClick: () => void): () => void {
  const tg = getTg();
  const handler = () => onClick();
  let shown = false;
  try {
    if (tg?.BackButton) {
      tg.BackButton.onClick(handler);
      tg.BackButton.show();
      shown = true;
    }
  } catch {
    // ignore
  }
  return () => {
    if (!shown) return;
    try {
      tg?.BackButton.offClick(handler);
      tg?.BackButton.hide();
    } catch {
      // ignore
    }
  };
}

export function getPlatform(): string | undefined {
  try {
    return getTg()?.platform;
  } catch {
    return undefined;
  }
}

export function tgReady(): void {
  try {
    getTg()?.ready?.();
  } catch {
    // ignore
  }
}

export function tgExpand(): void {
  try {
    getTg()?.expand?.();
  } catch {
    // ignore
  }
}

export function getColorScheme(): 'light' | 'dark' | undefined {
  try {
    return getTg()?.colorScheme;
  } catch {
    return undefined;
  }
}

export function onThemeChanged(cb: () => void): () => void {
  const tg = getTg();
  if (!tg?.onEvent) return () => {};
  try {
    tg.onEvent('themeChanged', cb);
    return () => {
      try {
        tg.offEvent?.('themeChanged', cb);
      } catch {
        // ignore
      }
    };
  } catch {
    return () => {};
  }
}

export function isTMA(): boolean {
  const platform = getPlatform();
  return !!platform && platform !== 'unknown';
}

/** Raw initData string — send to backend for HMAC verification. */
export function getInitData(): string {
  try {
    return getTg()?.initData ?? '';
  } catch {
    return '';
  }
}

export function getCurrentUser(): TgUser | undefined {
  try {
    return getTg()?.initDataUnsafe?.user;
  } catch {
    return undefined;
  }
}

export function showAlert(message: string): void {
  const tg = getTg();
  if (tg?.showAlert) tg.showAlert(message);
  else if (typeof window !== 'undefined') window.alert(message);
}

export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tg = getTg();
    if (tg?.showConfirm) tg.showConfirm(message, (ok) => resolve(ok));
    else resolve(typeof window !== 'undefined' ? window.confirm(message) : false);
  });
}

export function isVersionAtLeast(version: string): boolean {
  try {
    return getTg()?.isVersionAtLeast?.(version) === true;
  } catch {
    return false;
  }
}

/* ─── CloudStorage (promise wrappers) ───────────────────────────────────── */

// CloudStorage requires Bot API 6.9+. On older clients (and the dev preview's
// mocked WebApp) its methods log an error and never fire their callback, which
// would hang our promises — so we fall back to localStorage there.
function getCloud() {
  const tg = getTg();
  if (!tg?.CloudStorage || !isVersionAtLeast('6.9')) return undefined;
  return tg.CloudStorage;
}

export function cloudGetItem(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const cs = getCloud();
    if (!cs) {
      // dev fallback: localStorage
      resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null);
      return;
    }
    cs.getItem(key, (err, value) => resolve(err ? null : (value ?? null)));
  });
}

export function cloudSetItem(key: string, value: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cs = getCloud();
    if (!cs) {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      resolve(true);
      return;
    }
    cs.setItem(key, value, (err, ok) => resolve(!err && ok !== false));
  });
}

export function cloudRemoveItem(key: string): Promise<boolean> {
  return new Promise((resolve) => {
    const cs = getCloud();
    if (!cs) {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      resolve(true);
      return;
    }
    cs.removeItem(key, (err, ok) => resolve(!err && ok !== false));
  });
}
