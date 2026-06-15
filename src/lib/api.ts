import type { OutgoingMessage } from './blocks';
import { getInitData } from './tg';

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
 * Send the composed post (a sequence of Telegram messages) to the user's
 * private chat with the bot. The user then forwards it wherever they want.
 */
export function publish(messages: OutgoingMessage[]): Promise<{ ok: true; sent: number }> {
  return post('/api/publish', { messages });
}
