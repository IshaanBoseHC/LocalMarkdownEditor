import React, { useState, useCallback, useRef, useEffect } from 'react'
import { SearchResult } from '../../../shared/types'

interface SearchPanelProps {
  vaultPath: string
  results: SearchResult[]
  searching: boolean
  query: string
  onSearch: (query: string, vaultPath: string) => void
  onClear: () => void
  onResultClick: (filePath: string) => void
}

export function SearchPanel({
  vaultPath,
  results,
  searching,
  query,
  onSearch,
  onClear,
  onResultClick
}: SearchPanelProps) {
  const [inputValue, setInputValue] = useState(query)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      setInputValue(value)

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        if (value.trim()) {
          onSearch(value, vaultPath)
        } else {
          onClear()
        }
      }, 300)
    },
    [vaultPath, onSearch, onClear]
  )

  // Group results by file
  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.filePath]) acc[r.filePath] = []
      acc[r.filePath].push(r)
      return acc
    },
    {} as Record<string, SearchResult[]>
  )

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="Search in vault..."
          value={inputValue}
          onChange={handleChange}
        />
        {inputValue && (
          <button
            className="search-clear"
            onClick={() => {
              setInputValue('')
              onClear()
            }}
          >
            ×
          </button>
        )}
      </div>

      {searching && <div className="search-status">Searching...</div>}

      {!searching && query && (
        <div className="search-status">
          {results.length} match{results.length !== 1 ? 'es' : ''} found
        </div>
      )}

      <div className="search-results">
        {Object.entries(grouped).map(([filePath, matches]) => (
          <div key={filePath} className="search-result-group">
            <div
              className="search-result-file"
              onClick={() => onResultClick(filePath)}
            >
              {matches[0].fileName}
            </div>
            {matches.slice(0, 5).map((match, i) => (
              <div
                key={i}
                className="search-result-line"
                onClick={() => onResultClick(filePath)}
              >
                <span className="search-line-num">L{match.line}</span>
                <span className="search-line-content">
                  {match.content.slice(
                    Math.max(0, match.matchStart - 30),
                    match.matchStart
                  )}
                  <mark>
                    {match.content.slice(match.matchStart, match.matchEnd)}
                  </mark>
                  {match.content.slice(
                    match.matchEnd,
                    match.matchEnd + 30
                  )}
                </span>
              </div>
            ))}
            {matches.length > 5 && (
              <div className="search-more">
                +{matches.length - 5} more matches
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
