import React, { useState, useCallback, useEffect, useRef } from 'react'
import { VaultProvider, useVault } from './context/VaultContext'
import { VaultPicker } from './components/VaultPicker'
import { FileTree } from './components/Sidebar/FileTree'
import { SearchPanel } from './components/Sidebar/SearchPanel'
import { MarkdownEditor, EditorMode } from './components/Editor/MarkdownEditor'
import { MarkdownPreview } from './components/Editor/MarkdownPreview'
import { GraphView } from './components/Graph/GraphView'
import { Dashboard } from './components/Dashboard'
import { QuickSwitcher } from './components/QuickSwitcher'
import { NewItemDialog } from './components/NewItemDialog'
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
// Dashboard    = vault analytics landing page
type ViewMode = 'dashboard' | 'live' | 'source' | 'reading' | 'graph'
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

  const [viewMode, setViewMode] = useState<ViewMode>('dashboard')
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

  // New item dialog state
  const [newItemOpen, setNewItemOpen] = useState(false)
  const [newItemType, setNewItemType] = useState<'note' | 'folder'>('note')
  const [newItemDir, setNewItemDir] = useState<string | null>(null)

  // AI summarize state
  const [summarizing, setSummarizing] = useState(false)
  const [summarizeLog, setSummarizeLog] = useState('')
  const [summarizeLogVisible, setSummarizeLogVisible] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)

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

  // Listen for AI summarize output stream
  useEffect(() => {
    const unsub = window.api.onAiSummarizeOutput((text) => {
      setSummarizeLog((prev) => prev + text)
    })
    return unsub
  }, [])

  // Auto-scroll log panel
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [summarizeLog])

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
          return 'live' // from dashboard or graph, go to live
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
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        setNewItemType('note')
        setNewItemDir(null)
        setNewItemOpen(true)
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
      // Switch to editor when opening a file from dashboard or graph
      if (viewMode === 'graph' || viewMode === 'dashboard') {
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
    async (dirPath: string, nameArg?: string) => {
      if (!nameArg) {
        // Open the New Item Dialog pre-set to this directory
        setNewItemType('note')
        setNewItemDir(dirPath)
        setNewItemOpen(true)
        return
      }
      const finalName = nameArg.endsWith('.md') ? nameArg : `${nameArg}.md`
      await window.api.createFile(dirPath, finalName)
      if (vaultPath) loadTree(vaultPath)
      const newPath = `${dirPath}/${finalName}`
      openFile(newPath)
      if (viewMode === 'graph' || viewMode === 'dashboard') setViewMode('live')
    },
    [vaultPath, loadTree, openFile, viewMode]
  )

  const handleCreateDir = useCallback(
    async (dirPath: string, nameArg?: string) => {
      if (!nameArg) {
        // Open the New Item Dialog pre-set to this directory
        setNewItemType('folder')
        setNewItemDir(dirPath)
        setNewItemOpen(true)
        return
      }
      await window.api.createDir(dirPath, nameArg)
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
      if (viewMode === 'graph' || viewMode === 'dashboard') {
        setViewMode('live')
      }
    },
    [openFile, viewMode]
  )

  const handleSummarize = useCallback(async () => {
    if (!currentFilePath || summarizing) return
    setSummarizing(true)
    setSummarizeLog('')
    setSummarizeLogVisible(true)
    try {
      const result = await window.api.aiSummarize(currentFilePath)
      if (result.success) {
        // Reload the file to pick up the prepended summary
        openFile(currentFilePath)
      } else {
        setSummarizeLog((prev) => prev + '\n--- ERROR ---\n' + (result.error || 'Unknown error'))
      }
    } catch (err) {
      setSummarizeLog((prev) => prev + '\n--- ERROR ---\n' + String(err))
    } finally {
      setSummarizing(false)
    }
  }, [currentFilePath, summarizing, openFile])

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
  const showDashboard = viewMode === 'dashboard'

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

      {/* Collapsed sidebar expand strip */}
      {sidebarCollapsed && (
        <button
          className="sidebar-expand-strip"
          onClick={() => setSidebarCollapsed(false)}
          title="Show sidebar (Cmd+\)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        </button>
      )}

      {/* Main content */}
      <div className="main-content">
        {/* Toolbar */}
        <div className="toolbar">
          <div className="toolbar-left">
            {!sidebarCollapsed && (
              <button
                className="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(true)}
                title="Hide sidebar (Cmd+\)"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="5.5" y1="1.5" x2="5.5" y2="14.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            )}
            <button
              className="toolbar-new-btn"
              onClick={() => { setNewItemType('note'); setNewItemDir(null); setNewItemOpen(true) }}
              title="New Note (Cmd+N)"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>New Note</span>
            </button>
            <button
              className="toolbar-new-btn toolbar-new-folder-btn"
              onClick={() => { setNewItemType('folder'); setNewItemDir(null); setNewItemOpen(true) }}
              title="New Folder"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M1.5 3.5a1 1 0 011-1h3.586a1 1 0 01.707.293L8.207 4.207a1 1 0 00.707.293H13.5a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1v-8z" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 7.5v4M6 9.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="toolbar-separator" />
            {fileName && !showGraph && !showDashboard && (
              <span className="toolbar-filename">
                {isDirty && (
                  <span className="dirty-dot" title="Unsaved changes" />
                )}
                {fileName}
              </span>
            )}
            {currentFilePath && !showGraph && !showDashboard && (
              <button
                className={`toolbar-new-btn toolbar-summarize-btn ${summarizing ? 'toolbar-summarize-running' : ''}`}
                onClick={handleSummarize}
                disabled={summarizing}
                title="Summarize with AI (opencode)"
              >
                {summarizing ? (
                  <>
                    <span className="toolbar-summarize-spinner" />
                    <span>Summarizing...</span>
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 3h10M3 6h8M3 9h10M3 12h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                    <span>Summarize</span>
                  </>
                )}
              </button>
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
              className={`view-mode-btn ${viewMode === 'dashboard' ? 'view-mode-active' : ''}`}
              onClick={() => setViewMode('dashboard')}
              title="Dashboard"
            >
              Dashboard
            </button>
            <span className="toolbar-separator" />
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
              display: showEditor && !showDashboard ? undefined : 'none'
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
          {showReading && !showDashboard && (
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

          {/* Dashboard */}
          {showDashboard && (
            <Dashboard
              vaultPath={vaultPath}
              onFileClick={handleFileClick}
              onNewNote={() => { setNewItemType('note'); setNewItemDir(null); setNewItemOpen(true) }}
            />
          )}
        </div>

        {/* AI Summarize log panel */}
        {summarizeLogVisible && (
          <div className="ai-log-panel">
            <div className="ai-log-header">
              <span className="ai-log-title">
                {summarizing && <span className="toolbar-summarize-spinner" />}
                {summarizing ? 'Summarizing...' : 'Summary Complete'}
              </span>
              <button
                className="ai-log-close"
                onClick={() => setSummarizeLogVisible(false)}
              >
                &times;
              </button>
            </div>
            <pre className="ai-log-content">
              {summarizeLog || 'Waiting for output...'}
              <div ref={logEndRef} />
            </pre>
          </div>
        )}
      </div>

      {/* Quick Switcher (Cmd+K) */}
      <QuickSwitcher
        tree={tree}
        vaultPath={vaultPath}
        isOpen={quickSwitcherOpen}
        onSelect={handleQuickSwitcherSelect}
        onClose={() => setQuickSwitcherOpen(false)}
      />

      {/* New Note / New Folder dialog (Cmd+N) */}
      <NewItemDialog
        tree={tree}
        vaultPath={vaultPath}
        currentFilePath={currentFilePath}
        isOpen={newItemOpen}
        initialType={newItemType}
        initialDir={newItemDir}
        onCreateFile={(dir, name) => handleCreateFile(dir, name)}
        onCreateDir={(dir, name) => handleCreateDir(dir, name)}
        onClose={() => { setNewItemOpen(false); setNewItemDir(null) }}
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
