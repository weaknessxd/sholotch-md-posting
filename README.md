# sholotch-md-posting

Telegram Mini App для публикации **форматированных (Markdown) постов** в каналы.

- Пишешь пост в редакторе (тулбар + Markdown + живой предпросмотр).
- Добавляешь до **10 каналов** (бот должен быть админом канала). Список хранится в Telegram CloudStorage.
- По кнопке бот присылает **превью в личку** с кнопками **«Подтвердить»** и **«Отменить»**.
- По «Подтвердить» бот публикует пост в выбранный канал (через `copyMessage` — формат и медиа сохраняются 1:1).

## Стек

- Фронт: React 19 + Vite + TypeScript + Tailwind 3 (`@twa-dev/sdk`)
- Бэк: Vercel Functions (`api/`, Node runtime)
- Дизайн: нижний таб-бар и glass-UI портированы из `attmpt_editor`, акцент — красный

## Архитектура

| Слой | Файл |
| --- | --- |
| Парсер Markdown → Telegram entities | [src/lib/markdown.ts](src/lib/markdown.ts) |
| Каналы (CloudStorage, до 10) | [src/lib/channels.ts](src/lib/channels.ts) |
| Telegram WebApp helpers | [src/lib/tg.ts](src/lib/tg.ts) |
| Проверка initData (HMAC) + Bot API | [api/_lib/telegram.ts](api/_lib/telegram.ts) |
| Резолв канала + проверка прав бота | [api/resolve-channel.ts](api/resolve-channel.ts) |
| Отправка превью в личку | [api/preview.ts](api/preview.ts) |
| Webhook: /start + confirm/cancel | [api/telegram.ts](api/telegram.ts) |

Черновики **не** хранятся на сервере: превью-сообщение в личке бота само является постом, и по подтверждению копируется в канал (`copyMessage`/`copyMessages`).

## Локальный запуск

```bash
npm install
npm run dev
```

Бэкенд-функции работают только на Vercel (`vercel dev` или после деплоя).

## Деплой на Vercel

1. Импортируй репозиторий в Vercel (framework: Vite).
2. Env vars (Project → Settings → Environment Variables):
   - `TELEGRAM_BOT_TOKEN` — токен бота от @BotFather
   - `TELEGRAM_WEBHOOK_SECRET` — любая случайная строка
3. После деплоя зарегистрируй webhook:
   ```bash
   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=yyy \
     node scripts/set-webhook.mjs https://<твой-проект>.vercel.app
   ```
4. В @BotFather: задай Mini App URL (`/newapp` или Bot Settings → Menu Button) на `https://<твой-проект>.vercel.app`.

## Поддерживаемый Markdown

`**жирный**` · `_курсив_` · `__подчёркнутый__` · `~~зачёркнутый~~` · `||спойлер||` ·
`` `код` `` · ` ```блок кода``` ` · `[текст](https://ссылка)` · `> цитата` · `**> раскрывающаяся цитата`
