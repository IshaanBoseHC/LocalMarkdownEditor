import React, { useState } from 'react'
import { FileNode } from '../../../shared/types'

interface FileTreeItemProps {
  node: FileNode
  depth: number
  currentFilePath: string | null
  onFileClick: (filePath: string) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
}

function FileTreeItem({
  node,
  depth,
  currentFilePath,
  onFileClick,
  onContextMenu
}: FileTreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0)

  const handleClick = () => {
    if (node.isDirectory) {
      setExpanded(!expanded)
    } else {
      onFileClick(node.path)
    }
  }

  const isActive = node.path === currentFilePath

  return (
    <div className="tree-item-wrapper">
      <div
        className={`tree-item ${isActive ? 'tree-item-active' : ''} ${node.isDirectory ? 'tree-item-dir' : 'tree-item-file'}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, node)}
      >
        <span className="tree-item-icon">
          {node.isDirectory ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="tree-item-name">{node.name}</span>
      </div>
      {node.isDirectory && expanded && node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              currentFilePath={currentFilePath}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface FileTreeProps {
  tree: FileNode[]
  currentFilePath: string | null
  filteredFiles: string[] | null
  onFileClick: (filePath: string) => void
  onCreateFile: (dirPath: string) => void
  onCreateDir: (dirPath: string) => void
  onRename: (node: FileNode) => void
  onDelete: (node: FileNode) => void
}

export function FileTree({
  tree,
  currentFilePath,
  filteredFiles,
  onFileClick,
  onCreateFile,
  onCreateDir,
  onRename,
  onDelete
}: FileTreeProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    node: FileNode
  } | null>(null)

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const closeContextMenu = () => setContextMenu(null)

  // Filter tree if a tag filter is active
  function filterTree(nodes: FileNode[]): FileNode[] {
    if (!filteredFiles) return nodes
    return nodes
      .map((node) => {
        if (node.isDirectory) {
          const filteredChildren = filterTree(node.children || [])
          if (filteredChildren.length === 0) return null
          return { ...node, children: filteredChildren }
        }
        return filteredFiles.includes(node.path) ? node : null
      })
      .filter(Boolean) as FileNode[]
  }

  const displayTree = filterTree(tree)

  return (
    <div className="file-tree" onClick={closeContextMenu}>
      {displayTree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          currentFilePath={currentFilePath}
          onFileClick={onFileClick}
          onContextMenu={handleContextMenu}
        />
      ))}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.node.isDirectory && (
            <>
              <div
                className="context-menu-item"
                onClick={() => {
                  onCreateFile(contextMenu.node.path)
                  closeContextMenu()
                }}
              >
                New File
              </div>
              <div
                className="context-menu-item"
                onClick={() => {
                  onCreateDir(contextMenu.node.path)
                  closeContextMenu()
                }}
              >
                New Folder
              </div>
              <div className="context-menu-separator" />
            </>
          )}
          <div
            className="context-menu-item"
            onClick={() => {
              onRename(contextMenu.node)
              closeContextMenu()
            }}
          >
            Rename
          </div>
          <div
            className="context-menu-item context-menu-item-danger"
            onClick={() => {
              onDelete(contextMenu.node)
              closeContextMenu()
            }}
          >
            Delete
          </div>
        </div>
      )}
    </div>
  )
}
