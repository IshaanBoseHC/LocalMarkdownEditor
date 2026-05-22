import { contextBridge, ipcRenderer } from 'electron'
import { IPC, FileNode, SearchResult } from '../shared/types'

const api = {
  // Vault
  openVault: (): Promise<string | null> => ipcRenderer.invoke(IPC.VAULT_OPEN),
  getLastVault: (): Promise<string | null> => ipcRenderer.invoke(IPC.VAULT_GET_LAST),

  // File system
  readTree: (rootPath: string): Promise<FileNode[]> =>
    ipcRenderer.invoke(IPC.FS_READ_TREE, rootPath),
  readFile: (filePath: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
  writeFile: (filePath: string, content: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_WRITE_FILE, filePath, content),
  createFile: (dirPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_CREATE_FILE, dirPath, name),
  createDir: (dirPath: string, name: string): Promise<string> =>
    ipcRenderer.invoke(IPC.FS_CREATE_DIR, dirPath, name),
  rename: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_RENAME, oldPath, newPath),
  delete: (itemPath: string): Promise<void> =>
    ipcRenderer.invoke(IPC.FS_DELETE, itemPath),

  // Search
  search: (query: string, vaultPath: string): Promise<SearchResult[]> =>
    ipcRenderer.invoke(IPC.SEARCH_QUERY, query, vaultPath),

  // Watch events (main -> renderer)
  onFsChange: (callback: (event: string, path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, changeType: string, changePath: string) => {
      callback(changeType, changePath)
    }
    ipcRenderer.on(IPC.FS_WATCH_EVENT, handler)
    return () => {
      ipcRenderer.removeListener(IPC.FS_WATCH_EVENT, handler)
    }
  }
}

contextBridge.exposeInMainWorld('api', api)

// Type declaration for the renderer
export type ElectronAPI = typeof api
