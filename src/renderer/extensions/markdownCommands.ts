import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'

// ─── Helpers ─────────────────────────────────────────────

/** Wrap/unwrap selection with inline markers (e.g. ** for bold, * for italic) */
function toggleInlineWrap(view: EditorView, marker: string): boolean {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []
  const selections: { anchor: number; head: number }[] = []

  for (const range of state.selection.ranges) {
    const selected = state.sliceDoc(range.from, range.to)
    const len = marker.length

    // Check if already wrapped: look at surrounding text
    const before = state.sliceDoc(
      Math.max(0, range.from - len),
      range.from
    )
    const after = state.sliceDoc(range.to, range.to + len)

    if (before === marker && after === marker) {
      // Unwrap: remove markers around selection
      changes.push({ from: range.from - len, to: range.from, insert: '' })
      changes.push({ from: range.to, to: range.to + len, insert: '' })
      selections.push({
        anchor: range.from - len,
        head: range.to - len
      })
    } else if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length >= len * 2
    ) {
      // Selection includes markers: remove them
      changes.push({
        from: range.from,
        to: range.to,
        insert: selected.slice(len, -len)
      })
      selections.push({
        anchor: range.from,
        head: range.to - len * 2
      })
    } else if (range.from === range.to) {
      // No selection: insert markers and place cursor between
      const placeholder = marker + marker
      changes.push({ from: range.from, to: range.to, insert: placeholder })
      selections.push({
        anchor: range.from + len,
        head: range.from + len
      })
    } else {
      // Wrap selection
      changes.push({
        from: range.from,
        to: range.to,
        insert: marker + selected + marker
      })
      selections.push({
        anchor: range.from + len,
        head: range.to + len
      })
    }
  }

  view.dispatch({
    changes,
    selection: EditorSelection.create(
      selections.map((s) => EditorSelection.range(s.anchor, s.head))
    )
  })
  return true
}

/** Prefix/unprefix each line with a block marker (e.g. "> " for blockquote) */
function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []

  // Gather all lines in the selection
  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum)
      if (line.text.startsWith(prefix)) {
        // Remove prefix
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
      } else {
        // Add prefix
        changes.push({ from: line.from, to: line.from, insert: prefix })
      }
    }
  }

  view.dispatch({ changes })
  return true
}

/** Set heading level (replaces any existing heading prefix) */
function setHeadingLevel(view: EditorView, level: number): boolean {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []
  const newPrefix = '#'.repeat(level) + ' '

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.from)
    const match = line.text.match(/^(#{1,6})\s/)

    if (match) {
      const existingPrefix = match[0]
      if (existingPrefix === newPrefix) {
        // Same level: remove heading
        changes.push({ from: line.from, to: line.from + existingPrefix.length, insert: '' })
      } else {
        // Different level: replace
        changes.push({ from: line.from, to: line.from + existingPrefix.length, insert: newPrefix })
      }
    } else {
      // Add heading prefix
      changes.push({ from: line.from, to: line.from, insert: newPrefix })
    }
  }

  view.dispatch({ changes })
  return true
}

/** Toggle bullet list (- ) on each selected line */
function toggleBulletList(view: EditorView): boolean {
  return toggleLinePrefix(view, '- ')
}

/** Toggle ordered list (1. 2. 3. ...) on each selected line */
function toggleOrderedList(view: EditorView): boolean {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []

  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)
    let counter = 1

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum)
      const match = line.text.match(/^(\d+)\.\s/)

      if (match) {
        // Remove ordered list prefix
        changes.push({ from: line.from, to: line.from + match[0].length, insert: '' })
      } else {
        // Add ordered list prefix
        changes.push({ from: line.from, to: line.from, insert: `${counter}. ` })
      }
      counter++
    }
  }

  view.dispatch({ changes })
  return true
}

/** Toggle task list (- [ ] ) on each selected line */
function toggleTaskList(view: EditorView): boolean {
  const { state } = view
  const changes: { from: number; to: number; insert: string }[] = []

  for (const range of state.selection.ranges) {
    const fromLine = state.doc.lineAt(range.from)
    const toLine = state.doc.lineAt(range.to)

    for (let lineNum = fromLine.number; lineNum <= toLine.number; lineNum++) {
      const line = state.doc.line(lineNum)

      if (line.text.match(/^- \[[ xX]\] /)) {
        // Remove task prefix
        const prefixLen = line.text.match(/^- \[[ xX]\] /)![0].length
        changes.push({ from: line.from, to: line.from + prefixLen, insert: '' })
      } else if (line.text.startsWith('- ')) {
        // Convert bullet to task
        changes.push({ from: line.from + 2, to: line.from + 2, insert: '[ ] ' })
      } else {
        // Add full task prefix
        changes.push({ from: line.from, to: line.from, insert: '- [ ] ' })
      }
    }
  }

  view.dispatch({ changes })
  return true
}

/** Insert or wrap a link [text](url) */
function insertLink(view: EditorView): boolean {
  const { state } = view
  const range = state.selection.main
  const selected = state.sliceDoc(range.from, range.to)

  if (selected) {
    // Wrap selection as link text
    const insert = `[${selected}](url)`
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      // Select the "url" placeholder
      selection: EditorSelection.cursor(range.from + selected.length + 3)
    })
  } else {
    // Insert empty link template
    const insert = '[](url)'
    view.dispatch({
      changes: { from: range.from, to: range.to, insert },
      selection: EditorSelection.cursor(range.from + 1) // cursor inside []
    })
  }
  return true
}

/** Insert a horizontal rule */
function insertHorizontalRule(view: EditorView): boolean {
  const { state } = view
  const line = state.doc.lineAt(state.selection.main.head)
  const insert = line.text.length > 0 ? '\n---\n' : '---\n'
  view.dispatch({
    changes: { from: line.to, to: line.to, insert }
  })
  return true
}

// ─── Exported Commands ──────────────────────────────────

export const markdownCommands = {
  toggleBold: (view: EditorView) => toggleInlineWrap(view, '**'),
  toggleItalic: (view: EditorView) => toggleInlineWrap(view, '*'),
  toggleStrikethrough: (view: EditorView) => toggleInlineWrap(view, '~~'),
  toggleInlineCode: (view: EditorView) => toggleInlineWrap(view, '`'),
  toggleBlockquote: (view: EditorView) => toggleLinePrefix(view, '> '),
  toggleBulletList,
  toggleOrderedList,
  toggleTaskList,
  insertLink,
  insertHorizontalRule,
  heading1: (view: EditorView) => setHeadingLevel(view, 1),
  heading2: (view: EditorView) => setHeadingLevel(view, 2),
  heading3: (view: EditorView) => setHeadingLevel(view, 3),
  heading4: (view: EditorView) => setHeadingLevel(view, 4),
  heading5: (view: EditorView) => setHeadingLevel(view, 5),
  heading6: (view: EditorView) => setHeadingLevel(view, 6),
}
