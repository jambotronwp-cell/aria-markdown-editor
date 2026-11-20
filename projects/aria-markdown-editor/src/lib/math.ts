import type { MarkedExtension, Tokens } from 'marked';
import type { JtKatex } from './config';

const MATH = 'jt-math';
const DISPLAY = 'jt-math--display';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Parsing rules from marked-katex-extension 5.1.13 (MIT, © 2021 @markedjs). The package itself is not used:
// it imports KaTeX statically, and KaTeX (≈350 KB) would land in every page's bundle.
const INLINE_RULE = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:？！。，：]|$)/;
const BLOCK_RULE = /^(\${1,2})\n((?:\\[^]|[^\\])+?)\n\1(?:\n|$)/;

function placeholder(token: Tokens.Generic): string {
  const display = token['displayMode'] === true;
  return `<span class="${MATH}${display ? ' ' + DISPLAY : ''}">${escapeHtml(String(token['text'] ?? ''))}</span>`;
}

function mathToken(type: string, match: RegExpMatchArray): Tokens.Generic {
  return { type, raw: match[0], text: match[2].trim(), displayMode: match[1].length === 2 };
}

/**
 * Formulas `$…$` and `$$…$$`. Parsed with the rules of marked-katex-extension (so marked keeps `_` and `*` inside
 * a formula), but the HTML gets the TeX source in <span class="jt-math">, not KaTeX markup: Angular's sanitizer drops
 * `style`, and KaTeX fractions and roots fall apart. renderMath() draws KaTeX into the DOM after the sanitizer.
 */
export function markdownMathExtension(): MarkedExtension {
  return {
    extensions: [
      {
        name: 'inlineKatex',
        level: 'inline',
        start(src: string) {
          let rest = src;
          let offset = 0;
          while (rest) {
            const index = rest.indexOf('$');
            if (index === -1) {
              return undefined;
            }
            if ((index === 0 || rest.charAt(index - 1) === ' ') && INLINE_RULE.test(rest.substring(index))) {
              return offset + index;
            }
            const next = rest.substring(index + 1);
            const skipped = next.length - next.replace(/^\$+/, '').length;
            offset += index + 1 + skipped;
            rest = next.substring(skipped);
          }
          return undefined;
        },
        tokenizer(src: string) {
          const match = src.match(INLINE_RULE);
          return match ? mathToken('inlineKatex', match) : undefined;
        },
        renderer: (token: Tokens.Generic) => placeholder(token)
      },
      {
        name: 'blockKatex',
        level: 'block',
        tokenizer(src: string) {
          const match = src.match(BLOCK_RULE);
          return match ? mathToken('blockKatex', match) : undefined;
        },
        renderer: (token: Tokens.Generic) => `<p>${placeholder(token)}</p>\n`
      }
    ]
  } as MarkedExtension;
}

/**
 * Draws KaTeX into the formula placeholders inside the element; a broken formula shows red, the page stays.
 * Without a loader formulas stay as TeX source. Browser only (KaTeX needs `document`).
 */
export async function renderMath(element: HTMLElement, katex?: () => Promise<JtKatex>): Promise<void> {
  const spans = Array.from(element.querySelectorAll<HTMLElement>(`span.${MATH}`));
  if (spans.length === 0 || !katex) {
    return;
  }
  const engine = await katex();
  spans.forEach(span => {
    if (!span.isConnected || !span.classList.contains(MATH)) {
      return;
    }
    const tex = span.textContent ?? '';
    const displayMode = span.classList.contains(DISPLAY);
    span.classList.remove(MATH);
    span.classList.add('jt-math-rendered');
    engine.render(tex, span, { displayMode, throwOnError: false });
  });
}
