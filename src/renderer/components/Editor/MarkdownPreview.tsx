import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  content: string
  filePath: string | null
}

export function MarkdownPreview({ content, filePath }: MarkdownPreviewProps) {
  if (!filePath) {
    return (
      <div className="preview-empty">
        <p>No file selected</p>
      </div>
    )
  }

  return (
    <div className="preview-container">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </div>
  )
}
