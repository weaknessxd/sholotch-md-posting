import { getBotId, tgApi, verifyInitData } from './_lib/telegram';

export const config = { runtime: 'nodejs' };

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Normalize @username / t.me link / numeric id into a getChat-ready value. */
function normalizeQuery(raw: string): string {
  let q = raw.trim();
  q = q.replace(/^https?:\/\//, '').replace(/^t\.me\//, '').replace(/^s\//, '');
  q = q.replace(/^@/, '').replace(/\/$/, '');
  if (/^-?\d+$/.test(q)) return q; // numeric chat id
  return `@${q}`;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Surface misconfiguration as a readable error instead of an opaque 500.
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return json({ error: 'Сервер не настроен: в Vercel не задан TELEGRAM_BOT_TOKEN' }, 500);
  }

  try {
    const user = verifyInitData(req.headers.get('x-telegram-init-data') ?? '');
    if (!user) return json({ error: 'Не удалось подтвердить личность (initData)' }, 401);

    let query = '';
    try {
      ({ query } = (await req.json()) as { query: string });
    } catch {
      return json({ error: 'bad request' }, 400);
    }
    if (!query?.trim()) return json({ error: 'Укажи @username или ссылку на канал' }, 400);

    const chatId = normalizeQuery(query);

    const chat = await tgApi<ChatResult>('getChat', { chat_id: chatId });
    if (!chat.ok || !chat.result) {
      return json(
        { error: chat.description || 'Канал не найден. Проверь @username и что бот добавлен в канал.' },
        404,
      );
    }
    if (chat.result.type !== 'channel' && chat.result.type !== 'supergroup') {
      return json({ error: 'Это не канал. Укажи публичный канал.' }, 400);
    }

    // Single getChatMember call (lighter than scanning getChatAdministrators).
    const botId = await getBotId();
    const member = await tgApi<ChatMember>('getChatMember', {
      chat_id: chat.result.id,
      user_id: botId,
    });
    if (!member.ok || !member.result) {
      return json({ error: 'Бот не админ этого канала. Добавь бота админом и повтори.' }, 403);
    }
    const { status, can_post_messages } = member.result;
    if (status !== 'administrator' && status !== 'creator') {
      return json({ error: 'Бот не админ этого канала. Добавь бота админом и повтори.' }, 403);
    }
    // Creator can always post; an administrator needs the "Post Messages" right.
    if (status === 'administrator' && can_post_messages === false) {
      return json(
        { error: 'У бота нет права публиковать сообщения. Включи «Post Messages» в правах админа.' },
        403,
      );
    }

    return json({
      id: String(chat.result.id),
      username: chat.result.username,
      title: chat.result.title ?? chat.result.username ?? 'Канал',
      type: chat.result.type,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, 500);
  }
}
