import {
  afterRenderEffect, ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, PLATFORM_ID,
  ViewEncapsulation
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { JT_MARKDOWN_CONFIG } from '../config';
import { renderMath } from '../math';
import { JtMarkdownRenderer } from '../renderer';

/**
 * Rendered Markdown: GFM, tables, task lists, formulas (KaTeX, lazy). The HTML goes through Angular's sanitizer.
 * Works in SSR (formulas are drawn by the browser after hydration).
 *
 * <jt-md-preview [markdown]="article.body" />
 */
@Component({
  selector: 'jt-md-preview',
  template: '',
  styleUrl: './jt-md-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    'class': 'jt-md-preview',
    '[innerHTML]': 'html()'
  }
})
export class JtMdPreviewComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(JtMarkdownRenderer);
  private readonly config = inject(JT_MARKDOWN_CONFIG);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly markdown = input<string | null | undefined>('');

  protected readonly html = computed(() => this.renderer.render(this.markdown() ?? ''));

  constructor() {
    afterRenderEffect(() => {
      this.html();
      if (this.browser) {
        void renderMath(this.element.nativeElement, this.config.katex);
      }
    });
  }
}
