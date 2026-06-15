import { hapticSelection } from '@/lib/tg';

export interface FormatAction {
  label: string;
  title: string;
  /** Marker wrapped around selection, e.g. '**'. */
  wrap?: string;
  /** Prefix inserted at line start, e.g. '> '. */
  linePrefix?: string;
  /** Custom inserter for links/code blocks. */
  custom?: 'link' | 'code';
}

const ACTIONS: FormatAction[] = [
  { label: 'B', title: 'Жирный', wrap: '**' },
  { label: 'I', title: 'Курсив', wrap: '_' },
  { label: 'U', title: 'Подчёркнутый', wrap: '__' },
  { label: 'S', title: 'Зачёркнутый', wrap: '~~' },
  { label: '▟', title: 'Спойлер', wrap: '||' },
  { label: '‹›', title: 'Моноширинный', wrap: '`' },
  { label: '{}', title: 'Блок кода', custom: 'code' },
  { label: '🔗', title: 'Ссылка', custom: 'link' },
  { label: '❝', title: 'Цитата', linePrefix: '> ' },
  { label: '⌄', title: 'Раскрывающаяся цитата', linePrefix: '**> ' },
];

interface ToolbarProps {
  onAction: (action: FormatAction) => void;
}

export function Toolbar({ onAction }: ToolbarProps) {
  return (
    <div className="no-scrollbar flex gap-[6px] overflow-x-auto pb-[2px]">
      {ACTIONS.map((a) => (
        <button
          key={a.title}
          title={a.title}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            hapticSelection();
            onAction(a);
          }}
          className="flex h-[38px] min-w-[40px] shrink-0 items-center justify-center rounded-[10px] bg-tg-secondary-bg px-[10px] text-[15px] font-semibold text-tg-text hover:bg-accent/15 hover:text-accent"
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Apply a format action to a textarea's current selection, returning the new
 * value and the caret/selection range to restore.
 */
export function applyFormat(
  value: string,
  selStart: number,
  selEnd: number,
  action: FormatAction,
): { value: string; start: number; end: number } {
  const selected = value.slice(selStart, selEnd);

  if (action.custom === 'link') {
    const text = selected || 'текст';
    const inserted = `[${text}](https://)`;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    // place caret inside the url parens
    const urlPos = selStart + text.length + 4;
    return { value: next, start: urlPos, end: urlPos + 8 };
  }

  if (action.custom === 'code') {
    const body = selected || 'code';
    const inserted = `\`\`\`\n${body}\n\`\`\``;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    const pos = selStart + 4;
    return { value: next, start: pos, end: pos + body.length };
  }

  if (action.linePrefix) {
    // Prefix every line touched by the selection.
    const lineStart = value.lastIndexOf('\n', selStart - 1) + 1;
    const before = value.slice(0, lineStart);
    const block = value.slice(lineStart, selEnd);
    const after = value.slice(selEnd);
    const prefixed = block
      .split('\n')
      .map((l) => action.linePrefix + l)
      .join('\n');
    const next = before + prefixed + after;
    return { value: next, start: lineStart, end: lineStart + prefixed.length };
  }

  if (action.wrap) {
    const w = action.wrap;
    const inserted = `${w}${selected || ''}${w}`;
    const next = value.slice(0, selStart) + inserted + value.slice(selEnd);
    const start = selStart + w.length;
    return { value: next, start, end: start + selected.length };
  }

  return { value, start: selStart, end: selEnd };
}
