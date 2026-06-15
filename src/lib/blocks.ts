/**
 * Block model for the editor + serialization to a Telegram Rich Message
 * (Bot API 10.1). The whole document becomes ONE HTML string sent via
 * sendRichMessage (html field). HTML mode is used because it maps cleanly and
 * escaping is well-defined.
 *
 * Media note: rich messages accept media only by HTTP(S) URL — device uploads
 * (data: URLs) can't be embedded, so media blocks store a URL.
 */

export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullets'
  | 'numbered'
  | 'checklist'
  | 'accordion'
  | 'image'
  | 'carousel'
  | 'grid'
  | 'audio'
  | 'video'
  | 'code'
  | 'formula'
  | 'divider'
  | 'time'
  | 'table';

export interface BlockBase {
  id: string;
}

export interface MediaRef {
  url: string;
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
  | (BlockBase & { type: 'image' | 'audio' | 'video'; url: string; caption: string })
  | (BlockBase & { type: 'carousel' | 'grid'; items: MediaRef[] });

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
    case 'bullets':
    case 'numbered':
    case 'checklist':
    case 'formula':
      return { id: nextId(), type, value: '' };
    case 'accordion':
      return { id: nextId(), type, title: '', value: '' };
    case 'code':
      return { id: nextId(), type, language: '', value: '' };
    case 'table':
      return { id: nextId(), type, value: 'Колонка 1 | Колонка 2\nЗначение | Значение' };
    case 'time':
      return { id: nextId(), type, value: Math.floor(Date.now() / 1000) };
    case 'divider':
      return { id: nextId(), type };
    case 'image':
    case 'audio':
    case 'video':
      return { id: nextId(), type, url: '', caption: '' };
    case 'carousel':
    case 'grid':
      return { id: nextId(), type, items: [] };
  }
}

/* ─── Serialization to Rich Message HTML ────────────────────────────────── */

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escAttr(s: string): string {
  return esc(s).replace(/"/g, '&quot;');
}
function escBr(s: string): string {
  return esc(s).replace(/\n/g, '<br>');
}

function mediaTag(url: string): string {
  const u = url.toLowerCase().split('?')[0];
  if (/\.(mp4|mov|webm|gif)$/.test(u)) return `<video src="${escAttr(url)}"></video>`;
  if (/\.(mp3|ogg|oga|m4a|wav)$/.test(u)) return `<audio src="${escAttr(url)}"></audio>`;
  return `<img src="${escAttr(url)}"/>`;
}

function timeLabel(unix: number): string {
  return new Date(unix * 1000).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function tableHtml(src: string): string {
  const rows = src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split('|').map((c) => c.trim()));
  if (!rows.length) return '';
  const [head, ...body] = rows;
  const headHtml = `<tr>${head.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const bodyHtml = body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  return `<table>${headHtml}${bodyHtml}</table>`;
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case 'text':
      return block.value.trim() ? `<p>${escBr(block.value)}</p>` : '';
    case 'h1':
      return block.value.trim() ? `<h1>${esc(block.value)}</h1>` : '';
    case 'h2':
      return block.value.trim() ? `<h2>${esc(block.value)}</h2>` : '';
    case 'h3':
      return block.value.trim() ? `<h3>${esc(block.value)}</h3>` : '';
    case 'bullets': {
      const items = block.value.split('\n').filter((l) => l.trim());
      return items.length ? `<ul>${items.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '';
    }
    case 'numbered': {
      const items = block.value.split('\n').filter((l) => l.trim());
      return items.length ? `<ol>${items.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : '';
    }
    case 'checklist': {
      const items = block.value.split('\n').filter((l) => l.trim());
      if (!items.length) return '';
      const lis = items
        .map((l) => {
          const checked = /^\s*\[x\]/i.test(l);
          const text = l.replace(/^\s*\[[ x]\]\s*/i, '');
          return `<li><input type="checkbox"${checked ? ' checked' : ''}>${esc(text)}</li>`;
        })
        .join('');
      return `<ul>${lis}</ul>`;
    }
    case 'accordion': {
      if (!block.title.trim() && !block.value.trim()) return '';
      return `<details><summary>${esc(block.title || 'Подробнее')}</summary><p>${escBr(block.value)}</p></details>`;
    }
    case 'code': {
      if (!block.value.trim()) return '';
      const inner = block.language
        ? `<code class="language-${escAttr(block.language)}">${esc(block.value)}</code>`
        : esc(block.value);
      return `<pre>${inner}</pre>`;
    }
    case 'formula':
      return block.value.trim() ? `<tg-math-block>${esc(block.value)}</tg-math-block>` : '';
    case 'divider':
      return '<hr/>';
    case 'time':
      return `<p><tg-time unix="${block.value}" format="wDT">${esc(timeLabel(block.value))}</tg-time></p>`;
    case 'table':
      return tableHtml(block.value);
    case 'image':
    case 'audio':
    case 'video': {
      if (!block.url.trim()) return '';
      const tag = mediaTag(block.url);
      return block.caption.trim()
        ? `<figure>${tag}<figcaption>${esc(block.caption)}</figcaption></figure>`
        : tag;
    }
    case 'carousel':
    case 'grid': {
      const valid = block.items.filter((m) => m.url.trim());
      if (!valid.length) return '';
      const inner = valid.map((m) => mediaTag(m.url)).join('');
      return block.type === 'carousel' ? `<tg-slideshow>${inner}</tg-slideshow>` : `<tg-collage>${inner}</tg-collage>`;
    }
  }
}

export function serializeToRichHtml(blocks: Block[]): string {
  return blocks
    .map(blockToHtml)
    .filter(Boolean)
    .join('\n');
}

/** Empty if nothing but blanks/dividers would be sent. */
export function isEmptyDocument(blocks: Block[]): boolean {
  return serializeToRichHtml(blocks).replace(/<hr\/>/g, '').trim().length === 0;
}
