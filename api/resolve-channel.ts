import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getBotId, tgApi, verifyInitData } from './_lib/telegram';

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

/** Normalize @username / t.me link / numeric id into a getChat-ready value. */
function normalizeQuery(raw: string): string {
  let q = raw.trim();
  q = q.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^s\//, '');
  q = q.replace(/^@/, '').replace(/\/$/, '');
  if (/^-?\d+$/.test(q)) return q; // numeric chat id
  return `@${q}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  // Surface misconfiguration as a readable error instead of an opaque 500.
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

    // Single getChatMember call (lighter than scanning getChatAdministrators).
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
    // Creator can always post; an administrator needs the "Post Messages" right.
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
