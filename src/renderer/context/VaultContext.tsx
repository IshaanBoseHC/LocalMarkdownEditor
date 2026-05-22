import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface VaultState {
  vaultPath: string | null
  currentFilePath: string | null
  currentFileContent: string
  isDirty: boolean
  setVaultPath: (path: string | null) => void
  setCurrentFile: (path: string | null, content?: string) => void
  setCurrentFileContent: (content: string) => void
  setIsDirty: (dirty: boolean) => void
}

const VaultContext = createContext<VaultState | null>(null)

export function VaultProvider({ children }: { children: ReactNode }) {
  const [vaultPath, setVaultPath] = useState<string | null>(null)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [currentFileContent, setCurrentFileContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)

  const setCurrentFile = useCallback((path: string | null, content?: string) => {
    setCurrentFilePath(path)
    setCurrentFileContent(content ?? '')
    setIsDirty(false)
  }, [])

  return (
    <VaultContext.Provider
      value={{
        vaultPath,
        currentFilePath,
        currentFileContent,
        isDirty,
        setVaultPath,
        setCurrentFile,
        setCurrentFileContent,
        setIsDirty
      }}
    >
      {children}
    </VaultContext.Provider>
  )
}

export function useVault(): VaultState {
  const context = useContext(VaultContext)
  if (!context) {
    throw new Error('useVault must be used within a VaultProvider')
  }
  return context
}
