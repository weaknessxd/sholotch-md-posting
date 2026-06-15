/**
 * Lightweight Markdown → Telegram message entities parser.
 *
 * Telegram messages are sent as plain `text` + an array of `entities`
 * (offset/length/type in UTF-16 code units). Sending entities directly is far
 * more robust than parse_mode=MarkdownV2, which requires fragile escaping.
 *
 * Supported syntax (a friendly superset of Telegram MarkdownV2):
 *   **bold**            __underline__        ~~strike~~        ||spoiler||
 *   *italic* / _italic_ `inline code`        [text](https://url)
 *   ```lang\ncode\n```  (pre block)
 *   > quote line(s)     **> expandable quote
 *
 * The same {text, entities} output feeds the live preview (entitiesToHtml)
 * and the backend (sendMessage { text, entities }).
 */

export type EntityType =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'spoiler'
  | 'code'
  | 'pre'
  | 'text_link'
  | 'blockquote'
  | 'expandable_blockquote';

export interface MessageEntity {
  type: EntityType;
  offset: number;
  length: number;
  url?: string;
  language?: string;
}

export interface ParsedMessage {
  text: string;
  entities: MessageEntity[];
}

// Inline delimiters, checked longest-first so `**` wins over `*`.
const INLINE_DELIMS: { marker: string; type: EntityType }[] = [
  { marker: '**', type: 'bold' },
  { marker: '__', type: 'underline' },
  { marker: '~~', type: 'strikethrough' },
  { marker: '||', type: 'spoiler' },
  { marker: '*', type: 'bold' },
  { marker: '_', type: 'italic' },
];

interface OpenMark {
  marker: string;
  type: EntityType;
  outStart: number;
}

/** Parse a single block of inline text. Offsets are relative to 0. */
function parseInline(src: string): ParsedMessage {
  let out = '';
  const entities: MessageEntity[] = [];
  const open: OpenMark[] = [];
  let i = 0;

  const closeMark = (idx: number) => {
    const m = open[idx];
    entities.push({ type: m.type, offset: m.outStart, length: out.length - m.outStart });
    open.splice(idx, 1);
  };

  while (i < src.length) {
    const ch = src[i];

    // Escape: backslash makes the next char literal.
    if (ch === '\\' && i + 1 < src.length) {
      out += src[i + 1];
      i += 2;
      continue;
    }

    // Inline code: `...` (literal, no nested parsing).
    if (ch === '`') {
      const end = src.indexOf('`', i + 1);
      if (end !== -1) {
        const content = src.slice(i + 1, end);
        entities.push({ type: 'code', offset: out.length, length: content.length });
        out += content;
        i = end + 1;
        continue;
      }
    }

    // Link: [text](url)
    if (ch === '[') {
      const close = src.indexOf(']', i + 1);
      if (close !== -1 && src[close + 1] === '(') {
        const paren = src.indexOf(')', close + 2);
        if (paren !== -1) {
          const label = src.slice(i + 1, close);
          const url = src.slice(close + 2, paren);
          const inner = parseInline(label);
          const base = out.length;
          out += inner.text;
          entities.push({ type: 'text_link', offset: base, length: inner.text.length, url });
          for (const e of inner.entities) entities.push({ ...e, offset: e.offset + base });
          i = paren + 1;
          continue;
        }
      }
    }

    // Paired inline delimiters.
    let matched = false;
    for (const { marker, type } of INLINE_DELIMS) {
      if (src.startsWith(marker, i)) {
        const openIdx = open.findIndex((o) => o.marker === marker);
        if (openIdx !== -1) closeMark(openIdx);
        else open.push({ marker, type, outStart: out.length });
        i += marker.length;
        matched = true;
        break;
      }
    }
    if (matched) continue;

    out += ch;
    i += 1;
  }

  // Drop unclosed marks (their text is already in `out`).
  return { text: out, entities };
}

export function parseMarkdown(src: string): ParsedMessage {
  const lines = src.split('\n');
  let text = '';
  const entities: MessageEntity[] = [];

  const append = (block: ParsedMessage) => {
    const base = text.length;
    text += block.text;
    for (const e of block.entities) entities.push({ ...e, offset: e.offset + base });
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```lang
    const fence = /^```(\w*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] || undefined;
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      const content = body.join('\n');
      const base = text.length;
      entities.push({ type: 'pre', offset: base, length: content.length, language });
      text += content;
      if (i < lines.length) text += '\n';
      continue;
    }

    // Blockquote group: lines starting with `>` (or `**>` for expandable).
    const quote = /^(\*\*)?>\s?(.*)$/.exec(line);
    if (quote) {
      const expandable = Boolean(quote[1]);
      const inner: string[] = [quote[2]];
      i += 1;
      while (i < lines.length) {
        const m = /^(?:\*\*)?>\s?(.*)$/.exec(lines[i]);
        if (!m) break;
        inner.push(m[1]);
        i += 1;
      }
      const parsed = parseInline(inner.join('\n'));
      const base = text.length;
      entities.push({
        type: expandable ? 'expandable_blockquote' : 'blockquote',
        offset: base,
        length: parsed.text.length,
      });
      append(parsed);
      if (i < lines.length) text += '\n';
      continue;
    }

    // Normal line.
    append(parseInline(line));
    if (i < lines.length - 1) text += '\n';
    i += 1;
  }

  return { text, entities };
}

/* ─── Preview rendering ─────────────────────────────────────────────────── */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const TAGS: Partial<Record<EntityType, [string, string]>> = {
  bold: ['<b>', '</b>'],
  italic: ['<i>', '</i>'],
  underline: ['<u>', '</u>'],
  strikethrough: ['<s>', '</s>'],
  spoiler: ['<span class="tg-spoiler">', '</span>'],
  code: ['<code>', '</code>'],
  pre: ['<pre>', '</pre>'],
  blockquote: ['<blockquote>', '</blockquote>'],
  expandable_blockquote: ['<blockquote class="tg-expandable">', '</blockquote>'],
};

/**
 * Render {text, entities} to HTML for the preview. Inserts open/close markers
 * at entity boundaries, then escapes the surrounding text segments.
 */
export function entitiesToHtml(text: string, entities: MessageEntity[]): string {
  type Marker = { pos: number; open: boolean; order: number; html: string };
  const markers: Marker[] = [];

  entities.forEach((e, idx) => {
    if (e.type === 'text_link') {
      const href = escapeHtml(e.url ?? '#');
      markers.push({ pos: e.offset, open: true, order: idx, html: `<a href="${href}">` });
      markers.push({ pos: e.offset + e.length, open: false, order: idx, html: '</a>' });
      return;
    }
    const tag = TAGS[e.type];
    if (!tag) return;
    markers.push({ pos: e.offset, open: true, order: idx, html: tag[0] });
    markers.push({ pos: e.offset + e.length, open: false, order: idx, html: tag[1] });
  });

  // Sort by position; at the same position close before open, and nest
  // consistently so tags don't cross.
  markers.sort((a, b) => {
    if (a.pos !== b.pos) return a.pos - b.pos;
    if (a.open !== b.open) return a.open ? 1 : -1;
    return a.open ? a.order - b.order : b.order - a.order;
  });

  let html = '';
  let cursor = 0;
  for (const m of markers) {
    if (m.pos > cursor) {
      html += escapeHtml(text.slice(cursor, m.pos));
      cursor = m.pos;
    }
    html += m.html;
  }
  if (cursor < text.length) html += escapeHtml(text.slice(cursor));

  return html.replace(/\n/g, '<br/>');
}

/** Convenience: source markdown → preview HTML. */
export function markdownToHtml(src: string): string {
  const { text, entities } = parseMarkdown(src);
  return entitiesToHtml(text, entities);
}

export const MAX_TEXT_LENGTH = 4096;
export const MAX_CAPTION_LENGTH = 1024;
