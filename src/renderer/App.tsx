import React, { useState, useCallback, useEffect } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { VaultPicker } from './components/VaultPicker'
import { FileTree } from './components/Sidebar/FileTree'
import { SearchPanel } from './components/Sidebar/SearchPanel'
import { MarkdownEditor, EditorMode } from './components/Editor/MarkdownEditor'
import { MarkdownPreview } from './components/Editor/MarkdownPreview'
import { GraphView } from './components/Graph/GraphView'
import { EmptyState } from './components/EmptyState'
import { QuickSwitcher } from './components/QuickSwitcher'
import { TagsBar } from './components/TagsBar'
import { useFileTree } from './hooks/useFileTree'
import { useFileContent } from './hooks/useFileContent'
import { useSearch } from './hooks/useSearch'
import { useTags } from './hooks/useTags'
import { FileNode, GraphData } from '../shared/types'

// Live Preview = WYSIWYG-like editing (default)
// Source       = raw markdown with syntax highlighting
// Reading      = fully rendered, read-only preview
// Graph        = force-directed graph of document relationships
type ViewMode = 'live' | 'source' | 'reading' | 'graph'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isResizing, setIsResizing] = useState(false)

  // Graph state
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [graphLoading, setGraphLoading] = useState(false)
  const [graphFilter, setGraphFilter] = useState('')

  // Quick switcher state
  const [quickSwitcherOpen, setQuickSwitcherOpen] = useState(false)

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

  // Track recent files when a file is opened
  useEffect(() => {
    if (currentFilePath) {
      const name = currentFilePath.split('/').pop() || ''
      window.api.addRecentFile(currentFilePath, name)
    }
  }, [currentFilePath])

  // Load graph data when switching to graph view
  useEffect(() => {
    if (viewMode === 'graph' && vaultPath && !graphData) {
      setGraphLoading(true)
      window.api.buildGraph(vaultPath).then((data) => {
        setGraphData(data)
        setGraphLoading(false)
      })
    }
  }, [viewMode, vaultPath, graphData])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        setSidebarMode((m) => (m === 'search' ? 'files' : 'search'))
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'e') {
        e.preventDefault()
        setViewMode((m) => {
          if (m === 'live') return 'source'
          if (m === 'source') return 'reading'
          if (m === 'reading') return 'live'
          return 'live'
        })
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault()
        setViewMode((m) => (m === 'graph' ? 'live' : 'graph'))
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'k') {
        e.preventDefault()
        setQuickSwitcherOpen((v) => !v)
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault()
        setSidebarCollapsed((v) => !v)
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
      // Switch out of graph view when opening a file
      if (viewMode === 'graph') {
        setViewMode('live')
      }
    },
    [openFile, viewMode]
  )

  const handleGraphNodeClick = useCallback(
    (filePath: string) => {
      openFile(filePath)
      setViewMode('live')
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

  const handleSwitchVault = useCallback(async () => {
    const newPath = await window.api.openVault()
    if (newPath) {
      setCurrentFile(null)
      setGraphData(null)
      setVaultPath(newPath)
    }
  }, [setCurrentFile, setVaultPath])

  const handleQuickSwitcherSelect = useCallback(
    (filePath: string) => {
      openFile(filePath)
      if (viewMode === 'graph') {
        setViewMode('live')
      }
    },
    [openFile, viewMode]
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
  const showEditor = viewMode === 'live' || viewMode === 'source'
  const showReading = viewMode === 'reading'
  const showGraph = viewMode === 'graph'
  const showEmptyState = !currentFilePath && !showGraph

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <div
        className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >
        <div className="sidebar-inner">
          <div className="sidebar-header">
            <div className="sidebar-top-row">
              <span className="sidebar-vault-name" title={vaultPath}>
                {vaultPath.split('/').pop()}
              </span>
              <button
                className="sidebar-vault-switch"
                onClick={handleSwitchVault}
                title="Open a different vault"
              >
                Switch
              </button>
            </div>
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
      </div>

      {/* Resize handle */}
      <div
        className="sidebar-resize-handle"
        onMouseDown={handleMouseDown}
        style={{ display: sidebarCollapsed ? 'none' : undefined }}
      />

      {/* Main content */}
      <div className="main-content">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed((v) => !v)}
              title={sidebarCollapsed ? 'Show sidebar (Cmd+\\)' : 'Hide sidebar (Cmd+\\)'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
                <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </button>
            {fileName && !showGraph && (
              <span className="toolbar-filename">
                {isDirty && (
                  <span className="dirty-dot" title="Unsaved changes" />
                )}
                {fileName}
              </span>
            )}
            {showGraph && (
              <div className="graph-filter-wrapper">
                <input
                  type="text"
                  className="graph-filter-input"
                  placeholder="Filter by name or tag..."
                  value={graphFilter}
                  onChange={(e) => setGraphFilter(e.target.value)}
                />
                {graphFilter && (
                  <button
                    className="graph-filter-clear"
                    onClick={() => setGraphFilter('')}
                  >
                    x
                  </button>
                )}
              </div>
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
            <span className="toolbar-separator" />
            <button
              className={`view-mode-btn ${viewMode === 'graph' ? 'view-mode-active' : ''}`}
              onClick={() => setViewMode((m) => (m === 'graph' ? 'live' : 'graph'))}
              title="Graph View (Cmd+G)"
            >
              Graph
            </button>
          </div>
        </div>

        {/* Content area */}
        <div className="editor-preview-wrapper">
          {/* Editor (always mounted, hidden when not active) */}
          <div
            className="editor-pane"
            style={{
              display: showEditor && !showEmptyState ? undefined : 'none'
            }}
          >
            <MarkdownEditor
              content={currentFileContent}
              filePath={currentFilePath}
              mode={editorMode}
              onChange={updateContent}
              onSave={saveFile}
            />
          </div>

          {/* Reading view */}
          {showReading && !showEmptyState && (
            <div className="preview-pane">
              <MarkdownPreview
                content={currentFileContent}
                filePath={currentFilePath}
              />
            </div>
          )}

          {/* Graph view */}
          {showGraph && (
            <div className="graph-pane">
              <GraphView
                graphData={graphData}
                loading={graphLoading}
                filter={graphFilter}
                onNodeClick={handleGraphNodeClick}
              />
            </div>
          )}

          {/* Empty state (no file selected, not in graph) */}
          {showEmptyState && !showGraph && (
            <div className="editor-pane">
              <EmptyState onFileClick={handleFileClick} />
            </div>
          )}
        </div>
      </div>

      {/* Quick Switcher (Cmd+K) */}
      <QuickSwitcher
        tree={tree}
        vaultPath={vaultPath}
        isOpen={quickSwitcherOpen}
        onSelect={handleQuickSwitcherSelect}
        onClose={() => setQuickSwitcherOpen(false)}
      />
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
