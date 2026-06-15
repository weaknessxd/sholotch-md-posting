import { useRef } from 'react';
import type { Block } from '@/lib/blocks';
import type { MediaItem, MediaKind } from '@/lib/types';

interface BlockBodyProps {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}

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

const PLACEHOLDER: Partial<Record<Block['type'], string>> = {
  text: 'Писать тут…',
  h1: 'Заголовок H1',
  h2: 'Заголовок H2',
  h3: 'Заголовок H3',
  bullets: 'Пункт списка\nЕщё пункт',
  numbered: 'Первый пункт\nВторой пункт',
  checklist: '[ ] Задача\n[x] Сделано',
  formula: 'x^2 + y_1',
  code: 'const x = 1;',
};

function AutoTextarea({
  value,
  onChange,
  placeholder,
  mono,
  bold,
  size,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
  bold?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        grow(el);
      }}
      value={value}
      placeholder={placeholder}
      onChange={(e) => {
        onChange(e.target.value);
        grow(e.target);
      }}
      rows={1}
      className={`w-full resize-none border-0 bg-transparent p-0 leading-[1.3] text-[#0a0a0a] outline-none placeholder:text-[#d9d9d9] ${
        mono ? 'font-mono' : 'font-sans'
      } ${bold ? 'font-bold' : ''}`}
      style={{ fontSize: size ?? 16 }}
    />
  );
}

export function BlockBody({ block, onChange }: BlockBodyProps) {
  switch (block.type) {
    case 'text':
      return (
        <AutoTextarea
          value={block.value}
          onChange={(v) => onChange({ value: v })}
          placeholder={PLACEHOLDER.text}
          size={16}
        />
      );
    case 'h1':
    case 'h2':
    case 'h3': {
      const sizes = { h1: 26, h2: 22, h3: 19 } as const;
      return (
        <AutoTextarea
          value={block.value}
          onChange={(v) => onChange({ value: v })}
          placeholder={PLACEHOLDER[block.type]}
          bold
          size={sizes[block.type]}
        />
      );
    }
    case 'bullets':
    case 'numbered':
    case 'checklist':
      return (
        <AutoTextarea
          value={block.value}
          onChange={(v) => onChange({ value: v })}
          placeholder={PLACEHOLDER[block.type]}
          size={15}
        />
      );
    case 'accordion':
      return (
        <div className="flex flex-col gap-[6px]">
          <AutoTextarea
            value={block.title}
            onChange={(v) => onChange({ title: v })}
            placeholder="Заголовок аккордеона"
            bold
            size={16}
          />
          <AutoTextarea
            value={block.value}
            onChange={(v) => onChange({ value: v })}
            placeholder="Скрытый текст…"
            size={15}
          />
        </div>
      );
    case 'code':
      return (
        <div className="flex flex-col gap-[6px]">
          <input
            value={block.language}
            onChange={(e) => onChange({ language: e.target.value })}
            placeholder="язык (необязательно)"
            className="w-full border-0 bg-transparent p-0 font-mono text-[12px] text-[#9a9a9a] outline-none placeholder:text-[#d9d9d9]"
          />
          <AutoTextarea
            value={block.value}
            onChange={(v) => onChange({ value: v })}
            placeholder={PLACEHOLDER.code}
            mono
            size={14}
          />
        </div>
      );
    case 'formula':
      return (
        <AutoTextarea
          value={block.value}
          onChange={(v) => onChange({ value: v })}
          placeholder={PLACEHOLDER.formula}
          mono
          size={15}
        />
      );
    case 'table':
      return (
        <AutoTextarea
          value={block.value}
          onChange={(v) => onChange({ value: v })}
          placeholder={'Колонка | Колонка\nЗначение | Значение'}
          mono
          size={13}
        />
      );
    case 'time':
      return (
        <input
          type="datetime-local"
          value={new Date(block.value * 1000).toISOString().slice(0, 16)}
          onChange={(e) => onChange({ value: Math.floor(new Date(e.target.value).getTime() / 1000) })}
          className="border-0 bg-transparent p-0 font-sans text-[15px] text-[#0a0a0a] outline-none"
        />
      );
    case 'divider':
      return <div className="my-[4px] h-px w-full bg-[#e1e1e1]" />;
    case 'image':
    case 'audio':
    case 'video':
      return <SingleMedia block={block} onChange={onChange} />;
    case 'carousel':
    case 'grid':
      return <MultiMedia block={block} onChange={onChange} />;
  }
}

function SingleMedia({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'image' | 'audio' | 'video' }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const accept = block.type === 'image' ? 'image/*' : block.type === 'audio' ? 'audio/*' : 'video/*';
  return (
    <div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const media: MediaItem = { kind: kindFromFile(f), url: await fileToDataUrl(f), fileName: f.name };
          onChange({ media });
        }}
      />
      {block.media && block.type === 'image' ? (
        <img src={block.media.url} className="max-h-[180px] rounded-[12px] object-cover" />
      ) : block.media ? (
        <div className="rounded-[10px] bg-[#f7f7f7] px-[12px] py-[8px] text-[13px] text-[#656565]">
          {block.media.fileName || block.type}
        </div>
      ) : (
        <button
          onClick={() => ref.current?.click()}
          className="rounded-[10px] bg-[#f7f7f7] px-[14px] py-[10px] text-[13px] font-medium text-[#656565] hover:bg-[#dddddd] active:bg-[#bbbbbb]"
        >
          Выбрать файл
        </button>
      )}
    </div>
  );
}

function MultiMedia({
  block,
  onChange,
}: {
  block: Extract<Block, { type: 'carousel' | 'grid' }>;
  onChange: (patch: Partial<Block>) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-[8px]">
      <input
        ref={ref}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = e.target.files;
          if (!files?.length) return;
          const items = await Promise.all(
            Array.from(files).map(async (f) => ({
              kind: kindFromFile(f),
              url: await fileToDataUrl(f),
              fileName: f.name,
            })),
          );
          onChange({ media: [...block.media, ...items].slice(0, 10) });
        }}
      />
      {block.media.length > 0 && (
        <div className="no-scrollbar flex gap-[6px] overflow-x-auto">
          {block.media.map((m, i) => (
            <div key={i} className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-[8px] bg-[#f7f7f7]">
              {m.kind === 'photo' ? (
                <img src={m.url} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-[#656565]">
                  {m.kind}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => ref.current?.click()}
        className="self-start rounded-[10px] bg-[#f7f7f7] px-[14px] py-[10px] text-[13px] font-medium text-[#656565] hover:bg-[#dddddd] active:bg-[#bbbbbb]"
      >
        + Добавить файлы
      </button>
    </div>
  );
}
