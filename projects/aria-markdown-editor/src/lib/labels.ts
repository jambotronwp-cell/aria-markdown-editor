import { InjectionToken, Provider } from '@angular/core';

/** Every text the editor shows. English by default; an app passes its own with provideJtMdEditorLabels(). */
export interface JtMdEditorLabels {
  editor: string;
  toolbar: string;
  write: string;
  preview: string;
  heading: string;
  bold: string;
  italic: string;
  strike: string;
  code: string;
  link: string;
  quote: string;
  bullets: string;
  numbers: string;
  tasks: string;
  codeBlock: string;
  table: string;
  math: string;
  image: string;
  rule: string;
  /** Placeholders the toolbar inserts when nothing is selected */
  sampleText: string;
  sampleUrl: string;
  sampleImage: string;
  sampleCode: string;
  sampleFormula: string;
  sampleColumn: string;
  uploading: string;
  uploadFailed: string;
  emptyPreview: string;
}

export const JT_MD_EDITOR_DEFAULT_LABELS: JtMdEditorLabels = {
  editor: 'Markdown',
  toolbar: 'Formatting',
  write: 'Write',
  preview: 'Preview',
  heading: 'Heading',
  bold: 'Bold',
  italic: 'Italic',
  strike: 'Strikethrough',
  code: 'Code',
  link: 'Link',
  quote: 'Quote',
  bullets: 'Bulleted list',
  numbers: 'Numbered list',
  tasks: 'Task list',
  codeBlock: 'Code block',
  table: 'Table',
  math: 'Formula',
  image: 'Image',
  rule: 'Horizontal line',
  sampleText: 'text',
  sampleUrl: 'https://',
  sampleImage: 'image',
  sampleCode: 'code',
  sampleFormula: 'x^2',
  sampleColumn: 'Column',
  uploading: 'Uploading',
  uploadFailed: 'Upload failed',
  emptyPreview: 'Nothing to preview'
};

/**
 * Labels of the editor. A function is read on every change detection, so it may follow the app's current language:
 * provideJtMdEditorLabels(() => ({ bold: translate('editor.bold'), ... })).
 */
export const JT_MD_EDITOR_LABELS = new InjectionToken<() => JtMdEditorLabels>('JT_MD_EDITOR_LABELS', {
  providedIn: 'root',
  factory: () => () => JT_MD_EDITOR_DEFAULT_LABELS
});

export function provideJtMdEditorLabels(labels: Partial<JtMdEditorLabels> | (() => Partial<JtMdEditorLabels>)): Provider {
  const read = typeof labels === 'function' ? labels : () => labels;
  return { provide: JT_MD_EDITOR_LABELS, useValue: () => ({ ...JT_MD_EDITOR_DEFAULT_LABELS, ...read() }) };
}
