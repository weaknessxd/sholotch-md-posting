import { useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { sendPreview } from '@/lib/api';
import { markdownToHtml, parseMarkdown, MAX_TEXT_LENGTH, MAX_CAPTION_LENGTH } from '@/lib/markdown';
import { hapticNotification, showAlert } from '@/lib/tg';
import type { Channel, MediaItem, MediaKind } from '@/lib/types';
import { SendIcon } from './icons';
import { Toolbar, applyFormat, type FormatAction } from './Toolbar';

interface EditorScreenProps {
  channels: Channel[];
}

const ACCEPT: Record<MediaKind, string> = {
  photo: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  document: '*/*',
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function kindFromFile(file: File): MediaKind {
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'document';
}

export function EditorScreen({ channels }: EditorScreenProps) {
  const [source, setSource] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [channelId, setChannelId] = useState<string>(() => channels[0]?.id ?? '');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => parseMarkdown(source), [source]);
  const previewHtml = useMemo(() => markdownToHtml(source), [source]);

  const channel = channels.find((c) => c.id === channelId) ?? channels[0];
  const hasMedia = media.length > 0;
  const limit = hasMedia ? MAX_CAPTION_LENGTH : MAX_TEXT_LENGTH;
  const overLimit = parsed.text.length > limit;
  const empty = parsed.text.trim().length === 0 && !hasMedia;

  const handleAction = (action: FormatAction) => {
    const el = textareaRef.current;
    if (!el) return;
    const { value, start, end } = applyFormat(source, el.selectionStart, el.selectionEnd, action);
    setSource(value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const items = await Promise.all(
      Array.from(files).map(async (f) => ({
        kind: kindFromFile(f),
        url: await fileToDataUrl(f),
        fileName: f.name,
      })),
    );
    setMedia((prev) => [...prev, ...items].slice(0, 10));
  };

  const handleSend = async () => {
    if (!channel) {
      showAlert('Сначала добавь канал на вкладке «Каналы».');
      return;
    }
    if (empty) return;
    if (overLimit) {
      showAlert(`Текст превышает лимит ${limit} символов.`);
      return;
    }
    setSending(true);
    try {
      await sendPreview(channel, {
        source,
        text: parsed.text,
        entities: parsed.entities,
        media,
      });
      hapticNotification('success');
      showAlert('Превью отправлено в бота. Подтверди отправку в чате с ботом.');
    } catch (e) {
      hapticNotification('error');
      showAlert(e instanceof Error ? e.message : 'Не удалось отправить превью');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-[16px] px-[16px] pt-safe">
      <div className="pt-[16px]">
        <h1 className="text-[24px] font-bold tracking-tight">Новый пост</h1>
      </div>

      {/* Channel selector */}
      <div className="flex items-center gap-[10px]">
        <span className="text-[14px] text-tg-hint">Канал:</span>
        {channels.length === 0 ? (
          <span className="text-[14px] text-accent">добавь канал во вкладке «Каналы»</span>
        ) : (
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            className="h-[40px] flex-1 rounded-[12px] bg-tg-secondary-bg px-[12px] text-[15px] text-tg-text outline-none"
          >
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
                {c.username ? ` (@${c.username})` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      <Toolbar onAction={handleAction} />

      <textarea
        ref={textareaRef}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Пиши пост в Markdown… **жирный**, _курсив_, ||спойлер||, > цитата"
        rows={8}
        className="w-full resize-y rounded-[14px] bg-tg-secondary-bg p-[14px] font-mono text-[14px] leading-relaxed text-tg-text outline-none placeholder:text-tg-hint"
      />

      {/* Media */}
      <div className="flex flex-col gap-[8px]">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-tg-hint">Вложения</span>
          <button
            onClick={() => fileRef.current?.click()}
            className="rounded-[10px] bg-accent/15 px-[12px] py-[6px] text-[13px] font-medium text-accent"
          >
            + Добавить
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={Object.values(ACCEPT).join(',')}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {hasMedia && (
          <div className="no-scrollbar flex gap-[8px] overflow-x-auto">
            {media.map((m, idx) => (
              <div key={idx} className="relative h-[72px] w-[72px] shrink-0">
                {m.kind === 'photo' ? (
                  <img src={m.url} className="h-full w-full rounded-[10px] object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-tg-secondary-bg text-[11px] text-tg-hint">
                    {m.kind}
                  </div>
                )}
                <button
                  onClick={() => setMedia((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -right-[6px] -top-[6px] flex h-[20px] w-[20px] items-center justify-center rounded-full bg-accent text-[12px] text-white"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-[6px]">
        <span className="text-[14px] text-tg-hint">Предпросмотр</span>
        <div className="rounded-[14px] bg-tg-secondary-bg p-[14px]">
          {source.trim() ? (
            <div
              className="tg-preview whitespace-pre-wrap break-words text-[15px] leading-relaxed"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : (
            <span className="text-[14px] text-tg-hint">Здесь появится отформатированный пост…</span>
          )}
        </div>
        <div className={clsx('text-right text-[12px]', overLimit ? 'text-accent' : 'text-tg-hint')}>
          {parsed.text.length} / {limit}
        </div>
      </div>

      {/* Send */}
      <div className="pb-[120px]">
        <button
          onClick={handleSend}
          disabled={empty || overLimit || sending || channels.length === 0}
          className="flex h-[52px] w-full items-center justify-center gap-[8px] rounded-[16px] bg-accent text-[16px] font-semibold text-white disabled:opacity-40"
        >
          <SendIcon className="h-[20px] w-[20px]" />
          {sending ? 'Отправка…' : 'Отправить превью в бота'}
        </button>
        <p className="mt-[8px] text-center text-[12px] text-tg-hint">
          Бот пришлёт превью с кнопками «Подтвердить» и «Отменить».
        </p>
      </div>
    </div>
  );
}
