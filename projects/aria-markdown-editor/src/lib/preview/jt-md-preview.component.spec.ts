import { TestBed } from '@angular/core/testing';
import { provideJtMarkdown } from '../config';
import { JtMdPreviewComponent } from './jt-md-preview.component';

describe('JtMdPreviewComponent', () => {
  const rendered: string[] = [];

  beforeEach(() => {
    rendered.length = 0;
    TestBed.configureTestingModule({
      providers: [provideJtMarkdown({
        katex: async () => ({ render: (tex, element) => { rendered.push(tex); element.textContent = 'K:' + tex; } })
      })]
    });
  });

  async function render(markdown: string): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(JtMdPreviewComponent);
    fixture.componentRef.setInput('markdown', markdown);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    return fixture.nativeElement as HTMLElement;
  }

  it('renders GFM: tables, task lists without inputs', async () => {
    const element = await render('| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] todo');
    expect(element.querySelector('table td')?.textContent).toBe('1');
    expect(element.querySelector('input')).toBeNull();
    expect(element.querySelectorAll('.jt-md-task').length).toBe(2);
    expect(element.querySelector('.jt-md-task--done')).not.toBeNull();
  });

  it('removes scripts and event handlers', async () => {
    const element = await render('<script>alert(1)</script><img src="x" onerror="alert(1)">');
    expect(element.querySelector('script')).toBeNull();
    expect(element.querySelector('img')?.getAttribute('onerror')).toBeNull();
  });

  it('draws formulas with the provided KaTeX', async () => {
    const element = await render('Energy $E=mc^2$ and\n\n$$\n\\frac{a}{b}\n$$');
    expect(rendered).toEqual(['E=mc^2', '\\frac{a}{b}']);
    expect(element.textContent).toContain('K:E=mc^2');
  });
});
