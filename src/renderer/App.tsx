import React, { useState, useCallback, useEffect } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { VaultPicker } from './components/VaultPicker'
import { FileTree } from './components/Sidebar/FileTree'
import { SearchPanel } from './components/Sidebar/SearchPanel'
import { MarkdownEditor, EditorMode } from './components/Editor/MarkdownEditor'
import { MarkdownPreview } from './components/Editor/MarkdownPreview'
import { TagsBar } from './components/TagsBar'
import { useFileTree } from './hooks/useFileTree'
import { useFileContent } from './hooks/useFileContent'
import { useSearch } from './hooks/useSearch'
import { useTags } from './hooks/useTags'
import { FileNode } from '../shared/types'

// Live Preview = WYSIWYG-like editing (default)
// Source      = raw markdown with syntax highlighting
// Reading     = fully rendered, read-only preview
type ViewMode = 'live' | 'source' | 'reading'
type SidebarMode = 'files' | 'search'

function AppContent() {
  const {
    vaultPath,
    currentFilePath,
    currentFileContent,
    isDirty,
    setVaultPath,
    setCurrentFile
  } = useVault()

  const { tree, loading, loadTree } = useFileTree()
  const { openFile, saveFile, updateContent } = useFileContent()
  const { results, searching, query, search, clearSearch } = useSearch()
  const { allTags, activeTag, setActiveTag, filteredFiles, registerFileTags } =
    useTags()

  const [viewMode, setViewMode] = useState<ViewMode>('live')
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('files')
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)

  // Load tree when vault is opened
  useEffect(() => {
    if (vaultPath) {
      loadTree(vaultPath)
    }
  }, [vaultPath, loadTree])

  // Try to load last used vault on startup
  useEffect(() => {
    window.api.getLastVault().then((lastPath) => {
      if (lastPath) {
        setVaultPath(lastPath)
      }
    })
  }, [setVaultPath])

  // Register tags when a file is opened
  useEffect(() => {
    if (currentFilePath && currentFileContent) {
      registerFileTags(currentFilePath, currentFileContent)
    }
  }, [currentFilePath, currentFileContent, registerFileTags])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSidebarMode((m) => (m === 'search' ? 'files' : 'search'))
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        setViewMode((m) => {
          if (m === 'live') return 'source'
          if (m === 'source') return 'reading'
          return 'live'
        })
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sidebar resize
  const handleMouseDown = useCallback(() => {
    setIsResizing(true)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(180, Math.min(500, e.clientX))
      setSidebarWidth(newWidth)
    }
    const handleMouseUp = () => setIsResizing(false)

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing])

  // File operations
  const handleFileClick = useCallback(
    (filePath: string) => {
      openFile(filePath)
    },
    [openFile]
  )

  const handleCreateFile = useCallback(
    async (dirPath: string) => {
      const name = prompt('File name:')
      if (!name) return
      await window.api.createFile(dirPath, name)
      if (vaultPath) loadTree(vaultPath)
    },
    [vaultPath, loadTree]
  )

  const handleCreateDir = useCallback(
    async (dirPath: string) => {
      const name = prompt('Folder name:')
      if (!name) return
      await window.api.createDir(dirPath, name)
      if (vaultPath) loadTree(vaultPath)
    },
    [vaultPath, loadTree]
  )

  const handleRename = useCallback(
    async (node: FileNode) => {
      const newName = prompt('New name:', node.name)
      if (!newName || newName === node.name) return
      const parts = node.path.split('/')
      parts[parts.length - 1] = newName
      const newPath = parts.join('/')
      await window.api.rename(node.path, newPath)
      if (vaultPath) loadTree(vaultPath)
      if (currentFilePath === node.path) {
        setCurrentFile(newPath, currentFileContent)
      }
    },
    [vaultPath, loadTree, currentFilePath, currentFileContent, setCurrentFile]
  )

  const handleDelete = useCallback(
    async (node: FileNode) => {
      const confirmed = confirm(
        `Delete "${node.name}"? It will be moved to the trash.`
      )
      if (!confirmed) return
      await window.api.delete(node.path)
      if (vaultPath) loadTree(vaultPath)
      if (currentFilePath === node.path) {
        setCurrentFile(null)
      }
    },
    [vaultPath, loadTree, currentFilePath, setCurrentFile]
  )

  const handleSearchResultClick = useCallback(
    (filePath: string) => {
      openFile(filePath)
      setSidebarMode('files')
    },
    [openFile]
  )

  // Vault selection screen
  if (!vaultPath) {
    return <VaultPicker onVaultSelected={setVaultPath} />
  }

  const fileName = currentFilePath
    ? currentFilePath.split('/').pop() || ''
    : ''

  // Map view mode to editor mode
  const editorMode: EditorMode = viewMode === 'source' ? 'source' : 'live'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
          <div className="sidebar-tabs">
            <button
              className={`sidebar-tab ${sidebarMode === 'files' ? 'sidebar-tab-active' : ''}`}
              onClick={() => setSidebarMode('files')}
              title="Files"
            >
              Files
            </button>
            <button
              className={`sidebar-tab ${sidebarMode === 'search' ? 'sidebar-tab-active' : ''}`}
              onClick={() => setSidebarMode('search')}
              title="Search (Ctrl+Shift+F)"
            >
              Search
            </button>
          </div>
        </div>

        <div className="sidebar-content">
          {sidebarMode === 'files' ? (
            <FileTree
              tree={tree}
              currentFilePath={currentFilePath}
              filteredFiles={filteredFiles}
              onFileClick={handleFileClick}
              onCreateFile={handleCreateFile}
              onCreateDir={handleCreateDir}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ) : (
            <SearchPanel
              vaultPath={vaultPath}
              results={results}
              searching={searching}
              query={query}
              onSearch={search}
              onClear={clearSearch}
              onResultClick={handleSearchResultClick}
            />
          )}
        </div>

        {/* Tags */}
        <TagsBar
          tags={allTags}
          activeTag={activeTag}
          onTagClick={setActiveTag}
        />
      </div>

      {/* Resize handle */}
      <div className="sidebar-resize-handle" onMouseDown={handleMouseDown} />

      {/* Main content */}
      <div className="main-content">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-left">
            {fileName && (
              <span className="toolbar-filename">
                {isDirty && (
                  <span className="dirty-dot" title="Unsaved changes" />
                )}
                {fileName}
              </span>
            )}
          </div>
          <div className="toolbar-right">
            <button
              className={`view-mode-btn ${viewMode === 'live' ? 'view-mode-active' : ''}`}
              onClick={() => setViewMode('live')}
              title="Live Preview (Cmd+E)"
            >
              Live Preview
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'source' ? 'view-mode-active' : ''}`}
              onClick={() => setViewMode('source')}
              title="Source Mode"
            >
              Source
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'reading' ? 'view-mode-active' : ''}`}
              onClick={() => setViewMode('reading')}
              title="Reading View"
            >
              Reading
            </button>
          </div>
        </div>

        {/* Editor / Preview panes */}
        <div className="editor-preview-wrapper">
          {/* Editor is always mounted to preserve state; hidden in reading mode */}
          <div
            className="editor-pane"
            style={{ display: viewMode === 'reading' ? 'none' : undefined }}
          >
            <MarkdownEditor
              content={currentFileContent}
              filePath={currentFilePath}
              mode={editorMode}
              onChange={updateContent}
              onSave={saveFile}
            />
          </div>
          {viewMode === 'reading' && (
            <div className="preview-pane">
              <MarkdownPreview
                content={currentFileContent}
                filePath={currentFilePath}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <VaultProvider>
      <AppContent />
    </VaultProvider>
  )
}
