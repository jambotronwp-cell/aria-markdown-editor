import { inject, Injectable } from '@angular/core';
import { Marked, type MarkedExtension } from 'marked';
import { JT_MARKDOWN_CONFIG } from './config';
import { markdownMathExtension } from './math';

/**
 * Task list items without <input>: Angular's sanitizer removes inputs, and a checkbox in a preview is not clickable
 * anyway — a glyph with role="img" says the same.
 */
function taskExtension(): MarkedExtension {
  return {
    renderer: {
      checkbox({ checked }) {
        return `<span class="jt-md-task${checked ? ' jt-md-task--done' : ''}" role="img" aria-label="${checked ? '[x]' : '[ ]'}">${checked ? '☑' : '☐'}</span> `;
      }
    }
  };
}

/** Markdown → HTML (not sanitized yet — bind it with [innerHTML], Angular sanitizes). One per app. */
@Injectable({ providedIn: 'root' })
export class JtMarkdownRenderer {
  private readonly config = inject(JT_MARKDOWN_CONFIG);
  private readonly marked = new Marked(
    { gfm: true, breaks: this.config.breaks ?? false },
    taskExtension(),
    ...(this.config.math === false ? [] : [markdownMathExtension()]),
    ...(this.config.extensions ?? [])
  );

  render(markdown: string): string {
    return this.marked.parse(markdown ?? '', { async: false });
  }
}
