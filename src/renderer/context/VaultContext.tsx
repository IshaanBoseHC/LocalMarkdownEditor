import React, { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react'

export interface TabInfo {
  filePath: string
  content: string
  isDirty: boolean
}

interface VaultState {
  vaultPath: string | null
  // Multi-tab state
  tabs: TabInfo[]
  activeTabIndex: number
  // Derived convenience getters (from the active tab)
  currentFilePath: string | null
  currentFileContent: string
  isDirty: boolean

  setVaultPath: (path: string | null) => void

  /** Open or focus a tab for the given file. If already open, switches to it. */
  openTab: (filePath: string, content: string) => void
  /** Close a tab by index. Returns the closed tab's filePath (for cleanup). */
  closeTab: (index: number) => void
  /** Switch to an existing tab by index. */
  setActiveTab: (index: number) => void
  /** Update the active tab's content and mark dirty. */
  setCurrentFileContent: (content: string) => void
  /** Set the active tab's dirty flag. */
  setIsDirty: (dirty: boolean) => void
  /** Legacy: set active tab path + content + clear dirty (used by rename). */
  setCurrentFile: (path: string | null, content?: string) => void
  /** Close all tabs (vault switch). */
  closeAllTabs: () => void
  /** Update a tab's path in-place (rename). */
  renameTab: (oldPath: string, newPath: string) => void
}

const VaultContext = createContext<VaultState | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [tabs, setTabs] = useState<TabInfo[]>([])
  const [activeTabIndex, setActiveTabIndex] = useState(-1)

  // Keep a ref in sync so callbacks can read the latest index without stale closures
  const activeRef = useRef(activeTabIndex)
  activeRef.current = activeTabIndex
  const tabsRef = useRef(tabs)
  tabsRef.current = tabs

  // Derived values from active tab
  const activeTab = activeTabIndex >= 0 && activeTabIndex < tabs.length ? tabs[activeTabIndex] : null
  const currentFilePath = activeTab?.filePath ?? null
  const currentFileContent = activeTab?.content ?? ''
  const isDirty = activeTab?.isDirty ?? false

  const openTab = useCallback((filePath: string, content: string) => {
    const existingIndex = tabsRef.current.findIndex(t => t.filePath === filePath)
    if (existingIndex >= 0) {
      // Already open — update content and switch to it
      setTabs(prev => {
        const updated = [...prev]
        updated[existingIndex] = { ...updated[existingIndex], content, isDirty: false }
        return updated
      })
      setActiveTabIndex(existingIndex)
    } else {
      // New tab — append and activate
      setTabs(prev => [...prev, { filePath, content, isDirty: false }])
      setActiveTabIndex(tabsRef.current.length) // new last index
    }
  }, [])

  const closeTab = useCallback((index: number) => {
    setTabs(prev => {
      if (index < 0 || index >= prev.length) return prev
      return prev.filter((_, i) => i !== index)
    })
    setActiveTabIndex(ai => {
      const len = tabsRef.current.length - 1 // after removal
      if (len <= 0) return -1
      if (index < ai) return ai - 1
      if (index === ai) return Math.min(index, len - 1)
      return ai
    })
  }, [])

  const setActiveTab = useCallback((index: number) => {
    setActiveTabIndex(index)
  }, [])

  const setCurrentFileContent = useCallback((content: string) => {
    const ai = activeRef.current
    if (ai < 0) return
    setTabs(prev => {
      if (ai >= prev.length) return prev
      const updated = [...prev]
      updated[ai] = { ...updated[ai], content }
      return updated
    })
  }, [])

  const setIsDirty = useCallback((dirty: boolean) => {
    const ai = activeRef.current
    if (ai < 0) return
    setTabs(prev => {
      if (ai >= prev.length) return prev
      const updated = [...prev]
      updated[ai] = { ...updated[ai], isDirty: dirty }
      return updated
    })
  }, [])

  // Legacy compat: used by rename and delete
  const setCurrentFile = useCallback((path: string | null, content?: string) => {
    const ai = activeRef.current
    if (path === null) {
      // Close active tab
      if (ai >= 0) {
        setTabs(prev => prev.filter((_, i) => i !== ai))
        setActiveTabIndex(prev => {
          const newLen = tabsRef.current.length - 1
          if (newLen <= 0) return -1
          return Math.min(prev, newLen - 1)
        })
      }
      return
    }
    // Update active tab's path and content
    if (ai < 0) return
    setTabs(prev => {
      if (ai >= prev.length) return prev
      const updated = [...prev]
      updated[ai] = { filePath: path, content: content ?? '', isDirty: false }
      return updated
    })
  }, [])

  const closeAllTabs = useCallback(() => {
    setTabs([])
    setActiveTabIndex(-1)
  }, [])

  const renameTab = useCallback((oldPath: string, newPath: string) => {
    setTabs(prev => prev.map(tab =>
      tab.filePath === oldPath ? { ...tab, filePath: newPath } : tab
    ))
  }, [])

  return (
    <VaultContext.Provider
      value={{
        vaultPath,
        tabs,
        activeTabIndex,
        currentFilePath,
        currentFileContent,
        isDirty,
        setVaultPath,
        openTab,
        closeTab,
        setActiveTab,
        setCurrentFileContent,
        setIsDirty,
        setCurrentFile,
        closeAllTabs,
        renameTab
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultState {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider')
  }
  return context
}
