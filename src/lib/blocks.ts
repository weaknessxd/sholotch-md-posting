import { parseMarkdown, type MessageEntity } from './markdown';
import type { MediaItem } from './types';

/**
 * Block model for the editor. A document is an ordered list of Blocks.
 * Blocks serialize to an ordered sequence of Telegram messages: runs of
 * text-renderable blocks are merged into one text message (text + entities),
 * while media blocks become their own message / album.
 */

export type BlockType =
  // Текст
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  // Списки
  | 'bullets'
  | 'numbered'
  | 'checklist'
  | 'accordion'
  // Медиа
  | 'image'
  | 'carousel'
  | 'grid'
  | 'audio'
  | 'video'
  // Другое
  | 'code'
  | 'formula'
  | 'divider'
  | 'time'
  | 'table';

export interface BlockBase {
  id: string;
}

export type Block =
  | (BlockBase & { type: 'text' | 'h1' | 'h2' | 'h3'; value: string })
  | (BlockBase & { type: 'bullets' | 'numbered' | 'checklist'; value: string })
  | (BlockBase & { type: 'accordion'; title: string; value: string })
  | (BlockBase & { type: 'code'; language: string; value: string })
  | (BlockBase & { type: 'formula'; value: string })
  | (BlockBase & { type: 'table'; value: string })
  | (BlockBase & { type: 'time'; value: number })
  | (BlockBase & { type: 'divider' })
  | (BlockBase & { type: 'image' | 'audio' | 'video'; media: MediaItem | null })
  | (BlockBase & { type: 'carousel' | 'grid'; media: MediaItem[] });

export const TEXT_BLOCK_TYPES: BlockType[] = ['text', 'h1', 'h2', 'h3'];
export const MEDIA_BLOCK_TYPES: BlockType[] = ['image', 'carousel', 'grid', 'audio', 'video'];

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `b${Date.now().toString(36)}_${idCounter}`;
}

export function createBlock(type: BlockType): Block {
  switch (type) {
    case 'text':
    case 'h1':
    case 'h2':
    case 'h3':
      return { id: nextId(), type, value: '' };
    case 'bullets':
    case 'numbered':
    case 'checklist':
      return { id: nextId(), type, value: '' };
    case 'accordion':
      return { id: nextId(), type, title: '', value: '' };
    case 'code':
      return { id: nextId(), type, language: '', value: '' };
    case 'formula':
      return { id: nextId(), type, value: '' };
    case 'table':
      return { id: nextId(), type, value: 'Колонка 1 | Колонка 2\nЗначение | Значение' };
    case 'time':
      return { id: nextId(), type, value: Math.floor(Date.now() / 1000) };
    case 'divider':
      return { id: nextId(), type };
    case 'image':
    case 'audio':
    case 'video':
      return { id: nextId(), type, media: null };
    case 'carousel':
    case 'grid':
      return { id: nextId(), type, media: [] };
  }
}

/* ─── Serialization ─────────────────────────────────────────────────────── */

export interface TextFragment {
  text: string;
  entities: MessageEntity[];
}

export type OutgoingMessage =
  | ({ kind: 'text' } & TextFragment)
  | { kind: 'media'; media: MediaItem }
  | { kind: 'album'; media: MediaItem[] };

// Superscript / subscript maps for the formula block (Telegram has no math).
const SUP: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷',
  '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '=': '⁼', '(': '⁽', ')': '⁾', n: 'ⁿ', i: 'ⁱ',
};
const SUB: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇',
  '8': '₈', '9': '₉', '+': '₊', '-': '₋', '=': '₌', '(': '₍', ')': '₎',
};

function toUnicodeMath(src: string): string {
  // x^2 -> x², x^{abc} -> superscript run; a_1 -> a₁, a_{ij} -> subscript run
  const conv = (run: string, map: Record<string, string>) =>
    [...run].map((ch) => map[ch] ?? ch).join('');
  return src
    .replace(/\^\{([^}]*)\}/g, (_, r) => conv(r, SUP))
    .replace(/\^(\S)/g, (_, r) => conv(r, SUP))
    .replace(/_\{([^}]*)\}/g, (_, r) => conv(r, SUB))
    .replace(/_(\S)/g, (_, r) => conv(r, SUB));
}

function formatTime(unix: number): string {
  const d = new Date(unix * 1000);
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function renderTable(src: string): string {
  const rows = src
    .split('\n')
    .map((line) => line.split('|').map((c) => c.trim()))
    .filter((r) => r.length > 0);
  if (!rows.length) return src;
  const cols = Math.max(...rows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, c) =>
    Math.max(...rows.map((r) => (r[c] ?? '').length)),
  );
  return rows
    .map((r) => r.map((cell, c) => (cell ?? '').padEnd(widths[c])).join('  '))
    .join('\n');
}

/** Convert a single text-renderable block to a {text, entities} fragment. */
function blockToFragment(block: Block): TextFragment | null {
  switch (block.type) {
    case 'text': {
      return parseMarkdown(block.value);
    }
    case 'h1':
    case 'h2':
    case 'h3': {
      const inner = parseMarkdown(block.value);
      const text = block.type === 'h1' ? inner.text.toUpperCase() : inner.text;
      return {
        text,
        entities: [{ type: 'bold', offset: 0, length: text.length }, ...inner.entities],
      };
    }
    case 'bullets': {
      const text = block.value
        .split('\n')
        .map((l) => `• ${l}`)
        .join('\n');
      return { text, entities: [] };
    }
    case 'numbered': {
      const text = block.value
        .split('\n')
        .map((l, i) => `${i + 1}. ${l}`)
        .join('\n');
      return { text, entities: [] };
    }
    case 'checklist': {
      const text = block.value
        .split('\n')
        .map((l) => {
          const done = /^\s*\[x\]\s*/i.test(l);
          return `${done ? '✅' : '☐'} ${l.replace(/^\s*\[[ x]\]\s*/i, '')}`;
        })
        .join('\n');
      return { text, entities: [] };
    }
    case 'accordion': {
      const head = parseMarkdown(block.title);
      const body = parseMarkdown(block.value);
      const text = head.text + (body.text ? `\n${body.text}` : '');
      const entities: MessageEntity[] = [
        { type: 'expandable_blockquote', offset: 0, length: text.length },
        ...head.entities,
      ];
      if (head.text) entities.push({ type: 'bold', offset: 0, length: head.text.length });
      const bodyOffset = head.text.length + 1;
      for (const e of body.entities) entities.push({ ...e, offset: e.offset + bodyOffset });
      return { text, entities };
    }
    case 'code': {
      const text = block.value;
      return {
        text,
        entities: [
          { type: 'pre', offset: 0, length: text.length, language: block.language || undefined },
        ],
      };
    }
    case 'formula': {
      return { text: toUnicodeMath(block.value), entities: [] };
    }
    case 'table': {
      const text = renderTable(block.value);
      return { text, entities: [{ type: 'pre', offset: 0, length: text.length }] };
    }
    case 'time': {
      return { text: formatTime(block.value), entities: [] };
    }
    case 'divider': {
      return { text: '──────────', entities: [] };
    }
    default:
      return null; // media blocks
  }
}

/** Merge text fragments into one with adjusted offsets, joined by `\n\n`. */
function mergeFragments(frags: TextFragment[]): TextFragment {
  let text = '';
  const entities: MessageEntity[] = [];
  frags.forEach((f, idx) => {
    if (idx > 0) text += '\n\n';
    const base = text.length;
    text += f.text;
    for (const e of f.entities) entities.push({ ...e, offset: e.offset + base });
  });
  return { text, entities };
}

export function serializeBlocks(blocks: Block[]): OutgoingMessage[] {
  const messages: OutgoingMessage[] = [];
  let buffer: TextFragment[] = [];

  const flush = () => {
    if (!buffer.length) return;
    const merged = mergeFragments(buffer);
    if (merged.text.trim().length > 0) messages.push({ kind: 'text', ...merged });
    buffer = [];
  };

  for (const block of blocks) {
    if (block.type === 'image' || block.type === 'audio' || block.type === 'video') {
      if (block.media) {
        flush();
        messages.push({ kind: 'media', media: block.media });
      }
      continue;
    }
    if (block.type === 'carousel' || block.type === 'grid') {
      if (block.media.length) {
        flush();
        messages.push({ kind: 'album', media: block.media });
      }
      continue;
    }
    const frag = blockToFragment(block);
    if (frag) buffer.push(frag);
  }
  flush();
  return messages;
}

/** True when the document has nothing publishable. */
export function isEmptyDocument(blocks: Block[]): boolean {
  return serializeBlocks(blocks).length === 0;
}
