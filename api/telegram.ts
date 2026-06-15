import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helpers inlined per-function (shared api/_lib import didn't bundle on Vercel).

const API = 'https://api.telegram.org';

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  return t;
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

const START_REPLY =
  'Привет! Это бот для постинга форматированных постов в каналы.\n\n' +
  '1. Открой mini app и добавь свои каналы (бот должен быть админом канала).\n' +
  '2. Напиши пост в редакторе и нажми «Отправить превью».\n' +
  '3. Я пришлю превью с кнопками «Подтвердить» и «Отменить».';

interface CallbackQuery {
  id: string;
  from: { id: number };
  message?: { message_id: number; chat: { id: number } };
  data?: string;
}
interface Update {
  message?: { chat: { id: number }; text?: string };
  callback_query?: CallbackQuery;
}

async function finish(cb: CallbackQuery, toast: string, replacement?: string): Promise<void> {
  await tgApi('answerCallbackQuery', { callback_query_id: cb.id, text: toast });
  if (!cb.message) return;
  await tgApi('editMessageReplyMarkup', {
    chat_id: cb.message.chat.id,
    message_id: cb.message.message_id,
    reply_markup: { inline_keyboard: [] },
  });
  if (replacement) {
    await tgApi('editMessageText', {
      chat_id: cb.message.chat.id,
      message_id: cb.message.message_id,
      text: replacement,
    }).catch(() => undefined);
  }
}

async function handleCallback(cb: CallbackQuery): Promise<void> {
  const data = cb.data ?? '';
  const fromChat = cb.message?.chat.id;
  if (!fromChat) return;

  if (data === 'x') {
    await finish(cb, 'Отменено', '✖️ Пост отменён');
    return;
  }

  if (data.startsWith('p:')) {
    const [, channelId, msgId] = data.split(':');
    const result = await tgApi('copyMessage', {
      chat_id: channelId,
      from_chat_id: fromChat,
      message_id: Number(msgId),
    });
    await finish(
      cb,
      result.ok ? 'Опубликовано ✅' : 'Не удалось опубликовать',
      result.ok ? '✅ Опубликовано в канал' : `Ошибка: ${result.description ?? 'не удалось'}`,
    );
    return;
  }

  if (data.startsWith('pg:')) {
    const [, channelId, firstId, count] = data.split(':');
    const ids = Array.from({ length: Number(count) }, (_, i) => Number(firstId) + i);
    const result = await tgApi('copyMessages', {
      chat_id: channelId,
      from_chat_id: fromChat,
      message_ids: ids,
    });
    await finish(
      cb,
      result.ok ? 'Опубликовано ✅' : 'Не удалось опубликовать',
      result.ok ? '✅ Альбом опубликован в канал' : `Ошибка: ${result.description ?? 'не удалось'}`,
    );
    return;
  }

  await tgApi('answerCallbackQuery', { callback_query_id: cb.id });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('ok');

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(403).send('forbidden');
  }

  const update = (req.body ?? {}) as Update;

  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message?.text && /^\/start(?:@\w+)?(?:\s|$)/.test(update.message.text)) {
      await tgApi('sendMessage', { chat_id: update.message.chat.id, text: START_REPLY });
    }
  } catch {
    // swallow — always 200 so Telegram doesn't retry-storm
  }

  return res.status(200).send('ok');
}
