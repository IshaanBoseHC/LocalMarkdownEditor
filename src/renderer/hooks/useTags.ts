import { useState, useCallback, useMemo } from 'react'

interface TagInfo {
  tag: string
  count: number
  files: string[]
}

// Extract #tags from content
function extractTags(content: string): string[] {
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g
  const tags: string[] = []
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase())
  }
  return [...new Set(tags)]
}

export function useTags() {
  const [tagMap, setTagMap] = useState<Map<string, Set<string>>>(new Map())
  const [activeTag, setActiveTag] = useState<string | null>(null)

  // Register tags found in a file
  const registerFileTags = useCallback((filePath: string, content: string) => {
    const tags = extractTags(content)
    setTagMap((prev) => {
      const next = new Map(prev)
      // Remove old entries for this file
      for (const [tag, files] of next) {
        files.delete(filePath)
        if (files.size === 0) next.delete(tag)
      }
      // Add new tags
      for (const tag of tags) {
        if (!next.has(tag)) next.set(tag, new Set())
        next.get(tag)!.add(filePath)
      }
      return next
    })
  }, [])

  // All tags sorted by count
  const allTags: TagInfo[] = useMemo(() => {
    return Array.from(tagMap.entries())
      .map(([tag, files]) => ({ tag, count: files.size, files: Array.from(files) }))
      .sort((a, b) => b.count - a.count)
  }, [tagMap])

  // Files matching the active tag
  const filteredFiles: string[] | null = useMemo(() => {
    if (!activeTag) return null
    const files = tagMap.get(activeTag)
    return files ? Array.from(files) : []
  }, [activeTag, tagMap])

  return { allTags, activeTag, setActiveTag, filteredFiles, registerFileTags }
}
