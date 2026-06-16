import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helpers inlined per-function (shared api/_lib import didn't bundle on Vercel).

const API = 'https://api.telegram.org';

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  return t;
}

interface InitDataUser {
  id: number;
}

function verifyInitData(initData: string, maxAgeSec = 86400): InitDataUser | null {
  if (!initData) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken()).digest();
  const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  if (computed !== hash) return null;

  const authDate = Number(params.get('auth_date') ?? 0);
  if (maxAgeSec > 0 && Date.now() / 1000 - authDate > maxAgeSec) return null;

  try {
    const user = JSON.parse(params.get('user') ?? 'null');
    if (!user || typeof user.id !== 'number') return null;
    return user as InitDataUser;
  } catch {
    return null;
  }
}

async function tgApi(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; description?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(500).json({ error: 'Сервер не настроен: в Vercel не задан TELEGRAM_BOT_TOKEN' });
  }

  try {
    const initData = (req.headers['x-telegram-init-data'] as string) || '';
    const user = verifyInitData(initData);
    if (!user) return res.status(401).json({ error: 'Не удалось подтвердить личность (initData)' });

    const html = String(((req.body ?? {}) as { html?: string }).html ?? '');
    if (!html.trim()) return res.status(400).json({ error: 'Пустой пост' });

    // Bot API 10.1 Rich Message — content goes inside an InputRichMessage
    // object (the `rich_message` param), with the HTML in its `html` field.
    const r = await tgApi('sendRichMessage', { chat_id: user.id, rich_message: { html } });
    if (!r.ok) return res.status(502).json({ error: r.description || 'Ошибка отправки' });

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Ошибка сервера' });
  }
}
