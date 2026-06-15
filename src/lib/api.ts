import { getInitData } from './tg';
import type { Channel, DraftPayload } from './types';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      // initData is verified server-side via HMAC; this authenticates the user.
      'x-telegram-init-data': getInitData(),
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data as T;
}

/**
 * Resolve a @username/link, verify the bot is an admin of that channel, and
 * return canonical channel info to store.
 */
export function resolveChannel(query: string): Promise<Channel> {
  return post<Channel>('/api/resolve-channel', { query });
}

/**
 * Send the composed post as a preview to the user's private chat with the bot,
 * along with inline Confirm/Cancel buttons. The backend publishes to the
 * target channel (via copyMessage) only after the user taps Confirm.
 */
export function sendPreview(channel: Channel, draft: DraftPayload): Promise<{ ok: true }> {
  return post('/api/preview', { channel, draft });
}
