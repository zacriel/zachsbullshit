import { useState, type ReactNode } from 'react';

/**
 * A small Discord-flavored markdown renderer. Supports the inline set
 * (**bold**, *italic* / _italic_, __underline__, ~~strike~~, ||spoiler||,
 * `code`, [label](url), and bare URLs) plus block elements (```code fences```,
 * > blockquotes, #/##/### headings, - and 1. lists). Content is admin-authored
 * and rendered to React nodes — never injected as raw HTML.
 */

function Spoiler({ children }: { children: ReactNode }) {
  const [on, setOn] = useState(false);
  return (
    <span
      className={`rt-spoiler ${on ? 'rt-spoiler--on' : ''}`}
      onClick={(e) => {
        if (!on) {
          e.preventDefault();
          e.stopPropagation();
          setOn(true);
        }
      }}
    >
      {children}
    </span>
  );
}

interface Rule {
  re: RegExp;
  kind: 'wrap' | 'code' | 'link' | 'autolink';
  wrap?: (kids: ReactNode, key: string) => ReactNode;
}

const BASE_RULES: Rule[] = [
  { re: /`([^`\n]+)`/, kind: 'code' },
  { re: /\|\|([\s\S]+?)\|\|/, kind: 'wrap', wrap: (k, key) => <Spoiler key={key}>{k}</Spoiler> },
  { re: /\*\*([\s\S]+?)\*\*/, kind: 'wrap', wrap: (k, key) => <strong key={key}>{k}</strong> },
  { re: /__([\s\S]+?)__/, kind: 'wrap', wrap: (k, key) => <u key={key}>{k}</u> },
  { re: /~~([\s\S]+?)~~/, kind: 'wrap', wrap: (k, key) => <s key={key}>{k}</s> },
  { re: /\*([\s\S]+?)\*/, kind: 'wrap', wrap: (k, key) => <em key={key}>{k}</em> },
  { re: /_([\s\S]+?)_/, kind: 'wrap', wrap: (k, key) => <em key={key}>{k}</em> },
];
const LINK_RULE: Rule = { re: /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/, kind: 'link' };
const AUTOLINK_RULE: Rule = { re: /(https?:\/\/[^\s<]+)/, kind: 'autolink' };

function parseInline(str: string, links: boolean, depth = 0): ReactNode[] {
  if (!str) return [];
  if (depth > 12) return [str];
  const rules = links ? [...BASE_RULES, LINK_RULE, AUTOLINK_RULE] : BASE_RULES;
  const out: ReactNode[] = [];
  let rest = str;
  let guard = 0;
  while (rest && guard++ < 800) {
    let best: RegExpExecArray | null = null;
    let bestRule: Rule | null = null;
    for (const rule of rules) {
      const m = rule.re.exec(rest);
      if (m && (best === null || m.index < best.index)) {
        best = m;
        bestRule = rule;
      }
    }
    if (!best || !bestRule) {
      out.push(rest);
      break;
    }
    if (best.index > 0) out.push(rest.slice(0, best.index));
    const key = `n${depth}-${out.length}`;
    if (bestRule.kind === 'code') {
      out.push(<code key={key} className="rt-code">{best[1]}</code>);
    } else if (bestRule.kind === 'link') {
      out.push(<a key={key} href={best[2]} target="_blank" rel="noopener noreferrer">{best[1]}</a>);
    } else if (bestRule.kind === 'autolink') {
      out.push(<a key={key} href={best[1]} target="_blank" rel="noopener noreferrer">{best[1]}</a>);
    } else {
      out.push(bestRule.wrap!(parseInline(best[1], links, depth + 1), key));
    }
    rest = rest.slice(best.index + best[0].length);
  }
  return out;
}

/** Inline-only rendering (no block elements) for short one-line fields. */
export function RichInline({ text, links = true }: { text: string; links?: boolean }) {
  return <span className="rt rt--inline">{parseInline(text || '', links)}</span>;
}

/** Full block + inline rendering, for the Text/Note tile. */
export function RichText({ text }: { text: string }) {
  const src = text || '';
  const lines = src.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let k = 0;

  const inlineLines = (arr: string[]) =>
    arr.map((ln, j) => (
      <span key={j}>
        {parseInline(ln, true)}
        {j < arr.length - 1 && <br />}
      </span>
    ));

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      blocks.push(<pre key={k++} className="rt-pre"><code>{body.join('\n')}</code></pre>);
      continue;
    }

    // Blockquote (consecutive > lines)
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(<blockquote key={k++} className="rt-quote">{inlineLines(quote)}</blockquote>);
      continue;
    }

    // Headings
    const h = /^\s*(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const lvl = h[1].length;
      const Tag = (lvl === 1 ? 'h3' : lvl === 2 ? 'h4' : 'h5') as 'h3' | 'h4' | 'h5';
      blocks.push(<Tag key={k++} className="rt-h">{parseInline(h[2], true)}</Tag>);
      i += 1;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(<ul key={k++} className="rt-list">{items.map((it, j) => <li key={j}>{parseInline(it, true)}</li>)}</ul>);
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(<ol key={k++} className="rt-list">{items.map((it, j) => <li key={j}>{parseInline(it, true)}</li>)}</ol>);
      continue;
    }

    // Blank line → spacing
    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Paragraph (consecutive plain lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={k++} className="rt-p">{inlineLines(para)}</p>);
  }

  return <div className="rt">{blocks}</div>;
}
