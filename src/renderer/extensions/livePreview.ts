import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
  WidgetType
} from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { Range } from '@codemirror/state'

// ─── Widgets ──────────────────────────────────────────────

class BulletWidget extends WidgetType {
  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-live-bullet'
    span.textContent = '\u2022'
    return span
  }
  eq() {
    return true
  }
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super()
  }
  toDOM() {
    const span = document.createElement('span')
    span.className = `cm-live-checkbox ${this.checked ? 'cm-live-checkbox-checked' : ''}`
    span.textContent = this.checked ? '\u2611' : '\u2610'
    return span
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked
  }
}

class HRWidget extends WidgetType {
  toDOM() {
    const div = document.createElement('div')
    div.className = 'cm-live-hr'
    return div
  }
  eq() {
    return true
  }
}

// ─── Helpers ──────────────────────────────────────────────

/** Check if the cursor falls within a given range */
function cursorInRange(head: number, from: number, to: number): boolean {
  return head >= from && head <= to
}

/** Get the range of the parent node, or null */
function parentRange(node: any): { from: number; to: number } | null {
  const p = node.node?.parent ?? node.parent
  if (!p) return null
  return { from: p.from, to: p.to }
}

// ─── Build Decorations ───────────────────────────────────

function buildDecorations(view: EditorView): DecorationSet {
  const decorations: Range<Decoration>[] = []
  const state = view.state
  const { head } = state.selection.main
  const tree = syntaxTree(state)

  tree.iterate({
    enter(node) {
      const { from, to, type } = node

      switch (type.name) {
        // ── Headings: hide # marks ──────────────────────
        case 'HeaderMark': {
          const pr = parentRange(node)
          if (pr && cursorInRange(head, pr.from, pr.to)) break
          // Hide # and the trailing space
          let end = to
          const lineText = state.doc.lineAt(from).text
          const lineStart = state.doc.lineAt(from).from
          const posAfterMark = end - lineStart
          if (lineText[posAfterMark] === ' ') end += 1
          decorations.push(Decoration.replace({}).range(from, end))
          break
        }

        // ── Bold / Italic: hide * _ marks ───────────────
        case 'EmphasisMark': {
          const pr = parentRange(node)
          if (pr && cursorInRange(head, pr.from, pr.to)) break
          decorations.push(Decoration.replace({}).range(from, to))
          break
        }

        // ── Strikethrough: hide ~~ marks ────────────────
        case 'StrikethroughMark': {
          const pr = parentRange(node)
          if (pr && cursorInRange(head, pr.from, pr.to)) break
          decorations.push(Decoration.replace({}).range(from, to))
          break
        }

        // ── Inline code: hide backtick marks ────────────
        case 'CodeMark': {
          const p = node.node?.parent ?? null
          if (!p) break
          // Only hide for InlineCode, not FencedCode
          if (p.type.name !== 'InlineCode') break
          if (cursorInRange(head, p.from, p.to)) break
          decorations.push(Decoration.replace({}).range(from, to))
          break
        }

        // ── Links: hide []() syntax, show text ──────────
        case 'Link': {
          if (cursorInRange(head, from, to)) return false

          // Walk children to find text region and URL region
          const linkNode = node.node
          let firstMarkEnd = -1   // end of opening [
          let secondMarkFrom = -1 // start of closing ]

          let child = linkNode.firstChild
          let markCount = 0
          while (child) {
            if (child.type.name === 'LinkMark') {
              markCount++
              if (markCount === 1) {
                firstMarkEnd = child.to // after [
              } else if (markCount === 2) {
                secondMarkFrom = child.from // before ]
              }
            }
            child = child.nextSibling
          }

          if (firstMarkEnd !== -1 && secondMarkFrom !== -1) {
            // Hide opening [
            decorations.push(Decoration.replace({}).range(from, firstMarkEnd))
            // Style the link text
            decorations.push(
              Decoration.mark({ class: 'cm-live-link' }).range(
                firstMarkEnd,
                secondMarkFrom
              )
            )
            // Hide ](url)
            decorations.push(Decoration.replace({}).range(secondMarkFrom, to))
          }
          return false // don't descend
        }

        // ── Images: hide ![]() syntax, show alt text ────
        case 'Image': {
          if (cursorInRange(head, from, to)) return false

          const imgNode = node.node
          let firstMarkEnd = -1
          let secondMarkFrom = -1

          let child = imgNode.firstChild
          let markCount = 0
          while (child) {
            if (child.type.name === 'LinkMark') {
              markCount++
              if (markCount === 1) {
                firstMarkEnd = child.to
              } else if (markCount === 2) {
                secondMarkFrom = child.from
              }
            }
            child = child.nextSibling
          }

          if (firstMarkEnd !== -1 && secondMarkFrom !== -1) {
            // Hide ![ (the ! is at from, [ is a LinkMark)
            decorations.push(Decoration.replace({}).range(from, firstMarkEnd))
            // Style alt text
            decorations.push(
              Decoration.mark({ class: 'cm-live-image-alt' }).range(
                firstMarkEnd,
                secondMarkFrom
              )
            )
            // Hide ](url)
            decorations.push(Decoration.replace({}).range(secondMarkFrom, to))
          }
          return false
        }

        // ── Blockquote marks: hide > ────────────────────
        case 'QuoteMark': {
          const line = state.doc.lineAt(from)
          if (cursorInRange(head, line.from, line.to)) break
          // Hide the > and trailing space
          let end = to
          const posAfter = to - line.from
          if (line.text[posAfter] === ' ') end += 1
          decorations.push(Decoration.replace({}).range(from, end))
          // Add blockquote line styling
          decorations.push(
            Decoration.line({ class: 'cm-live-blockquote-line' }).range(
              line.from
            )
          )
          break
        }

        // ── List markers: replace with bullet ───────────
        case 'ListMark': {
          const pr = parentRange(node)
          if (pr && cursorInRange(head, pr.from, pr.to)) break

          const markText = state.doc.sliceString(from, to).trim()
          if (/^[-*+]$/.test(markText)) {
            // Bullet list: replace marker with bullet dot
            // Also consume trailing space
            let end = to
            const line = state.doc.lineAt(from)
            const posAfter = to - line.from
            if (line.text[posAfter] === ' ') end += 1
            decorations.push(
              Decoration.replace({ widget: new BulletWidget() }).range(
                from,
                end
              )
            )
          }
          // Ordered list markers (1. 2. etc.) stay as-is
          break
        }

        // ── Task markers: replace with checkbox ─────────
        case 'TaskMarker': {
          // Walk up: TaskMarker > Task > ListItem
          const listItem =
            node.node?.parent?.parent ?? null
          if (listItem && cursorInRange(head, listItem.from, listItem.to))
            break

          const markerText = state.doc.sliceString(from, to)
          const isChecked =
            markerText.includes('x') || markerText.includes('X')
          // Also consume trailing space
          let end = to
          const line = state.doc.lineAt(from)
          const posAfter = to - line.from
          if (line.text[posAfter] === ' ') end += 1
          decorations.push(
            Decoration.replace({ widget: new CheckboxWidget(isChecked) }).range(
              from,
              end
            )
          )
          break
        }

        // ── Horizontal rules: replace with line ─────────
        case 'HorizontalRule': {
          const line = state.doc.lineAt(from)
          if (cursorInRange(head, line.from, line.to)) break
          decorations.push(
            Decoration.replace({ widget: new HRWidget() }).range(from, to)
          )
          break
        }
      }
    }
  })

  // Sort by position (required by RangeSet)
  decorations.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from
    return a.value.startSide - b.value.startSide
  })

  return Decoration.set(decorations)
}

// ─── Plugin ──────────────────────────────────────────────

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.selectionSet ||
        update.viewportChanged ||
        syntaxTree(update.state) !== syntaxTree(update.startState)
      ) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations
  }
)

// ─── Live preview theme ─────────────────────────────────

export const livePreviewTheme = EditorView.theme({
  // Headings render large when marks are hidden
  '.cm-line:has(.cm-header-1)': {
    fontSize: '1.8em',
    fontWeight: '700',
    lineHeight: '1.3'
  },
  '.cm-line:has(.cm-header-2)': {
    fontSize: '1.5em',
    fontWeight: '600',
    lineHeight: '1.3'
  },
  '.cm-line:has(.cm-header-3)': {
    fontSize: '1.25em',
    fontWeight: '600',
    lineHeight: '1.3'
  },
  '.cm-line:has(.cm-header-4)': {
    fontSize: '1.1em',
    fontWeight: '600'
  },
})
