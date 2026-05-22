import React, { useEffect, useState } from 'react'
import { RecentFile } from '../../shared/types'

interface EmptyStateProps {
  onFileClick: (filePath: string) => void
}

export function EmptyState({ onFileClick }: EmptyStateProps) {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([])

  useEffect(() => {
    window.api.getRecentFiles().then(setRecentFiles)
  }, [])

  const formatTime = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(timestamp).toLocaleDateString()
  }

  return (
    <div className="empty-state">
      <div className="empty-state-content">
        <h2 className="empty-state-title">ObsidianDupe</h2>
        <p className="empty-state-subtitle">Select a file from the sidebar to start editing</p>

        {recentFiles.length > 0 && (
          <div className="recent-files">
            <h3 className="recent-files-title">Recent Files</h3>
            <div className="recent-files-list">
              {recentFiles.map((file) => (
                <button
                  key={file.path}
                  className="recent-file-item"
                  onClick={() => onFileClick(file.path)}
                >
                  <span className="recent-file-name">{file.name}</span>
                  <span className="recent-file-time">{formatTime(file.openedAt)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="empty-state-shortcuts">
          <h3 className="recent-files-title">Quick Actions</h3>
          <div className="shortcut-grid">
            <div className="shortcut-item">
              <kbd>Cmd+E</kbd>
              <span>Cycle view mode</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+Shift+F</kbd>
              <span>Search vault</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+G</kbd>
              <span>Graph view</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+B</kbd>
              <span>Bold</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+I</kbd>
              <span>Italic</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+K</kbd>
              <span>Insert link</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
