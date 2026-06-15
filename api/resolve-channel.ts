import crypto from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// NOTE: helpers are inlined per-function on purpose. A shared api/_lib import
// failed to bundle on Vercel (every importing function crashed with
// FUNCTION_INVOCATION_FAILED), so each endpoint is self-contained.

const API = 'https://api.telegram.org';

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  return t;
}

interface InitDataUser {
  id: number;
  first_name?: string;
  username?: string;
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

async function tgApi<T = unknown>(
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

let cachedBotId: number | null = null;
async function getBotId(): Promise<number | null> {
  if (cachedBotId) return cachedBotId;
  const me = await tgApi<{ id: number }>('getMe', {});
  if (me.ok && me.result) {
    cachedBotId = me.result.id;
    return cachedBotId;
  }
  return null;
}

interface ChatResult {
  id: number;
  title?: string;
  username?: string;
  type: string;
}
interface ChatMember {
  status: string;
  can_post_messages?: boolean;
}

function normalizeQuery(raw: string): string {
  let q = raw.trim();
  q = q.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^s\//, '');
  q = q.replace(/^@/, '').replace(/\/$/, '');
  if (/^-?\d+$/.test(q)) return q;
  return `@${q}`;
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

    const query = String((req.body?.query ?? '') as string);
    if (!query.trim()) return res.status(400).json({ error: 'Укажи @username или ссылку на канал' });

    const chatId = normalizeQuery(query);

    const chat = await tgApi<ChatResult>('getChat', { chat_id: chatId });
    if (!chat.ok || !chat.result) {
      return res.status(404).json({
        error: chat.description || 'Канал не найден. Проверь @username и что бот добавлен в канал.',
      });
    }
    if (chat.result.type !== 'channel' && chat.result.type !== 'supergroup') {
      return res.status(400).json({ error: 'Это не канал. Укажи публичный канал.' });
    }

    const botId = await getBotId();
    const member = await tgApi<ChatMember>('getChatMember', {
      chat_id: chat.result.id,
      user_id: botId,
    });
    if (!member.ok || !member.result) {
      return res.status(403).json({ error: 'Бот не админ этого канала. Добавь бота админом и повтори.' });
    }
    const { status, can_post_messages } = member.result;
    if (status !== 'administrator' && status !== 'creator') {
      return res.status(403).json({ error: 'Бот не админ этого канала. Добавь бота админом и повтори.' });
    }
    if (status === 'administrator' && can_post_messages === false) {
      return res.status(403).json({
        error: 'У бота нет права публиковать сообщения. Включи «Post Messages» в правах админа.',
      });
    }

    return res.status(200).json({
      id: String(chat.result.id),
      username: chat.result.username,
      title: chat.result.title ?? chat.result.username ?? 'Канал',
      type: chat.result.type,
    });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Ошибка сервера' });
  }
}
