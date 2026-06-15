import { dataUrlToBlob, tgApi, tgApiForm, verifyInitData } from './_lib/telegram.js';

export const config = { runtime: 'nodejs' };

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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const user = verifyInitData(req.headers.get('x-telegram-init-data') ?? '');
  if (!user) return json({ error: 'Не удалось подтвердить личность (initData)' }, 401);

  let channel: Channel;
  let draft: Draft;
  try {
    ({ channel, draft } = (await req.json()) as { channel: Channel; draft: Draft });
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (!channel?.id) return json({ error: 'Канал не выбран' }, 400);

  const chatId = user.id; // preview goes to the user's private chat with the bot
  const text = draft.text ?? '';
  const entities = JSON.stringify(draft.entities ?? []);
  const media = draft.media ?? [];

  try {
    // ── No media: a single text message carries the confirm keyboard ──
    if (media.length === 0) {
      if (!text.trim()) return json({ error: 'Пустой пост' }, 400);
      const sent = await tgApi<SentMessage>('sendMessage', {
        chat_id: chatId,
        text,
        entities: draft.entities ?? [],
      });
      if (!sent.ok || !sent.result) return json({ error: sent.description || 'Ошибка отправки' }, 502);
      const cb = `p:${channel.id}:${sent.result.message_id}`;
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(cb),
      });
      return json({ ok: true });
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
      if (!sent.ok || !sent.result) return json({ error: sent.description || 'Ошибка отправки' }, 502);
      const cb = `p:${channel.id}:${sent.result.message_id}`;
      await tgApi('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: sent.result.message_id,
        reply_markup: confirmKeyboard(cb),
      });
      return json({ ok: true });
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
      return json({ error: group.description || 'Ошибка отправки альбома' }, 502);

    const firstId = group.result[0].message_id;
    const count = group.result.length;
    const cb = `pg:${channel.id}:${firstId}:${count}`;
    await tgApi('sendMessage', {
      chat_id: chatId,
      text: `Опубликовать пост в «${channel.title}»?`,
      reply_markup: confirmKeyboard(cb),
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Ошибка сервера' }, 500);
  }
}
