/**
 * Text commands of the editor — pure functions over (text, selection), no DOM: easy to test and to reuse
 * (e.g. a plain <textarea> elsewhere). Each returns one edit: replace [from, to) with `insert`, then select
 * [selectionStart, selectionEnd) in the new text.
 */
export interface JtMdState {
  text: string;
  start: number;
  end: number;
}

export interface JtMdEdit {
  from: number;
  to: number;
  insert: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Applies an edit to the text (what the textarea will contain after it). */
export function applyEdit(text: string, edit: JtMdEdit): string {
  return text.slice(0, edit.from) + edit.insert + text.slice(edit.to);
}

/**
 * **bold**, _italic_, `code`, ~~strike~~, $formula$: wraps the selection; an already wrapped selection is unwrapped;
 * nothing selected — inserts the placeholder and selects it.
 */
export function toggleWrap(state: JtMdState, before: string, after = before, placeholder = ''): JtMdEdit {
  const { text, start, end } = state;
  const selected = text.slice(start, end);
  // Markers outside the selection: **|text|**
  if (text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
    return { from: start - before.length, to: end + after.length, insert: selected,
      selectionStart: start - before.length, selectionEnd: end - before.length };
  }
  // Markers inside the selection: |**text**|
  if (selected.length >= before.length + after.length && selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length);
    return { from: start, to: end, insert: inner, selectionStart: start, selectionEnd: start + inner.length };
  }
  const inner = selected || placeholder;
  return { from: start, to: end, insert: before + inner + after,
    selectionStart: start + before.length, selectionEnd: start + before.length + inner.length };
}

/** Start and end of the whole lines the selection touches. */
function lineRange(text: string, start: number, end: number): { from: number; to: number } {
  const from = text.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends right after a line break does not take the next line
  const last = end > start && text.charAt(end - 1) === '\n' ? end - 1 : end;
  const next = text.indexOf('\n', last);
  return { from, to: next === -1 ? text.length : next };
}

export type JtMdLineKind = 'quote' | 'bullets' | 'numbers' | 'tasks';

const LINE_MARKERS: Record<JtMdLineKind, RegExp> = {
  quote: /^(\s*)> ?/,
  bullets: /^(\s*)[-*+] (?!\[[ xX]\] )/,
  numbers: /^(\s*)\d+[.)] /,
  tasks: /^(\s*)[-*+] \[[ xX]\] /
};

// Any list or quote marker — replaced when the line switches to another kind
const ANY_MARKER = /^(\s*)(?:> ?|[-*+] \[[ xX]\] |[-*+] |\d+[.)] )/;

function marker(kind: JtMdLineKind, index: number): string {
  switch (kind) {
    case 'quote': return '> ';
    case 'bullets': return '- ';
    case 'numbers': return `${index + 1}. `;
    case 'tasks': return '- [ ] ';
  }
}

/**
 * Quote / bulleted / numbered / task list on every selected line. All lines already of that kind — markers are
 * removed; otherwise each line gets the marker (a marker of another kind is replaced). Empty lines are kept as they are.
 */
export function toggleLines(state: JtMdState, kind: JtMdLineKind): JtMdEdit {
  const { from, to } = lineRange(state.text, state.start, state.end);
  const lines = state.text.slice(from, to).split('\n');
  const filled = lines.filter(line => line.trim() !== '');
  const remove = filled.length > 0 && filled.every(line => LINE_MARKERS[kind].test(line));
  let index = 0;
  const changed = lines.map(line => {
    if (remove) {
      return line.replace(LINE_MARKERS[kind], '$1');
    }
    if (line.trim() === '' && lines.length > 1) {
      return line;
    }
    const match = line.match(ANY_MARKER);
    const indent = match ? match[1] : (line.match(/^\s*/)?.[0] ?? '');
    const rest = match ? line.slice(match[0].length) : line.slice(indent.length);
    return indent + marker(kind, index++) + rest;
  });
  const insert = changed.join('\n');
  // One empty line: caret after the marker; otherwise — the whole block selected
  if (lines.length === 1 && state.start === state.end) {
    const shift = insert.length - lines[0].length;
    const caret = Math.max(from, state.start + shift);
    return { from, to, insert, selectionStart: caret, selectionEnd: caret };
  }
  return { from, to, insert, selectionStart: from, selectionEnd: from + insert.length };
}

/** Heading of the current line: none → # → ## → ### → none. */
export function cycleHeading(state: JtMdState): JtMdEdit {
  const { from, to } = lineRange(state.text, state.start, state.start);
  const line = state.text.slice(from, to);
  const match = line.match(/^(#{1,6}) /);
  const level = match ? match[1].length : 0;
  const content = match ? line.slice(match[0].length) : line;
  const prefix = level >= 3 ? '' : '#'.repeat(level + 1) + ' ';
  const insert = prefix + content;
  const caret = Math.max(from + prefix.length, state.start + insert.length - line.length);
  return { from, to, insert, selectionStart: caret, selectionEnd: caret };
}

const URL_LIKE = /^(https?:\/\/|mailto:|\/)\S*$/;

/** [text](url): selected text → the url is selected; a selected URL → the text is selected. */
export function insertLink(state: JtMdState, sampleText: string, sampleUrl: string): JtMdEdit {
  const selected = state.text.slice(state.start, state.end);
  if (URL_LIKE.test(selected)) {
    const insert = `[${sampleText}](${selected})`;
    return { from: state.start, to: state.end, insert, selectionStart: state.start + 1, selectionEnd: state.start + 1 + sampleText.length };
  }
  const label = selected || sampleText;
  const insert = `[${label}](${sampleUrl})`;
  const urlStart = state.start + label.length + 3;
  return { from: state.start, to: state.end, insert,
    selectionStart: selected ? urlStart : state.start + 1,
    selectionEnd: selected ? urlStart + sampleUrl.length : state.start + 1 + label.length };
}

/** Line break(s) needed so that `insert` at [start, end) stands as its own block. */
function blockPadding(text: string, start: number, end: number): { before: string; after: string } {
  const head = text.slice(0, start);
  const tail = text.slice(end);
  const before = head === '' || head.endsWith('\n\n') ? '' : head.endsWith('\n') ? '\n' : '\n\n';
  const after = tail === '' || tail.startsWith('\n\n') ? '' : tail.startsWith('\n') ? '\n' : '\n\n';
  return { before, after };
}

/** A block (code, table, image, line, formula) on its own lines; `select` — a part of the block to select. */
export function insertBlock(state: JtMdState, block: string, select?: { start: number; end: number }): JtMdEdit {
  const { before, after } = blockPadding(state.text, state.start, state.end);
  const insert = before + block + after;
  const base = state.start + before.length;
  const selectionStart = select ? base + select.start : base + block.length;
  const selectionEnd = select ? base + select.end : selectionStart;
  return { from: state.start, to: state.end, insert, selectionStart, selectionEnd };
}

/** ``` fenced code: the selection goes inside; nothing selected — the placeholder, selected. */
export function insertCodeBlock(state: JtMdState, placeholder: string): JtMdEdit {
  const code = state.text.slice(state.start, state.end).replace(/\n$/, '') || placeholder;
  return insertBlock(state, '```\n' + code + '\n```', { start: 4, end: 4 + code.length });
}

/** $$ display formula when the selection spans lines, $inline$ otherwise. */
export function insertMath(state: JtMdState, placeholder: string): JtMdEdit {
  const selected = state.text.slice(state.start, state.end);
  if (selected.includes('\n')) {
    const tex = selected.replace(/\n$/, '');
    return insertBlock(state, '$$\n' + tex + '\n$$', { start: 3, end: 3 + tex.length });
  }
  return toggleWrap(state, '$', '$', placeholder);
}

/** Table 2 × 2 with the first header cell selected. */
export function insertTable(state: JtMdState, column: string): JtMdEdit {
  const header = `| ${column} 1 | ${column} 2 |`;
  const block = `${header}\n| --- | --- |\n|  |  |\n|  |  |`;
  return insertBlock(state, block, { start: 2, end: 2 + column.length + 2 });
}

/** Horizontal line. */
export function insertRule(state: JtMdState): JtMdEdit {
  return insertBlock(state, '---');
}

/** ![alt](url) as its own block; `alt` is selected — to be described. */
export function insertImage(state: JtMdState, url: string, alt: string): JtMdEdit {
  return insertBlock(state, `![${alt}](${url})`, { start: 2, end: 2 + alt.length });
}

/**
 * Enter inside a list: the next item gets the same marker (numbers +1, tasks unchecked); Enter on an empty item ends
 * the list (removes the marker). null — not a list, a selection or the caret before the marker: the textarea's own Enter.
 */
export function continueList(state: JtMdState): JtMdEdit | null {
  if (state.start !== state.end) {
    return null;
  }
  const from = state.text.lastIndexOf('\n', state.start - 1) + 1;
  const lineEnd = state.text.indexOf('\n', state.start);
  const line = state.text.slice(from, lineEnd === -1 ? state.text.length : lineEnd);
  const match = line.match(/^(\s*)(?:([-*+]) \[[ xX]\] |([-*+]) |(\d+)([.)]) |> ?)/);
  if (!match || state.start - from < match[0].length) {
    return null;
  }
  if (line.slice(match[0].length).trim() === '' && state.start === from + line.length) {
    // Empty item → end of the list
    return { from, to: from + line.length, insert: '', selectionStart: from, selectionEnd: from };
  }
  const [, indent, taskBullet, bullet, number, delimiter] = match;
  const next = taskBullet ? `${taskBullet} [ ] `
    : bullet ? `${bullet} `
    : number ? `${Number(number) + 1}${delimiter} `
    : '> ';
  const insert = '\n' + indent + next;
  const caret = state.start + insert.length;
  return { from: state.start, to: state.end, insert, selectionStart: caret, selectionEnd: caret };
}
