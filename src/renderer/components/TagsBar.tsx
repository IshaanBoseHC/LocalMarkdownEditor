import React from 'react'

interface TagInfo {
  tag: string
  count: number
}

interface TagsBarProps {
  tags: TagInfo[]
  activeTag: string | null
  onTagClick: (tag: string | null) => void
}

export function TagsBar({ tags, activeTag, onTagClick }: TagsBarProps) {
  if (tags.length === 0) return null

  return (
    <div className="tags-bar">
      {activeTag && (
        <button
          className="tag-chip tag-chip-clear"
          onClick={() => onTagClick(null)}
        >
          Clear filter ×
        </button>
      )}
      {tags.map(({ tag, count }) => (
        <button
          key={tag}
          className={`tag-chip ${activeTag === tag ? 'tag-chip-active' : ''}`}
          onClick={() => onTagClick(activeTag === tag ? null : tag)}
          title={`${count} file${count !== 1 ? 's' : ''}`}
        >
          #{tag}
          <span className="tag-count">{count}</span>
        </button>
      ))}
    </div>
  )
}
