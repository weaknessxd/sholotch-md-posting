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

async function tgApiForm<T = unknown>(
  method: string,
  form: FormData,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, { method: 'POST', body: form });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

function dataUrlToBlob(dataUrl: string): { blob: Blob } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported media URL');
  const buf = Buffer.from(match[2], 'base64');
  return { blob: new Blob([buf], { type: match[1] }) };
}

type MediaKind = 'photo' | 'video' | 'audio' | 'document';
interface MediaItem {
  kind: MediaKind;
  url: string;
  fileName?: string;
}
interface Draft {
  text: string;
  entities: unknown[];
  media: MediaItem[];
}
interface Channel {
  id: string;
  title: string;
  username?: string;
}

const METHOD: Record<MediaKind, string> = {
  photo: 'sendPhoto',
  video: 'sendVideo',
  audio: 'sendAudio',
  document: 'sendDocument',
};

function confirmKeyboard(callbackData: string) {
  return {
    inline_keyboard: [
      [
        { text: '✅ Подтвердить', callback_data: callbackData },
        { text: '✖️ Отменить', callback_data: 'x' },
      ],
    ],
  };
}

interface SentMessage {
  message_id: number;
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

    const body = (req.body ?? {}) as { channel?: Channel; draft?: Draft };
    const channel = body.channel;
    const draft = body.draft;
    if (!channel?.id) return res.status(400).json({ error: 'Канал не выбран' });
    if (!draft) return res.status(400).json({ error: 'Пустой пост' });

    const chatId = user.id;
    const text = draft.text ?? '';
    const entities = JSON.stringify(draft.entities ?? []);
    const media = draft.media ?? [];

    // No media: a single text message carries the confirm keyboard.
    if (media.length === 0) {
      if (!text.trim()) return res.status(400).json({ error: 'Пустой пост' });
      const sent = await tgApi<SentMessage>('sendMessage', {
        chat_id: chatId,
        text,
        entities: draft.entities ?? [],
      });
      if (!sent.ok || !sent.result)
        return res.status(502).json({ error: sent.description || 'Ошибка отправки' });
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(`p:${channel.id}:${sent.result.message_id}`),
      });
      return res.status(200).json({ ok: true });
    }

    // Single media: the media message carries the confirm keyboard.
    if (media.length === 1) {
      const m = media[0];
      const { blob } = dataUrlToBlob(m.url);
      const form = new FormData();
      form.set('chat_id', String(chatId));
      form.set('caption', text);
      form.set('caption_entities', entities);
      form.set(m.kind, blob, m.fileName || m.kind);
      const sent = await tgApiForm<SentMessage>(METHOD[m.kind], form);
      if (!sent.ok || !sent.result)
        return res.status(502).json({ error: sent.description || 'Ошибка отправки' });
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(`p:${channel.id}:${sent.result.message_id}`),
      });
      return res.status(200).json({ ok: true });
    }

    // Album: send media group, then a separate confirm message.
    const form = new FormData();
    form.set('chat_id', String(chatId));
    const groupItems = media.slice(0, 10).map((m, i) => {
      const { blob } = dataUrlToBlob(m.url);
      form.set(`file${i}`, blob, m.fileName || `file${i}`);
      const item: Record<string, unknown> = {
        type: m.kind === 'document' ? 'document' : m.kind,
        media: `attach://file${i}`,
      };
      if (i === 0) {
        item.caption = text;
        item.caption_entities = draft.entities ?? [];
      }
      return item;
    });
    form.set('media', JSON.stringify(groupItems));
    const group = await tgApiForm<SentMessage[]>('sendMediaGroup', form);
    if (!group.ok || !group.result?.length)
      return res.status(502).json({ error: group.description || 'Ошибка отправки альбома' });

    const firstId = group.result[0].message_id;
    const count = group.result.length;
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `Опубликовать пост в «${channel.title}»?`,
      reply_markup: confirmKeyboard(`pg:${channel.id}:${firstId}:${count}`),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Ошибка сервера' });
  }
}
