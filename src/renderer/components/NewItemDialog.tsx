import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { FileNode } from '../../shared/types'

type NewItemType = 'note' | 'folder'

interface NewItemDialogProps {
  tree: FileNode[]
  vaultPath: string
  currentFilePath: string | null
  isOpen: boolean
  initialType: NewItemType
  initialDir?: string | null
  onCreateFile: (dirPath: string, name: string) => void
  onCreateDir: (dirPath: string, name: string) => void
  onClose: () => void
}

// Flatten tree into a list of directory paths
function collectDirs(nodes: FileNode[], vaultPath: string): { name: string; path: string; depth: number }[] {
  const dirs: { name: string; path: string; depth: number }[] = []

  function walk(items: FileNode[], parentLabel: string, depth: number) {
    for (const node of items) {
      if (node.isDirectory) {
        const label = parentLabel ? `${parentLabel} / ${node.name}` : node.name
        dirs.push({ name: label, path: node.path, depth })
        if (node.children) {
          walk(node.children, label, depth + 1)
        }
      }
    }
  }

  walk(nodes, '', 0)
  return dirs
}

export function NewItemDialog({
  tree,
  vaultPath,
  currentFilePath,
  isOpen,
  initialType,
  initialDir,
  onCreateFile,
  onCreateDir,
  onClose
}: NewItemDialogProps) {
  const [itemType, setItemType] = useState<NewItemType>(initialType)
  const [name, setName] = useState('')
  const [selectedDir, setSelectedDir] = useState(vaultPath)
  const [dirDropdownOpen, setDirDropdownOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allDirs = useMemo(() => collectDirs(tree, vaultPath), [tree, vaultPath])

  // Determine the default directory: initialDir (from context menu) > current file's parent > vault root
  const defaultDir = useMemo(() => {
    if (initialDir) {
      // Verify it's a valid directory in the tree
      if (initialDir === vaultPath || allDirs.some((d) => d.path === initialDir)) {
        return initialDir
      }
    }
    if (!currentFilePath) return vaultPath
    // Get the parent directory of the current file
    const parts = currentFilePath.split('/')
    parts.pop() // remove filename
    const parentDir = parts.join('/')
    // Check if it's a valid directory in the tree
    if (allDirs.some((d) => d.path === parentDir)) {
      return parentDir
    }
    return vaultPath
  }, [currentFilePath, vaultPath, allDirs, initialDir])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setItemType(initialType)
      setName('')
      setSelectedDir(defaultDir)
      setDirDropdownOpen(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen, initialType, defaultDir])

  // Close dropdown on outside click
  useEffect(() => {
    if (!dirDropdownOpen) return
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDirDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dirDropdownOpen])

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) return

    if (itemType === 'note') {
      onCreateFile(selectedDir, trimmed)
    } else {
      onCreateDir(selectedDir, trimmed)
    }
    onClose()
  }, [name, itemType, selectedDir, onCreateFile, onCreateDir, onClose])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    },
    [handleSubmit, onClose]
  )

  // Display name for selected directory
  const selectedDirLabel = useMemo(() => {
    if (selectedDir === vaultPath) return '/ (vault root)'
    const found = allDirs.find((d) => d.path === selectedDir)
    return found ? found.name : selectedDir.split('/').pop() || '/'
  }, [selectedDir, vaultPath, allDirs])

  if (!isOpen) return null

  return (
    <div className="new-item-overlay" onClick={onClose}>
      <div
        className="new-item-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Type toggle */}
        <div className="new-item-type-toggle">
          <button
            className={`new-item-type-btn ${itemType === 'note' ? 'new-item-type-active' : ''}`}
            onClick={() => setItemType('note')}
          >
            New Note
          </button>
          <button
            className={`new-item-type-btn ${itemType === 'folder' ? 'new-item-type-active' : ''}`}
            onClick={() => setItemType('folder')}
          >
            New Folder
          </button>
        </div>

        {/* Name input */}
        <div className="new-item-field">
          <label className="new-item-label">Name</label>
          <input
            ref={inputRef}
            type="text"
            className="new-item-input"
            placeholder={itemType === 'note' ? 'My note' : 'My folder'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {itemType === 'note' && name && !name.endsWith('.md') && (
            <span className="new-item-ext-hint">.md</span>
          )}
        </div>

        {/* Folder picker */}
        <div className="new-item-field" ref={dropdownRef}>
          <label className="new-item-label">Location</label>
          <button
            className="new-item-dir-btn"
            onClick={() => setDirDropdownOpen((v) => !v)}
          >
            <span className="new-item-dir-label">{selectedDirLabel}</span>
            <span className="new-item-dir-chevron">{dirDropdownOpen ? '\u25B4' : '\u25BE'}</span>
          </button>

          {dirDropdownOpen && (
            <div className="new-item-dir-dropdown">
              <button
                className={`new-item-dir-option ${selectedDir === vaultPath ? 'new-item-dir-option-active' : ''}`}
                onClick={() => { setSelectedDir(vaultPath); setDirDropdownOpen(false) }}
              >
                / (vault root)
              </button>
              {allDirs.map((dir) => (
                <button
                  key={dir.path}
                  className={`new-item-dir-option ${selectedDir === dir.path ? 'new-item-dir-option-active' : ''}`}
                  style={{ paddingLeft: `${12 + dir.depth * 16}px` }}
                  onClick={() => { setSelectedDir(dir.path); setDirDropdownOpen(false) }}
                >
                  {dir.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="new-item-actions">
          <button className="new-item-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="new-item-create"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create {itemType === 'note' ? 'Note' : 'Folder'}
          </button>
        </div>
      </div>
    </div>
  )
}
