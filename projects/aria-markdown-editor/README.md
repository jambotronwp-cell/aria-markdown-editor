# @jambotron/aria-markdown-editor

Markdown editor for Angular, built on [Angular Aria](https://angular.dev/guide/aria/overview):

- source and live preview side by side; **Write / Preview tabs** on narrow screens (`ngTabs`)
- toolbar (`ngToolbar`, one Tab stop, arrow keys inside): heading, bold, italic, strikethrough, link, image, code,
  code block, quote, bulleted / numbered / task lists, table, formula, horizontal line
- hotkeys Ctrl/⌘ + B, I, K, E; Enter continues a list, Enter on an empty item ends it; Ctrl+Z works (edits go
  through the browser's undo)
- formulas `$…$` and `$$…$$` with **KaTeX loaded lazily** — not in your main bundle
- images: paste, drop or choose a file → your upload function → `![alt](url)`; or your own picker dialog
- forms: `[(value)]`, Signal Forms `[formField]`, `formControl`, `ngModel` (ControlValueAccessor)
- GitHub-flavoured Markdown (tables, task lists, strikethrough), HTML through Angular's sanitizer, SSR-safe
- `<jt-md-preview>` — the same rendering for read-only pages

## Install

```bash
npm install @jambotron/aria-markdown-editor @jambotron/aria-components marked katex
```

Peer dependencies: Angular 22 (`core`, `common`, `forms`), `@angular/aria`, `@jambotron/aria-components` (icons; its theme fits too), `marked` ≥ 16. `katex` — only for formulas.

## Use

```ts
// app.config.ts
providers: [
  provideJtMarkdown({ katex: () => import('katex').then(m => m.default) })
]
```

```scss
// styles.scss
@use '@jambotron/aria-markdown-editor/styles/aria-markdown-editor';
@use 'katex/dist/katex.min.css';
```

```ts
@Component({
  imports: [JtMdEditorComponent, JtMdPreviewComponent],
  template: `
    <jt-md-editor [(value)]="body" [uploadImage]="upload" placeholder="Write…" />
    <jt-md-preview [markdown]="body()" />
  `
})
export class ArticleEditor {
  readonly body = signal('');
  readonly upload = (file: File) => firstValueFrom(this.api.uploadImage(file)); // → url or { url, alt }
}
```

With Signal Forms: `<jt-md-editor [formField]="form.body" />`; reactive forms: `[formControl]`.

### Inputs of `jt-md-editor`

| Input | Default | |
| --- | --- | --- |
| `value` (model) | `''` | the Markdown text |
| `placeholder` | `''` | |
| `disabled`, `readonly` | `false` | readonly hides the toolbar |
| `label` | labels.editor | `aria-label` of the text area |
| `layout` | `'auto'` | `'split'`, `'tabs'`, or `'auto'` — tabs when the editor is narrower than 720px |
| `tools` | all | toolbar buttons in order, `'\|'` — separator |
| `uploadImage` | `null` | `(file: File) => Promise<string \| { url, alt? }>`; without it pasted / dropped files are ignored |
| `pickImage` | `null` | `() => Promise<{ url, alt? } \| null>` — the image button opens your dialog |

Height: CSS variable `--jt-md-editor-height` (420px).

### Markdown settings

`provideJtMarkdown({ katex, math, breaks, extensions })` — KaTeX loader, formulas on/off, single line breaks as
`<br>`, extra [marked extensions](https://marked.js.org/using_pro).

Text commands are exported as pure functions (`toggleWrap`, `toggleLines`, `insertLink`, `continueList`, …) —
usable with any `<textarea>`.

## Labels

English by default. Any language — a function, read on every change detection:

```ts
providers: [provideJtMdEditorLabels(() => ({ write: t('editor.write'), preview: t('editor.preview'), bold: t('editor.bold') }))]
```

## Theme

The same `--jt-*` tokens as `@jambotron/aria-grid` (defaults on `:where(:root)`, your values win), plus
`--jt-md-code-bg`, `--jt-md-hover-bg`, `--jt-md-editor-height`. See `styles/aria-markdown-editor.scss`.

## Develop

```bash
npm ci
npx ng test aria-markdown-editor --watch=false
npx ng serve playground                 # the editor on a page, library from source
npx ng build aria-markdown-editor       # → dist/aria-markdown-editor
cd dist/aria-markdown-editor && npm publish
```

License: [MIT](LICENSE) © Jambotron. Made for and deployed on [jambotron.com](https://jambotron.com).
