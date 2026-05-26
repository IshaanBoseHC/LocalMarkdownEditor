import React, { useEffect, useRef } from 'react'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter
} from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  Strikethrough,
  Table,
  TaskList
} from '@lezer/markdown'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands'
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching
} from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { livePreviewPlugin, livePreviewTheme } from '../../extensions/livePreview'
import { markdownCommands } from '../../extensions/markdownCommands'

// ─── Theme ───────────────────────────────────────────────

const darkTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: '#0d0d0d',
      color: '#e0e0e2',
      height: '100%',
      fontSize: '15px'
    },
    '.cm-content': {
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif",
      padding: '32px 0',
      caretColor: '#5e9eff'
    },
    '.cm-cursor': {
      borderLeftColor: '#5e9eff',
      borderLeftWidth: '2px'
    },
    '.cm-activeLine': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    '.cm-gutters': {
      backgroundColor: '#0d0d0d',
      color: '#3a3a3e',
      border: 'none',
      paddingRight: '8px'
    },
    '.cm-selectionBackground': {
      backgroundColor: 'rgba(94, 158, 255, 0.2) !important'
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(94, 158, 255, 0.25) !important'
    },
    '.cm-line': {
      padding: '0 48px',
      lineHeight: '1.75'
    },
    '.cm-matchingBracket': {
      backgroundColor: 'rgba(94, 158, 255, 0.15)',
      outline: '1px solid rgba(94, 158, 255, 0.3)'
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(94, 158, 255, 0.2)',
      borderRadius: '2px'
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'rgba(94, 158, 255, 0.35)'
    }
  },
  { dark: true }
)

// Markdown element styles (applied in both source and live preview)
const markdownStyles = EditorView.theme({
  '.cm-header-1': {
    fontSize: '1.8em',
    fontWeight: '700',
    color: '#f0f0f2',
    lineHeight: '1.3',
    letterSpacing: '-0.5px'
  },
  '.cm-header-2': {
    fontSize: '1.5em',
    fontWeight: '600',
    color: '#e5e5e7',
    lineHeight: '1.3',
    letterSpacing: '-0.3px'
  },
  '.cm-header-3': {
    fontSize: '1.25em',
    fontWeight: '600',
    color: '#d8d8da',
    lineHeight: '1.3'
  },
  '.cm-header-4': {
    fontSize: '1.1em',
    fontWeight: '600',
    color: '#c8c8ca'
  },
  '.cm-header-5': { fontWeight: '600', color: '#b8b8ba' },
  '.cm-header-6': { fontWeight: '600', color: '#a8a8aa' },
  '.cm-strong': { fontWeight: '700', color: '#eeeeef' },
  '.cm-emphasis': { fontStyle: 'italic', color: '#e0e0e2' },
  '.cm-strikethrough': { textDecoration: 'line-through', color: '#6a6a6e' },
  '.cm-link': { color: '#5e9eff', textDecoration: 'underline' },
  '.cm-url': { color: '#4ec9b0', fontSize: '0.9em' },
  '.cm-monospace': {
    fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '5px',
    padding: '2px 6px',
    fontSize: '0.9em'
  }
})

// Source-mode specific styles (show syntax characters with subdued colors)
const sourceTheme = EditorView.theme({
  '.cm-content': {
    fontFamily: "'SF Mono', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    fontSize: '13px'
  }
})

// ─── Component ──────────────────────────────────────────

export type EditorMode = 'live' | 'source'

interface MarkdownEditorProps {
  content: string
  filePath: string | null
  mode: EditorMode
  onChange: (filePath: string, content: string) => void
  onSave: (filePath: string, content: string) => void
}

export function MarkdownEditor({
  content,
  filePath,
  mode,
  onChange,
  onSave
}: MarkdownEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const contentRef = useRef(content)
  const filePathRef = useRef(filePath)
  const modeCompartment = useRef(new Compartment())

  contentRef.current = content
  filePathRef.current = filePath

  // Extensions that change based on mode
  function getModeExtensions(m: EditorMode) {
    if (m === 'live') {
      return [livePreviewPlugin, livePreviewTheme]
    }
    return [sourceTheme, lineNumbers()]
  }

  useEffect(() => {
    if (!editorRef.current) return

    const saveKeymap = keymap.of([
      {
        key: 'Mod-s',
        run: () => {
          if (filePathRef.current) {
            onSave(filePathRef.current, contentRef.current)
          }
          return true
        }
      }
    ])

    // Markdown formatting hotkeys
    const mdKeymap = keymap.of([
      { key: 'Mod-b', run: markdownCommands.toggleBold },
      { key: 'Mod-i', run: markdownCommands.toggleItalic },
      { key: 'Mod-Shift-x', run: markdownCommands.toggleStrikethrough },
      { key: 'Mod-Shift-k', run: markdownCommands.toggleInlineCode },
      { key: 'Mod-k', run: markdownCommands.insertLink },
      { key: 'Mod-Shift-b', run: markdownCommands.toggleBlockquote },
      { key: 'Mod-Shift-7', run: markdownCommands.toggleOrderedList },
      { key: 'Mod-Shift-8', run: markdownCommands.toggleBulletList },
      { key: 'Mod-Shift-9', run: markdownCommands.toggleTaskList },
      { key: 'Mod-Shift--', run: markdownCommands.insertHorizontalRule },
      { key: 'Mod-1', run: markdownCommands.heading1 },
      { key: 'Mod-2', run: markdownCommands.heading2 },
      { key: 'Mod-3', run: markdownCommands.heading3 },
      { key: 'Mod-4', run: markdownCommands.heading4 },
      { key: 'Mod-5', run: markdownCommands.heading5 },
      { key: 'Mod-6', run: markdownCommands.heading6 },
    ])

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && filePathRef.current) {
        const newContent = update.state.doc.toString()
        contentRef.current = newContent
        onChange(filePathRef.current, newContent)
      }
    })

    const state = EditorState.create({
      doc: content,
      extensions: [
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        highlightSelectionMatches(),
        markdown({
          base: markdownLanguage,
          extensions: [Strikethrough, Table, TaskList]
        }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        saveKeymap,
        mdKeymap,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          indentWithTab
        ]),
        darkTheme,
        markdownStyles,
        modeCompartment.current.of(getModeExtensions(mode)),
        updateListener,
        EditorView.lineWrapping
      ]
    })

    const view = new EditorView({
      state,
      parent: editorRef.current
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [filePath]) // Re-create editor when file changes

  // Switch mode without destroying the editor
  useEffect(() => {
    const view = viewRef.current
    if (view) {
      view.dispatch({
        effects: modeCompartment.current.reconfigure(getModeExtensions(mode))
      })
    }
  }, [mode])

  // Update content externally
  useEffect(() => {
    const view = viewRef.current
    if (view && view.state.doc.toString() !== content) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: content }
      })
    }
  }, [content])

  if (!filePath) {
    return (
      <div className="editor-empty">
        <p>Select a file to start editing</p>
      </div>
    )
  }

  return <div ref={editorRef} className="editor-container" />
}
