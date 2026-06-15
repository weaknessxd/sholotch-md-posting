import type { VercelRequest, VercelResponse } from '@vercel/node';

const API = 'https://api.telegram.org';

function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  return t;
}

async function tgApi(method: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`${API}/bot${botToken()}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const START_REPLY =
  'Привет! Это бот для создания форматированных постов.\n\n' +
  '1. Открой мини-апп и собери пост из блоков.\n' +
  '2. Нажми «Отправить в бота» — я пришлю готовый пост сюда.\n' +
  '3. Перешли его в любой канал или чат.';

interface Update {
  message?: { chat: { id: number }; text?: string };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(200).send('ok');

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    return res.status(403).send('forbidden');
  }

  const update = (req.body ?? {}) as Update;
  try {
    if (update.message?.text && /^\/start(?:@\w+)?(?:\s|$)/.test(update.message.text)) {
      await tgApi('sendMessage', { chat_id: update.message.chat.id, text: START_REPLY });
    }
  } catch {
    // always 200 so Telegram doesn't retry-storm
  }
  return res.status(200).send('ok');
}
