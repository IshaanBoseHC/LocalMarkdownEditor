import { useCallback, useRef } from 'react'
import { useVault } from '../context/VaultContext'

export function useFileContent() {
  const { setCurrentFile, setCurrentFileContent, setIsDirty } = useVault()
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openFile = useCallback(
    async (filePath: string) => {
      try {
        const content = await window.api.readFile(filePath)
        setCurrentFile(filePath, content)
      } catch (err) {
        console.error('Failed to open file:', err)
      }
    },
    [setCurrentFile]
  )

  const saveFile = useCallback(
    async (filePath: string, content: string) => {
      try {
        await window.api.writeFile(filePath, content)
        setIsDirty(false)
      } catch (err) {
        console.error('Failed to save file:', err)
      }
    },
    [setIsDirty]
  )

  const updateContent = useCallback(
    (filePath: string, content: string) => {
      setCurrentFileContent(content)
      setIsDirty(true)

      // Debounced auto-save (1 second)
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = setTimeout(() => {
        saveFile(filePath, content)
      }, 1000)
    },
    [setCurrentFileContent, setIsDirty, saveFile]
  )

  return { openFile, saveFile, updateContent }
}
