import {
  applyEdit, continueList, cycleHeading, insertCodeBlock, insertImage, insertLink, insertMath, insertTable,
  JtMdEdit, JtMdState, toggleLines, toggleWrap
} from './commands';

/** Text with the selection marked: "a[b]c" — b selected, "a|c" — caret. */
function state(marked: string): JtMdState {
  const caret = marked.indexOf('|');
  if (caret !== -1) {
    const text = marked.replace('|', '');
    return { text, start: caret, end: caret };
  }
  const start = marked.indexOf('[');
  const end = marked.indexOf(']') - 1;
  return { text: marked.replace('[', '').replace(']', ''), start, end };
}

/** Result with the new selection marked the same way. */
function result(before: JtMdState, edit: JtMdEdit): string {
  const text = applyEdit(before.text, edit);
  if (edit.selectionStart === edit.selectionEnd) {
    return text.slice(0, edit.selectionStart) + '|' + text.slice(edit.selectionStart);
  }
  return text.slice(0, edit.selectionStart) + '[' + text.slice(edit.selectionStart, edit.selectionEnd) + ']' + text.slice(edit.selectionEnd);
}

function run(marked: string, command: (s: JtMdState) => JtMdEdit | null): string | null {
  const before = state(marked);
  const edit = command(before);
  return edit ? result(before, edit) : null;
}

describe('commands', () => {
  it('wraps, unwraps and inserts a placeholder', () => {
    expect(run('say [hi] now', s => toggleWrap(s, '**', '**', 'text'))).toBe('say **[hi]** now');
    expect(run('say **[hi]** now', s => toggleWrap(s, '**', '**', 'text'))).toBe('say [hi] now');
    expect(run('say [**hi**] now', s => toggleWrap(s, '**', '**', 'text'))).toBe('say [hi] now');
    expect(run('say | now', s => toggleWrap(s, '_', '_', 'text'))).toBe('say _[text]_ now');
  });

  it('toggles list markers on every selected line', () => {
    expect(run('[one\ntwo]', s => toggleLines(s, 'bullets'))).toBe('[- one\n- two]');
    expect(run('[- one\n- two]', s => toggleLines(s, 'bullets'))).toBe('[one\ntwo]');
    expect(run('[- one\n- two]', s => toggleLines(s, 'numbers'))).toBe('[1. one\n2. two]');
    expect(run('[a\n\nb]', s => toggleLines(s, 'tasks'))).toBe('[- [ ] a\n\n- [ ] b]');
    expect(run('x|', s => toggleLines(s, 'quote'))).toBe('> x|');
    expect(run('|', s => toggleLines(s, 'bullets'))).toBe('- |');
  });

  it('cycles heading levels', () => {
    expect(run('Title|', cycleHeading)).toBe('# Title|');
    expect(run('# Title|', cycleHeading)).toBe('## Title|');
    expect(run('### Title|', cycleHeading)).toBe('Title|');
  });

  it('makes links from text or from a URL', () => {
    expect(run('[Jambotron]', s => insertLink(s, 'text', 'https://'))).toBe('[Jambotron]([https://])');
    expect(run('[https://jambotron.com]', s => insertLink(s, 'text', 'https://'))).toBe('[[text]](https://jambotron.com)');
  });

  it('puts blocks on their own lines', () => {
    expect(run('a|b', s => insertCodeBlock(s, 'code'))).toBe('a\n\n```\n[code]\n```\n\nb');
    expect(run('text\n|', s => insertTable(s, 'Column'))).toContain('\n\n| [Column 1] | Column 2 |');
    expect(run('|', s => insertImage(s, 'https://x/y.png', 'alt'))).toBe('![[alt]](https://x/y.png)');
  });

  it('uses $ for inline and $$ for multi-line formulas', () => {
    expect(run('|', s => insertMath(s, 'x^2'))).toBe('$[x^2]$');
    expect(run('[a\nb]', s => insertMath(s, 'x^2'))).toBe('$$\n[a\nb]\n$$');
  });

  it('continues and ends lists on Enter', () => {
    expect(run('- one|', continueList)).toBe('- one\n- |');
    expect(run('  3. three|', continueList)).toBe('  3. three\n  4. |');
    expect(run('- [x] done|', continueList)).toBe('- [x] done\n- [ ] |');
    expect(run('- one\n- |', continueList)).toBe('- one\n|');
    expect(run('plain|', continueList)).toBeNull();
  });
});
