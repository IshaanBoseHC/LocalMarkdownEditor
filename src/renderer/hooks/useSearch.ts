import { useState, useCallback } from 'react'
import { SearchResult } from '../../shared/types'

export function useSearch() {
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')

  const search = useCallback(async (searchQuery: string, vaultPath: string) => {
    setQuery(searchQuery)
    if (!searchQuery.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    try {
      const searchResults = await window.api.search(searchQuery, vaultPath)
      setResults(searchResults)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return { results, searching, query, search, clearSearch }
}
