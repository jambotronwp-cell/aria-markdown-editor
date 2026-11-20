import { Component, signal } from '@angular/core';
import { JtMdEditorComponent } from '@jambotron/aria-markdown-editor';

const SAMPLE = `# Aria Markdown Editor

Write **Markdown** on the left, see the _result_ on the right.

- [x] Toolbar on Angular Aria
- [ ] Your next idea

| Feature | Status |
| --- | --- |
| Formulas | $E = mc^2$ |
| Tables | ✓ |

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

> Built for [Jambotron](https://jambotron.com).

\`\`\`ts
const editor = 'jt-md-editor';
\`\`\`
`;

@Component({
  selector: 'app-root',
  imports: [JtMdEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly body = signal(SAMPLE);
  protected readonly upload = (file: File) =>
    new Promise<string>(resolve => setTimeout(() => resolve(URL.createObjectURL(file)), 800));
}
