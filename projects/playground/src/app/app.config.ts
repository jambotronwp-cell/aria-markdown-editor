import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideJtMarkdown } from '@jambotron/aria-markdown-editor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideJtMarkdown({ katex: () => import('katex').then(m => m.default) })
  ]
};
