import crypto from 'node:crypto';

const API = 'https://api.telegram.org';

export function botToken(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN not configured');
  return t;
}

export interface InitDataUser {
  id: number;
  first_name?: string;
  username?: string;
}

/**
 * Validate Telegram WebApp initData via HMAC, per the official algorithm:
 *   secret_key = HMAC_SHA256(key="WebAppData", msg=bot_token)
 *   hash       = HMAC_SHA256(key=secret_key,  msg=data_check_string)
 * Returns the authenticated user, or null if invalid/expired.
 */
export function verifyInitData(initData: string, maxAgeSec = 86400): InitDataUser | null {
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

/** Call a Bot API method with a JSON body. */
export async function tgApi<T = unknown>(
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

/** Call a Bot API method with multipart form-data (for file uploads). */
export async function tgApiForm<T = unknown>(
  method: string,
  form: FormData,
): Promise<{ ok: boolean; result?: T; description?: string }> {
  const res = await fetch(`${API}/bot${botToken()}/${method}`, { method: 'POST', body: form });
  return (await res.json()) as { ok: boolean; result?: T; description?: string };
}

let cachedBotId: number | null = null;

export async function getBotId(): Promise<number | null> {
  if (cachedBotId) return cachedBotId;
  const me = await tgApi<{ id: number }>('getMe', {});
  if (me.ok && me.result) {
    cachedBotId = me.result.id;
    return cachedBotId;
  }
  return null;
}

/** Convert a data: URL into a Blob suitable for FormData uploads. */
export function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string } {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!match) throw new Error('Unsupported media URL');
  const mime = match[1];
  const buf = Buffer.from(match[2], 'base64');
  return { blob: new Blob([buf], { type: mime }), mime };
}
