export type MediaKind = 'photo' | 'video' | 'audio' | 'document';

export interface MediaItem {
  kind: MediaKind;
  /** Data URL or remote URL of the attached media. */
  url: string;
  fileName?: string;
}
