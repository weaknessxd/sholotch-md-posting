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
 * Send the composed post as a single Telegram Rich Message (HTML) to the
 * user's private chat with the bot. The user then forwards it.
 */
export function publish(html: string): Promise<{ ok: true }> {
  return post('/api/publish', { html });
}
