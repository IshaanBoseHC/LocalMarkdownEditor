import { useState, useCallback } from 'react'
import { FileNode } from '../../shared/types'

export function useFileTree() {
  const [tree, setTree] = useState<FileNode[]>([])
  const [loading, setLoading] = useState(false)

  const loadTree = useCallback(async (vaultPath: string) => {
    setLoading(true)
    try {
      const nodes = await window.api.readTree(vaultPath)
      setTree(nodes)
    } catch (err) {
      console.error('Failed to load file tree:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  return { tree, loading, loadTree }
}
