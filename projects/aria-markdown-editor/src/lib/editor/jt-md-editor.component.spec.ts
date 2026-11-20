import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { JtMdEditorComponent } from './jt-md-editor.component';

@Component({
  imports: [JtMdEditorComponent, ReactiveFormsModule],
  template: `<jt-md-editor [formControl]="control" layout="split" [uploadImage]="upload()" />`
})
class HostComponent {
  readonly control = new FormControl('hello', { nonNullable: true });
  readonly upload = signal<((file: File) => Promise<string>) | null>(null);
}

describe('JtMdEditorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  const textarea = () => fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
  const button = (tool: string) => fixture.nativeElement.querySelector(`button[data-tool="${tool}"]`) as HTMLButtonElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the form value and the preview', () => {
    expect(textarea().value).toBe('hello');
    expect(fixture.nativeElement.querySelector('jt-md-preview')?.textContent).toContain('hello');
  });

  it('reports typing to the form', () => {
    textarea().value = 'hello world';
    textarea().dispatchEvent(new Event('input'));
    expect(host.control.value).toBe('hello world');
  });

  it('applies toolbar commands to the selection', () => {
    textarea().setSelectionRange(0, 5);
    button('bold').click();
    expect(host.control.value).toBe('**hello**');
    expect(textarea().value).toBe('**hello**');
  });

  it('runs hotkeys and continues lists on Enter', () => {
    host.control.setValue('- one');
    fixture.detectChanges();
    textarea().setSelectionRange(5, 5);
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    expect(host.control.value).toBe('- one\n- ');

    textarea().setSelectionRange(2, 5);
    textarea().dispatchEvent(new KeyboardEvent('keydown', { key: 'i', ctrlKey: true, cancelable: true }));
    expect(host.control.value).toBe('- _one_\n- ');
  });

  it('follows the disabled state of the form', () => {
    host.control.disable();
    fixture.detectChanges();
    expect(textarea().disabled).toBe(true);
  });

  it('uploads a pasted image and replaces the placeholder', async () => {
    let finish!: (url: string) => void;
    host.upload.set(() => new Promise<string>(resolve => finish = resolve));
    fixture.detectChanges();
    textarea().setSelectionRange(5, 5);

    const file = new File(['png'], 'cat.png', { type: 'image/png' });
    const paste = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(paste, 'clipboardData', { value: { files: [file], types: ['Files'] } });
    textarea().dispatchEvent(paste);
    expect(host.control.value).toContain('![Uploading cat.png…]()');

    finish('https://img/cat.png');
    await fixture.whenStable();
    await new Promise(resolve => setTimeout(resolve));
    expect(host.control.value).toBe('hello\n\n![cat](https://img/cat.png)');
  });
});

@Component({
  imports: [JtMdEditorComponent, FormField],
  template: `<jt-md-editor [formField]="form.body" layout="tabs" />`
})
class SignalHostComponent {
  readonly model = signal({ body: '# Title' });
  readonly form = form(this.model);
}

describe('JtMdEditorComponent with Signal Forms', () => {
  it('binds [formField] both ways and shows tabs', async () => {
    const fixture = TestBed.createComponent(SignalHostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;

    expect(element.querySelectorAll('[role="tab"]').length).toBe(2);
    // the hidden Preview panel takes no space
    const hidden = element.querySelector<HTMLElement>('[role="tabpanel"][inert]');
    expect(hidden).not.toBeNull();
    expect(getComputedStyle(hidden!).display).toBe('none');
    expect(textarea.value).toBe('# Title');

    textarea.value = '# Other';
    textarea.dispatchEvent(new Event('input'));
    expect(fixture.componentInstance.model().body).toBe('# Other');
  });
});
