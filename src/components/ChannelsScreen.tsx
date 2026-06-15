import { useState } from 'react';
import clsx from 'clsx';
import { resolveChannel } from '@/lib/api';
import { addChannel, removeChannel } from '@/lib/channels';
import { hapticNotification, showConfirm } from '@/lib/tg';
import { MAX_CHANNELS, type Channel } from '@/lib/types';
import { PlusIcon, TrashIcon } from './icons';

interface ChannelsScreenProps {
  channels: Channel[];
  onChange: (channels: Channel[]) => void;
}

export function ChannelsScreen({ channels, onChange }: ChannelsScreenProps) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const atLimit = channels.length >= MAX_CHANNELS;

  const handleAdd = async () => {
    const q = query.trim();
    if (!q || busy) return;
    setBusy(true);
    setError(null);
    try {
      const channel = await resolveChannel(q);
      const next = await addChannel(channel);
      onChange(next);
      setQuery('');
      hapticNotification('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось добавить канал');
      hapticNotification('error');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (channel: Channel) => {
    const ok = await showConfirm(`Удалить «${channel.title}» из списка?`);
    if (!ok) return;
    const next = await removeChannel(channel.id);
    onChange(next);
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[20px] px-[16px] pt-safe">
      <div className="pt-[16px]">
        <h1 className="text-[24px] font-bold tracking-tight">Каналы</h1>
        <p className="mt-[4px] text-[14px] text-tg-hint">
          Добавь до {MAX_CHANNELS} каналов. Бот должен быть админом канала.
        </p>
      </div>

      {/* Add form */}
      <div className="flex flex-col gap-[10px]">
        <div className="flex gap-[8px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="@channel или https://t.me/channel"
            disabled={atLimit || busy}
            className="h-[48px] flex-1 rounded-[14px] bg-tg-secondary-bg px-[16px] text-[15px] text-tg-text outline-none placeholder:text-tg-hint disabled:opacity-50"
          />
          <button
            onClick={handleAdd}
            disabled={atLimit || busy || !query.trim()}
            className="flex h-[48px] w-[48px] items-center justify-center rounded-[14px] bg-accent text-white disabled:opacity-40"
          >
            <PlusIcon className="h-[22px] w-[22px]" />
          </button>
        </div>
        {error && <p className="text-[13px] text-accent">{error}</p>}
        {atLimit && (
          <p className="text-[13px] text-tg-hint">Достигнут лимит в {MAX_CHANNELS} каналов.</p>
        )}
      </div>

      {/* List */}
      <div className="flex flex-col gap-[8px] pb-[120px]">
        {channels.length === 0 && (
          <div className="rounded-[16px] border border-dashed border-tg-hint/30 px-[16px] py-[28px] text-center text-[14px] text-tg-hint">
            Пока нет каналов. Добавь первый выше.
          </div>
        )}
        {channels.map((c) => (
          <div
            key={c.id}
            className="flex items-center gap-[12px] rounded-[16px] bg-tg-secondary-bg px-[14px] py-[12px]"
          >
            <div
              className={clsx(
                'flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-[16px] font-bold text-accent',
              )}
            >
              {c.title.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-medium">{c.title}</div>
              {c.username && <div className="truncate text-[13px] text-tg-hint">@{c.username}</div>}
            </div>
            <button
              onClick={() => handleRemove(c)}
              className="flex h-[36px] w-[36px] items-center justify-center rounded-full text-tg-hint hover:text-accent"
            >
              <TrashIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
