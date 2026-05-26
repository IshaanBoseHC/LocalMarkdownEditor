import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { FileNode } from '../../shared/types'

interface QuickSwitcherProps {
  tree: FileNode[]
  vaultPath: string
  isOpen: boolean
  onSelect: (filePath: string) => void
  onClose: () => void
}

// Flatten the file tree into a sorted list of file entries
function flattenTree(nodes: FileNode[]): { name: string; path: string; dir: string }[] {
  const files: { name: string; path: string; dir: string }[] = []

  function walk(items: FileNode[], parentDir: string) {
    for (const node of items) {
      if (node.isDirectory && node.children) {
        walk(node.children, parentDir ? `${parentDir}/${node.name}` : node.name)
      } else if (!node.isDirectory) {
        files.push({
          name: node.name.replace(/\.md$/, ''),
          path: node.path,
          dir: parentDir
        })
      }
    }
  }

  walk(nodes, '')
  return files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

// Simple fuzzy match: check if all query chars appear in order within the target
function fuzzyMatch(query: string, target: string): { match: boolean; score: number } {
  const q = query.toLowerCase()
  const t = target.toLowerCase()

  if (!q) return { match: true, score: 0 }

  // Exact substring match gets highest score
  const substringIdx = t.indexOf(q)
  if (substringIdx !== -1) {
    // Prefer matches at the start
    return { match: true, score: 100 - substringIdx }
  }

  // Fuzzy: all chars in order
  let qi = 0
  let score = 0
  let lastIdx = -1
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Bonus for consecutive matches
      if (lastIdx === ti - 1) score += 5
      // Bonus for matching at word boundaries
      if (ti === 0 || t[ti - 1] === ' ' || t[ti - 1] === '-' || t[ti - 1] === '_') score += 3
      score += 1
      lastIdx = ti
      qi++
    }
  }

  return { match: qi === q.length, score }
}

export function QuickSwitcher({ tree, vaultPath, isOpen, onSelect, onClose }: QuickSwitcherProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const allFiles = useMemo(() => flattenTree(tree), [tree])

  const filtered = useMemo(() => {
    if (!query.trim()) return allFiles.slice(0, 20) // show first 20 when empty

    const results: { file: (typeof allFiles)[0]; score: number }[] = []
    for (const file of allFiles) {
      // Match against file name and dir path
      const nameMatch = fuzzyMatch(query, file.name)
      const dirMatch = fuzzyMatch(query, file.dir ? `${file.dir}/${file.name}` : file.name)
      const best = nameMatch.score >= dirMatch.score ? nameMatch : dirMatch

      if (best.match) {
        results.push({ file, score: best.score })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map((r) => r.file)
  }, [query, allFiles])

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      // Small delay to ensure the input is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus()
      })
    }
  }, [isOpen])

  // Keep selected index in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1))
    }
  }, [filtered.length, selectedIndex])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex].path)
            onClose()
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  )

  if (!isOpen) return null

  return (
    <div className="quick-switcher-overlay" onClick={onClose}>
      <div
        className="quick-switcher"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="quick-switcher-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="quick-switcher-input"
            placeholder="Jump to file..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
          />
        </div>
        <div className="quick-switcher-list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="quick-switcher-empty">No files found</div>
          )}
          {filtered.map((file, i) => (
            <button
              key={file.path}
              className={`quick-switcher-item ${i === selectedIndex ? 'quick-switcher-item-active' : ''}`}
              onClick={() => {
                onSelect(file.path)
                onClose()
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="quick-switcher-item-name">{file.name}</span>
              {file.dir && (
                <span className="quick-switcher-item-dir">{file.dir}</span>
              )}
            </button>
          ))}
        </div>
        <div className="quick-switcher-footer">
          <span className="quick-switcher-hint">
            <kbd>&uarr;&darr;</kbd> navigate
          </span>
          <span className="quick-switcher-hint">
            <kbd>&crarr;</kbd> open
          </span>
          <span className="quick-switcher-hint">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </div>
  )
}
