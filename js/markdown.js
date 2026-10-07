// 마크다운 → HTML 변환기
// 원본에 들어 있는 HTML 태그는 지원하지 않고 모두 이스케이프한다(XSS 방지).

const HEADING_RE = /^ {0,3}(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const HR_RE = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^ {0,3}> ?/;
const LIST_RE = /^( *)([-*+]|\d{1,9}[.)])(?: +|$)/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

// 인라인 처리 중 이미 변환한 HTML을 잠시 숨겨 두는 자리표시자
const TOKEN_RE = /\u0000(\d+)\u0000/g;
const BREAK = '\u0001';

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// http(s), mailto, 상대 경로, #앵커만 허용하고 javascript: 같은 스킴은 막는다
export function sanitizeUrl(url) {
  const cleaned = String(url).replace(/[\u0000- \u007F]/g, '');
  if (/^(https?:|mailto:)/i.test(cleaned)) return cleaned;
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return '#';
  return cleaned;
}

export function parseMarkdown(text) {
  const source = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const { meta, body } = parseFrontMatter(source);
  const lines = body
    .split('\n')
    .map((line) => line.replace(/^\t+/, (tabs) => '    '.repeat(tabs.length)));
  const ctx = { slugs: new Map() };
  return { meta, html: parseBlocks(lines, ctx) };
}

function parseFrontMatter(text) {
  const match = text.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  for (const line of match[1].split('\n')) {
    const pair = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const raw = pair[2].trim();
    if (/^\[.*\]$/.test(raw)) {
      meta[pair[1]] = raw
        .slice(1, -1)
        .split(',')
        .map((item) => unquote(item.trim()))
        .filter(Boolean);
    } else {
      meta[pair[1]] = unquote(raw);
    }
  }
  return { meta, body: text.slice(match[0].length) };
}

function unquote(value) {
  return value.replace(/^(["'])(.*)\1$/, '$2');
}

/* ===== 블록 ===== */

function isBlank(line) {
  return /^\s*$/.test(line);
}

function indentOf(line) {
  return line.match(/^ */)[0].length;
}

function stripIndent(line, count) {
  return line.replace(new RegExp(`^ {0,${count}}`), '');
}

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && TABLE_SEP_RE.test(lines[i + 1]) && lines[i + 1].includes('-');
}

function startsBlock(lines, i) {
  const line = lines[i];
  return (
    isBlank(line) ||
    HEADING_RE.test(line) ||
    FENCE_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

function parseBlocks(lines, ctx) {
  let html = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const close = new RegExp(`^ {0,3}${fence[1][0] === '`' ? '`' : '~'}{${fence[1].length},}\\s*$`);
      const code = [];
      i++;
      while (i < lines.length && !close.test(lines[i])) {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스
      const lang = fence[2] ? ` class="language-${escapeHtml(fence[2])}"` : '';
      html += `<pre><code${lang}>${escapeHtml(code.join('\n'))}</code></pre>\n`;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      const id = uniqueSlug(heading[2], ctx);
      html += `<h${level} id="${escapeHtml(id)}">${parseInline(heading[2])}</h${level}>\n`;
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      html += '<hr>\n';
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const quoted = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        quoted.push(lines[i].replace(QUOTE_RE, ''));
        i++;
      }
      html += `<blockquote>\n${parseBlocks(quoted, ctx)}</blockquote>\n`;
      continue;
    }

    if (LIST_RE.test(line)) {
      const list = parseList(lines, i, ctx);
      html += list.html;
      i = list.next;
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = parseTable(lines, i);
      html += table.html;
      i = table.next;
      continue;
    }

    // 문단: 빈 줄이나 다른 블록이 시작될 때까지 모은다
    const para = [];
    while (i < lines.length && (para.length === 0 || !startsBlock(lines, i))) {
      para.push(lines[i]);
      i++;
    }
    html += `<p>${parseInline(joinParagraph(para))}</p>\n`;
  }

  return html;
}

// 줄 끝 공백 2칸 또는 역슬래시는 강제 줄바꿈으로 처리한다
function joinParagraph(lines) {
  return lines
    .map((line, idx) => {
      const trimmed = line.trim();
      if (idx === lines.length - 1) return trimmed;
      if (/ {2,}$/.test(line)) return trimmed + BREAK;
      if (/\\$/.test(trimmed)) return trimmed.slice(0, -1) + BREAK;
      return trimmed + '\n';
    })
    .join('');
}

function parseList(lines, start, ctx) {
  const first = lines[start].match(LIST_RE);
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;

  while (i < lines.length) {
    const marker = lines[i].match(LIST_RE);
    if (!marker || marker[1].length !== baseIndent || /\d/.test(marker[2]) !== ordered) break;

    const contentIndent = marker[0].length;
    const itemLines = [lines[i].slice(contentIndent)];
    i++;

    while (i < lines.length) {
      const line = lines[i];

      if (isBlank(line)) {
        let j = i + 1;
        while (j < lines.length && isBlank(lines[j])) j++;
        if (j < lines.length && indentOf(lines[j]) > baseIndent) {
          // 들여쓴 내용이 이어지면 같은 항목에 속한다
          for (let k = i; k < j; k++) itemLines.push('');
          i = j;
          continue;
        }
        const sibling = j < lines.length && lines[j].match(LIST_RE);
        if (sibling && sibling[1].length === baseIndent && /\d/.test(sibling[2]) === ordered) i = j;
        break;
      }

      const indent = indentOf(line);
      if (indent > baseIndent) {
        itemLines.push(stripIndent(line, Math.min(indent, contentIndent)));
        i++;
        continue;
      }
      // 들여쓰지 않은 이어지는 줄(lazy continuation)도 같은 항목의 문단으로 본다
      if (!startsBlock(lines, i)) {
        itemLines.push(line);
        i++;
        continue;
      }
      break;
    }

    items.push(itemLines);
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const body = items
    .map((itemLines) => {
      // 첫 문단은 <p> 없이 바로 보여 준다(촘촘한 목록)
      const inner = parseBlocks(itemLines, ctx).replace(/^<p>([\s\S]*?)<\/p>\n?/, '$1');
      return `<li>${inner.trim()}</li>`;
    })
    .join('\n');

  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>\n`, next: i };
}

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function parseTable(lines, start) {
  const headers = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    const left = cell.startsWith(':');
    const right = cell.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    if (left) return 'left';
    return '';
  });

  const cell = (tag, content, idx) => {
    const align = aligns[idx] ? ` style="text-align: ${aligns[idx]}"` : '';
    return `<${tag}${align}>${parseInline(content || '')}</${tag}>`;
  };

  let i = start + 2;
  const rows = [];
  while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    rows.push(`<tr>${headers.map((_, idx) => cell('td', cells[idx], idx)).join('')}</tr>`);
    i++;
  }

  const head = `<thead><tr>${headers.map((text, idx) => cell('th', text, idx)).join('')}</tr></thead>`;
  const body = rows.length ? `<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  return { html: `<div class="table-wrap"><table>\n${head}\n${body}\n</table></div>\n`, next: i };
}

function uniqueSlug(raw, ctx) {
  const base =
    raw
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-') || 'section';
  const count = ctx.slugs.get(base) || 0;
  ctx.slugs.set(base, count + 1);
  return count ? `${base}-${count}` : base;
}

/* ===== 인라인 ===== */

export function parseInline(text) {
  const tokens = [];
  let html = renderInline(text, tokens);
  // 링크 라벨처럼 자리표시자 안에 또 자리표시자가 있을 수 있어 모두 풀릴 때까지 반복한다
  while (/\u0000\d+\u0000/.test(html)) {
    html = html.replace(TOKEN_RE, (_, n) => tokens[n]);
  }
  return html.replace(new RegExp(BREAK, 'g'), '<br>\n');
}

function renderInline(text, tokens) {
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  const plain = (value) => value.replace(TOKEN_RE, '');

  let out = text;

  // 1. 코드 스팬: 안쪽은 다른 문법을 적용하지 않는다
  out = out.replace(/(`+)(?!`)([\s\S]*?[^`])\1(?!`)/g, (_, ticks, code) =>
    stash(`<code>${escapeHtml(code.replace(/^ ([\s\S]*) $/, '$1'))}</code>`)
  );

  // 2. 역슬래시 이스케이프
  out = out.replace(/\\([\\`*_{}[\]()#+\-.!|~<>])/g, (_, ch) => stash(escapeHtml(ch)));

  // 3. 자동 링크 <https://...>
  out = out.replace(/<(https?:\/\/[^\s<>]+)>/g, (_, url) => stash(anchor(url, escapeHtml(url))));

  // 4. 이미지
  out = out.replace(/!\[([^\]]*)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)/g, (_, alt, src, title) => {
    const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
    return stash(
      `<img src="${escapeHtml(sanitizeUrl(src))}" alt="${escapeHtml(plain(alt))}"${titleAttr} loading="lazy">`
    );
  });

  // 5. 링크 (라벨 안의 강조 등은 재귀로 처리)
  out = out.replace(/\[([^\]]+)\]\(\s*<?([^\s)>]+)>?(?:\s+"([^"]*)")?\s*\)/g, (_, label, href, title) =>
    stash(anchor(href, renderInline(label, tokens), title))
  );

  // 6. 나머지 텍스트 이스케이프 후 강조 문법 적용
  out = escapeHtml(out)
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([\s\S]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([\s\S]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

  return out;
}

function anchor(href, labelHtml, title) {
  const url = sanitizeUrl(href);
  const external = /^(https?:)?\/\//i.test(url);
  const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
  const extAttr = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a href="${escapeHtml(url)}"${titleAttr}${extAttr}>${labelHtml}</a>`;
}
