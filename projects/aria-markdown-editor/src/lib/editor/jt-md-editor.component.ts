import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, forwardRef, inject, input,
  model, signal, viewChild
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Tab, TabContent, TabList, TabPanel, Tabs } from '@angular/aria/tabs';
import { Toolbar, ToolbarWidget, ToolbarWidgetGroup } from '@angular/aria/toolbar';
import { NgTemplateOutlet } from '@angular/common';
import {
  applyEdit, continueList, cycleHeading, insertCodeBlock, insertImage, insertLink, insertMath, insertRule, insertTable,
  JtMdEdit, JtMdState, toggleLines, toggleWrap
} from '../commands';
import { JT_MD_EDITOR_LABELS, JtMdEditorLabels } from '../labels';
import { JtMdPreviewComponent } from '../preview/jt-md-preview.component';
import { JtIconComponent } from '@jambotron/aria-components';

/** A toolbar button; '|' — a separator between groups. */
export type JtMdTool =
  | 'heading' | 'bold' | 'italic' | 'strike' | 'code' | 'link'
  | 'quote' | 'bullets' | 'numbers' | 'tasks'
  | 'codeBlock' | 'table' | 'math' | 'image' | 'rule'
  | '|';

export const JT_MD_DEFAULT_TOOLS: JtMdTool[] = [
  'heading', 'bold', 'italic', 'strike', '|',
  'link', 'image', 'code', 'codeBlock', '|',
  'quote', 'bullets', 'numbers', 'tasks', '|',
  'table', 'math', 'rule'
];

/** An image for the text: `url` goes into ![alt](url). */
export interface JtMdImage {
  url: string;
  alt?: string;
}

/** Split — source and preview side by side; tabs — Write / Preview (phones); auto — tabs when narrower than 720px. */
export type JtMdLayout = 'auto' | 'split' | 'tabs';

type ToolName = Exclude<JtMdTool, '|'>;

const HOTKEYS: Record<string, ToolName> = { b: 'bold', i: 'italic', k: 'link', e: 'code' };
const HOTKEY_HINT: Partial<Record<ToolName, string>> = { bold: 'B', italic: 'I', link: 'K', code: 'E' };
const NARROW = 720;

/** Toolbar button → icon of @jambotron/aria-components */
const ICONS: Record<ToolName, string> = {
  heading: 'title', bold: 'format_bold', italic: 'format_italic', strike: 'format_strikethrough', code: 'code',
  link: 'link', quote: 'format_quote', bullets: 'format_list_bulleted', numbers: 'format_list_numbered',
  tasks: 'checklist', codeBlock: 'code_blocks', table: 'table', math: 'functions', image: 'image', rule: 'horizontal_rule'
};

/**
 * Markdown editor on Angular Aria: source and preview side by side, a toolbar (`ngToolbar`, arrow keys inside),
 * Write / Preview tabs (`ngTabs`) on narrow screens, formulas, image paste / drop / upload, hotkeys (Ctrl/⌘ + B, I,
 * K, E), Enter continues lists. The value — model() and a ControlValueAccessor: [(value)], [formField] (Signal
 * Forms), formControl, ngModel.
 *
 * <jt-md-editor [(value)]="body" [uploadImage]="upload" />
 */
@Component({
  selector: 'jt-md-editor',
  imports: [NgTemplateOutlet, Tabs, TabList, Tab, TabPanel, TabContent, Toolbar, ToolbarWidget, ToolbarWidgetGroup, JtMdPreviewComponent,
    JtIconComponent],
  templateUrl: './jt-md-editor.component.html',
  styleUrl: './jt-md-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => JtMdEditorComponent), multi: true }],
  host: {
    'class': 'jt-md-editor',
    '[class.jt-md-editor--tabs]': 'tabbed()',
    '[class.jt-md-editor--disabled]': 'isDisabled()',
    '[class.jt-md-editor--dragging]': 'dragging()'
  }
})
export class JtMdEditorComponent implements ControlValueAccessor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly readLabels = inject(JT_MD_EDITOR_LABELS);
  private readonly destroyRef = inject(DestroyRef);

  readonly value = model('');
  readonly placeholder = input('');
  readonly disabled = input(false);
  readonly readonly = input(false);
  /** aria-label of the text area; default — labels.editor */
  readonly label = input('');
  readonly tools = input<JtMdTool[]>(JT_MD_DEFAULT_TOOLS);
  readonly layout = input<JtMdLayout>('auto');
  /** Uploads a pasted / dropped / chosen image file and returns its address. Without it files are not accepted. */
  readonly uploadImage = input<((file: File) => Promise<JtMdImage | string>) | null>(null);
  /** The image button opens the app's own picker (e.g. a gallery dialog); null — cancelled. */
  readonly pickImage = input<(() => Promise<JtMdImage | null>) | null>(null);

  protected readonly labels = computed<JtMdEditorLabels>(() => this.readLabels());
  protected readonly textarea = viewChild<ElementRef<HTMLTextAreaElement>>('textarea');
  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');

  private readonly formDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());
  protected readonly locked = computed(() => this.isDisabled() || this.readonly());

  private readonly width = signal(Number.POSITIVE_INFINITY);
  protected readonly tabbed = computed(() => this.layout() === 'tabs' || (this.layout() === 'auto' && this.width() < NARROW));
  protected readonly tab = signal<string | undefined>('write');
  protected readonly dragging = signal(false);
  protected readonly uploads = signal(0);
  protected readonly error = signal('');

  protected readonly groups = computed<ToolName[][]>(() => {
    const groups: ToolName[][] = [[]];
    for (const tool of this.tools()) {
      if (tool === '|') {
        groups.push([]);
      } else {
        groups[groups.length - 1].push(tool);
      }
    }
    return groups.filter(group => group.length > 0);
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  constructor() {
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(entries => this.width.set(entries[0].contentRect.width));
      observer.observe(this.host.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  // ControlValueAccessor
  writeValue(value: string | null | undefined): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.formDisabled.set(disabled);
  }

  protected icon(tool: ToolName): string {
    return ICONS[tool];
  }

  protected title(tool: ToolName): string {
    const key = HOTKEY_HINT[tool];
    const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');
    return this.labels()[tool] + (key ? ` (${mac ? '⌘' : 'Ctrl+'}${key})` : '');
  }

  protected onInput(event: Event): void {
    this.commit((event.target as HTMLTextAreaElement).value);
  }

  protected onBlur(): void {
    this.onTouched();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (this.locked() || event.isComposing) {
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (mod && !event.altKey && !event.shiftKey) {
      const tool = HOTKEYS[event.key.toLowerCase()];
      if (tool) {
        event.preventDefault();
        this.run(tool);
      }
      return;
    }
    if (event.key === 'Enter' && !mod && !event.shiftKey && !event.altKey) {
      const edit = continueList(this.state());
      if (edit) {
        event.preventDefault();
        this.apply(edit);
      }
    }
  }

  /** A toolbar button or a hotkey. */
  run(tool: ToolName): void {
    if (this.locked()) {
      return;
    }
    const labels = this.labels();
    const state = this.state();
    switch (tool) {
      case 'heading': return this.apply(cycleHeading(state));
      case 'bold': return this.apply(toggleWrap(state, '**', '**', labels.sampleText));
      case 'italic': return this.apply(toggleWrap(state, '_', '_', labels.sampleText));
      case 'strike': return this.apply(toggleWrap(state, '~~', '~~', labels.sampleText));
      case 'code': return this.apply(toggleWrap(state, '`', '`', labels.sampleCode));
      case 'link': return this.apply(insertLink(state, labels.sampleText, labels.sampleUrl));
      case 'quote':
      case 'bullets':
      case 'numbers':
      case 'tasks': return this.apply(toggleLines(state, tool));
      case 'codeBlock': return this.apply(insertCodeBlock(state, labels.sampleCode));
      case 'table': return this.apply(insertTable(state, labels.sampleColumn));
      case 'math': return this.apply(insertMath(state, labels.sampleFormula));
      case 'rule': return this.apply(insertRule(state));
      case 'image': return void this.chooseImage();
    }
  }

  private async chooseImage(): Promise<void> {
    const pick = this.pickImage();
    if (pick) {
      const image = await pick();
      if (image) {
        this.apply(insertImage(this.state(), image.url, image.alt ?? this.labels().sampleImage));
      }
      return;
    }
    if (this.uploadImage()) {
      this.fileInput()?.nativeElement.click();
      return;
    }
    // No picker, no upload: a template to fill in, the address selected
    const alt = this.labels().sampleImage;
    const url = this.labels().sampleUrl;
    const edit = insertImage(this.state(), url, alt);
    const urlStart = edit.selectionStart + alt.length + 2;
    this.apply({ ...edit, selectionStart: urlStart, selectionEnd: urlStart + url.length });
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    void this.uploadFiles(files);
  }

  protected onPaste(event: ClipboardEvent): void {
    const files = this.imageFiles(event.clipboardData);
    if (files.length && this.uploadImage() && !this.locked()) {
      event.preventDefault();
      void this.uploadFiles(files);
    }
  }

  protected onDragOver(event: DragEvent): void {
    if (this.uploadImage() && !this.locked() && Array.from(event.dataTransfer?.types ?? []).includes('Files')) {
      event.preventDefault();
      this.dragging.set(true);
    }
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    this.dragging.set(false);
    const files = this.imageFiles(event.dataTransfer);
    if (files.length && this.uploadImage() && !this.locked()) {
      event.preventDefault();
      void this.uploadFiles(files);
    }
  }

  private imageFiles(data: DataTransfer | null): File[] {
    return Array.from(data?.files ?? []).filter(file => file.type.startsWith('image/'));
  }

  /**
   * Each file: a placeholder ![Uploading name…]() at the caret at once, replaced with the image when the upload is
   * done (the user keeps typing meanwhile); a failed upload removes the placeholder and shows the error.
   */
  private async uploadFiles(files: File[]): Promise<void> {
    const upload = this.uploadImage();
    if (!upload) {
      return;
    }
    this.error.set('');
    for (const file of files) {
      const marker = `![${this.labels().uploading} ${file.name}…]()`;
      this.apply(insertImage(this.state(), '', `${this.labels().uploading} ${file.name}…`));
      this.uploads.update(count => count + 1);
      try {
        const result = await upload(file);
        const image = typeof result === 'string' ? { url: result } : result;
        this.replaceMarker(marker, `![${image.alt ?? file.name.replace(/\.[^.]+$/, '')}](${image.url})`);
      } catch {
        this.replaceMarker(marker, '');
        this.error.set(`${this.labels().uploadFailed}: ${file.name}`);
      } finally {
        this.uploads.update(count => count - 1);
      }
    }
  }

  private replaceMarker(marker: string, insert: string): void {
    const text = this.value();
    const from = text.indexOf(marker);
    if (from === -1) {
      return;
    }
    const to = from + marker.length;
    const element = this.textarea()?.nativeElement;
    const caret = element ? element.selectionStart : text.length;
    const shift = insert.length - marker.length;
    const next = caret >= to ? caret + shift : caret > from ? from + insert.length : caret;
    this.apply({ from, to, insert, selectionStart: next, selectionEnd: next }, false);
  }

  private state(): JtMdState {
    const element = this.textarea()?.nativeElement;
    const text = this.value();
    if (!element) {
      return { text, start: text.length, end: text.length };
    }
    return { text, start: element.selectionStart, end: element.selectionEnd };
  }

  /**
   * Applies an edit in the textarea. execCommand('insertText') keeps the browser's undo (Ctrl+Z) working; where it is
   * missing (tests, old browsers) — setRangeText.
   */
  private apply(edit: JtMdEdit, focus = true): void {
    const expected = applyEdit(this.value(), edit);
    const element = this.textarea()?.nativeElement;
    if (!element) {
      this.commit(expected);
      return;
    }
    if (focus) {
      element.focus();
    }
    element.setSelectionRange(edit.from, edit.to);
    let done = false;
    if (focus && typeof document !== 'undefined' && typeof document.execCommand === 'function') {
      try {
        done = edit.insert === '' && edit.from === edit.to ? true
          : document.execCommand(edit.insert === '' ? 'delete' : 'insertText', false, edit.insert);
      } catch {
        done = false;
      }
    }
    if (!done || element.value !== expected) {
      element.value = expected;
    }
    element.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    this.commit(expected);
  }

  private commit(text: string): void {
    if (text === this.value()) {
      return;
    }
    this.value.set(text);
    this.onChange(text);
  }

  /** Focus the text area (e.g. after the form opens). */
  focus(): void {
    this.textarea()?.nativeElement.focus();
  }
}
