// Registers the Telegram webhook for this bot.
// Usage:
//   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=yyy \
//   node scripts/set-webhook.mjs https://your-app.vercel.app

const token = process.env.TELEGRAM_BOT_TOKEN;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const baseUrl = process.argv[2];

if (!token || !baseUrl) {
  console.error('Usage: TELEGRAM_BOT_TOKEN=... [TELEGRAM_WEBHOOK_SECRET=...] node scripts/set-webhook.mjs <https-base-url>');
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, '')}/api/telegram`;
const body = {
  url,
  allowed_updates: ['message', 'callback_query'],
  ...(secret ? { secret_token: secret } : {}),
};

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
console.log(await res.json());
