import { InjectionToken, Provider } from '@angular/core';
import type { MarkedExtension } from 'marked';

/** The part of KaTeX the editor uses: `import('katex').then(m => m.default)` fits. */
export interface JtKatex {
  render(tex: string, element: HTMLElement, options: { displayMode: boolean; throwOnError: boolean }): void;
}

export interface JtMarkdownConfig {
  /**
   * Loads KaTeX on the first formula: `() => import('katex').then(m => m.default)`. KaTeX stays out of the main
   * bundle — a lazy chunk. Without it formulas show as TeX source. The app adds KaTeX CSS (`katex/dist/katex.min.css`).
   */
  katex?: () => Promise<JtKatex>;
  /** Formulas `$…$` and `$$…$$`; on by default. */
  math?: boolean;
  /** Single line breaks become <br> (GitHub comments style); off by default — as in documents. */
  breaks?: boolean;
  /** Extra marked extensions (after the built-in ones). */
  extensions?: MarkedExtension[];
}

export const JT_MARKDOWN_CONFIG = new InjectionToken<JtMarkdownConfig>('JT_MARKDOWN_CONFIG', {
  providedIn: 'root',
  factory: () => ({})
});

/** provideJtMarkdown({ katex: () => import('katex').then(m => m.default) }) — in app.config.ts providers. */
export function provideJtMarkdown(config: JtMarkdownConfig): Provider {
  return { provide: JT_MARKDOWN_CONFIG, useValue: config };
}
