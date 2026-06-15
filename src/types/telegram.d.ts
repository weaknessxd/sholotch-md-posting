export type TgImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
export type TgNotificationType = 'error' | 'success' | 'warning';

export interface TgSafeAreaInset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface TgHapticFeedback {
  impactOccurred: (style: TgImpactStyle) => void;
  notificationOccurred: (type: TgNotificationType) => void;
  selectionChanged: () => void;
}

export interface TgBackButton {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

export interface TgMainButton {
  text: string;
  show: () => void;
  hide: () => void;
  enable: () => void;
  disable: () => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  setText: (text: string) => void;
  setParams: (params: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
}

export interface TgCloudStorage {
  setItem: (key: string, value: string, cb?: (err: string | null, ok?: boolean) => void) => void;
  getItem: (key: string, cb: (err: string | null, value?: string) => void) => void;
  getItems: (keys: string[], cb: (err: string | null, values?: Record<string, string>) => void) => void;
  removeItem: (key: string, cb?: (err: string | null, ok?: boolean) => void) => void;
  removeItems: (keys: string[], cb?: (err: string | null, ok?: boolean) => void) => void;
  getKeys: (cb: (err: string | null, keys?: string[]) => void) => void;
}

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgPopupButton {
  id?: string;
  type?: 'default' | 'ok' | 'close' | 'cancel' | 'destructive';
  text?: string;
}

export interface TgWebApp {
  platform?: string;
  version?: string;
  colorScheme?: 'light' | 'dark';
  viewportHeight?: number;
  viewportStableHeight?: number;
  contentSafeAreaInset?: TgSafeAreaInset;
  initData?: string;
  initDataUnsafe?: { user?: TgUser; start_param?: string };
  HapticFeedback?: TgHapticFeedback;
  BackButton: TgBackButton;
  MainButton: TgMainButton;
  CloudStorage?: TgCloudStorage;
  ready?: () => void;
  expand?: () => void;
  requestFullscreen?: () => void;
  disableVerticalSwipes?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  openTelegramLink?: (url: string) => void;
  showPopup?: (
    params: { title?: string; message: string; buttons?: TgPopupButton[] },
    cb?: (buttonId: string) => void,
  ) => void;
  showAlert?: (message: string, cb?: () => void) => void;
  showConfirm?: (message: string, cb?: (confirmed: boolean) => void) => void;
  onEvent?: (event: string, cb: () => void) => void;
  offEvent?: (event: string, cb: () => void) => void;
  isVersionAtLeast?: (version: string) => boolean;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TgWebApp;
    };
  }
}

export {};
