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

async function tgApiForm(
  method: string,
  form: FormData,
): Promise<{ ok: boolean; description?: string }> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, { method: 'POST', body: form });
  return (await res.json()) as { ok: boolean; description?: string };
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported media URL');
  return new Blob([Buffer.from(match[2], 'base64')], { type: match[1] });
}

type MediaKind = 'photo' | 'video' | 'audio' | 'document';
interface MediaItem {
  kind: MediaKind;
  url: string;
  fileName?: string;
}
type OutgoingMessage =
  | { kind: 'text'; text: string; entities: unknown[] }
  | { kind: 'media'; media: MediaItem }
  | { kind: 'album'; media: MediaItem[] };

const METHOD: Record<MediaKind, string> = {
  photo: 'sendPhoto',
  video: 'sendVideo',
  audio: 'sendAudio',
  document: 'sendDocument',
};

async function sendOne(chatId: number, msg: OutgoingMessage): Promise<{ ok: boolean; description?: string }> {
  if (msg.kind === 'text') {
    return tgApi('sendMessage', { chat_id: chatId, text: msg.text, entities: msg.entities });
  }
  if (msg.kind === 'media') {
    const form = new FormData();
    form.set('chat_id', String(chatId));
    form.set(msg.media.kind, dataUrlToBlob(msg.media.url), msg.media.fileName || msg.media.kind);
    return tgApiForm(METHOD[msg.media.kind], form);
  }
  // album
  const form = new FormData();
  form.set('chat_id', String(chatId));
  const items = msg.media.slice(0, 10).map((m, i) => {
    form.set(`file${i}`, dataUrlToBlob(m.url), m.fileName || `file${i}`);
    return { type: m.kind === 'document' ? 'document' : m.kind, media: `attach://file${i}` };
  });
  form.set('media', JSON.stringify(items));
  return tgApiForm('sendMediaGroup', form);
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

    const body = (req.body ?? {}) as { messages?: OutgoingMessage[] };
    const messages = body.messages ?? [];
    if (!messages.length) return res.status(400).json({ error: 'Пустой пост' });

    for (const msg of messages) {
      const r = await sendOne(user.id, msg);
      if (!r.ok) return res.status(502).json({ error: r.description || 'Ошибка отправки' });
    }

    return res.status(200).json({ ok: true, sent: messages.length });
  } catch (e) {
    return res.status(500).json({ error: e instanceof Error ? e.message : 'Ошибка сервера' });
  }
}
