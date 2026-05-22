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
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      height: '100%',
      fontSize: '15px'
    },
    '.cm-content': {
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      padding: '24px 0',
      caretColor: '#c6c6c6'
    },
    '.cm-cursor': {
      borderLeftColor: '#c6c6c6'
    },
    '.cm-activeLine': {
      backgroundColor: '#2a2a2a'
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#2a2a2a'
    },
    '.cm-gutters': {
      backgroundColor: '#1e1e1e',
      color: '#858585',
      border: 'none',
      paddingRight: '8px'
    },
    '.cm-selectionBackground': {
      backgroundColor: '#264f78 !important'
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: '#264f78 !important'
    },
    '.cm-line': {
      padding: '0 32px',
      lineHeight: '1.7'
    }
  },
  { dark: true }
)

// Markdown element styles (applied in both source and live preview)
const markdownStyles = EditorView.theme({
  '.cm-header-1': {
    fontSize: '1.8em',
    fontWeight: '700',
    color: '#e0e0e0',
    lineHeight: '1.3'
  },
  '.cm-header-2': {
    fontSize: '1.5em',
    fontWeight: '600',
    color: '#d4d4d4',
    lineHeight: '1.3'
  },
  '.cm-header-3': {
    fontSize: '1.25em',
    fontWeight: '600',
    color: '#cccccc',
    lineHeight: '1.3'
  },
  '.cm-header-4': {
    fontSize: '1.1em',
    fontWeight: '600',
    color: '#c0c0c0'
  },
  '.cm-header-5': { fontWeight: '600', color: '#b0b0b0' },
  '.cm-header-6': { fontWeight: '600', color: '#a0a0a0' },
  '.cm-strong': { fontWeight: '700', color: '#e0e0e0' },
  '.cm-emphasis': { fontStyle: 'italic', color: '#d4d4d4' },
  '.cm-strikethrough': { textDecoration: 'line-through', color: '#888' },
  '.cm-link': { color: '#569cd6', textDecoration: 'underline' },
  '.cm-url': { color: '#4ec9b0', fontSize: '0.9em' },
  '.cm-monospace': {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: '#2d2d2d',
    borderRadius: '3px',
    padding: '2px 5px',
    fontSize: '0.9em'
  }
})

// Source-mode specific styles (show syntax characters with subdued colors)
const sourceTheme = EditorView.theme({
  '.cm-content': {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
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
