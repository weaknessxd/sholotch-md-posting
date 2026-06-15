import type { MessageEntity } from './markdown';

export interface Channel {
  /** Telegram numeric chat id (e.g. -1001234567890), as string for storage. */
  id: string;
  /** @username without @, if public. */
  username?: string;
  title: string;
  /** Optional emoji/photo placeholder letter. */
  type?: 'channel' | 'supergroup';
}

export type MediaKind = 'photo' | 'video' | 'audio' | 'document';

export interface MediaItem {
  kind: MediaKind;
  /** Data URL or remote URL of the attached media. */
  url: string;
  fileName?: string;
}

export interface DraftPayload {
  source: string; // raw markdown
  text: string; // parsed plain text
  entities: MessageEntity[];
  media: MediaItem[];
}

export const CHANNELS_KEY = 'channels';
export const MAX_CHANNELS = 10;
