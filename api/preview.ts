import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dataUrlToBlob, tgApi, tgApiForm, verifyInitData } from './_lib/telegram';

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

    const chatId = user.id; // preview goes to the user's private chat with the bot
    const text = draft.text ?? '';
    const entities = JSON.stringify(draft.entities ?? []);
    const media = draft.media ?? [];

    // ── No media: a single text message carries the confirm keyboard ──
    if (media.length === 0) {
      if (!text.trim()) return res.status(400).json({ error: 'Пустой пост' });
      const sent = await tgApi<SentMessage>('sendMessage', {
        chat_id: chatId,
        text,
        entities: draft.entities ?? [],
      });
      if (!sent.ok || !sent.result)
        return res.status(502).json({ error: sent.description || 'Ошибка отправки' });
      const cb = `p:${channel.id}:${sent.result.message_id}`;
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(cb),
      });
      return res.status(200).json({ ok: true });
    }

    // ── Single media: the media message carries the confirm keyboard ──
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
      const cb = `p:${channel.id}:${sent.result.message_id}`;
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(cb),
      });
      return res.status(200).json({ ok: true });
    }

    // ── Album: send media group, then a separate confirm message ──
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
    const cb = `pg:${channel.id}:${firstId}:${count}`;
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `Опубликовать пост в «${channel.title}»?`,
      reply_markup: confirmKeyboard(cb),
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Ошибка сервера' });
  }
}
