import type { Block, MediaRef } from '@/lib/blocks';

interface BlockBodyProps {
  block: Block;
  onChange: (patch: Partial<Block>) => void;
}

const PLACEHOLDER: Partial<Record<Block['type'], string>> = {
  text: 'Писать тут…',
  h1: 'Заголовок H1',
  h2: 'Заголовок H2',
  h3: 'Заголовок H3',
  bullets: 'Пункт списка\nЕщё пункт',
  numbered: 'Первый пункт\nВторой пункт',
  checklist: '[ ] Задача\n[x] Сделано',
  formula: 'E = mc^2',
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
  const grow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  return (
    <textarea
      ref={grow}
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

function UrlInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      inputMode="url"
      className="w-full border-0 bg-transparent p-0 font-sans text-[14px] text-[#0a0a0a] outline-none placeholder:text-[#d9d9d9]"
    />
  );
}

export function BlockBody({ block, onChange }: BlockBodyProps) {
  switch (block.type) {
    case 'text':
      return (
        <AutoTextarea value={block.value} onChange={(v) => onChange({ value: v })} placeholder={PLACEHOLDER.text} size={16} />
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
        <AutoTextarea value={block.value} onChange={(v) => onChange({ value: v })} placeholder={PLACEHOLDER[block.type]} size={15} />
      );
    case 'accordion':
      return (
        <div className="flex flex-col gap-[6px]">
          <AutoTextarea value={block.title} onChange={(v) => onChange({ title: v })} placeholder="Заголовок аккордеона" bold size={16} />
          <AutoTextarea value={block.value} onChange={(v) => onChange({ value: v })} placeholder="Скрытый текст…" size={15} />
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
          <AutoTextarea value={block.value} onChange={(v) => onChange({ value: v })} placeholder={PLACEHOLDER.code} mono size={14} />
        </div>
      );
    case 'formula':
      return (
        <AutoTextarea value={block.value} onChange={(v) => onChange({ value: v })} placeholder={PLACEHOLDER.formula} mono size={15} />
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
      return (
        <div className="flex flex-col gap-[6px]">
          <UrlInput
            value={block.url}
            onChange={(v) => onChange({ url: v })}
            placeholder={`URL ${block.type === 'image' ? 'изображения' : block.type === 'audio' ? 'аудио' : 'видео'} (https://…)`}
          />
          <UrlInput value={block.caption} onChange={(v) => onChange({ caption: v })} placeholder="Подпись (необязательно)" />
        </div>
      );
    case 'carousel':
    case 'grid':
      return <MultiMedia items={block.items} onChange={(items) => onChange({ items })} />;
  }
}

function MultiMedia({ items, onChange }: { items: MediaRef[]; onChange: (items: MediaRef[]) => void }) {
  const set = (i: number, url: string) => onChange(items.map((m, idx) => (idx === i ? { url } : m)));
  return (
    <div className="flex flex-col gap-[6px]">
      {items.map((m, i) => (
        <div key={i} className="flex items-center gap-[6px]">
          <UrlInput value={m.url} onChange={(v) => set(i, v)} placeholder={`Медиа ${i + 1} URL (https://…)`} />
          <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="shrink-0 text-[#bbb] hover:text-[#e90303]">
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, { url: '' }])}
        className="self-start rounded-[10px] bg-[#f7f7f7] px-[12px] py-[8px] text-[12px] font-medium text-[#656565] hover:bg-[#dddddd] active:bg-[#bbbbbb]"
      >
        + Добавить медиа по URL
      </button>
    </div>
  );
}
