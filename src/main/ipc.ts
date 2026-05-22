import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { IPC } from '../shared/types'
import { getConfigValue, setConfigValue } from './store'
import {
  readTree,
  readFile,
  writeFile,
  createFile,
  createDir,
  rename,
  searchVault
} from './fileSystem'

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Open vault folder picker
  ipcMain.handle(IPC.VAULT_OPEN, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Open Vault Folder'
    })
    if (result.canceled || result.filePaths.length === 0) {
      return null
    }
    const vaultPath = result.filePaths[0]
    setConfigValue('lastVaultPath', vaultPath)
    return vaultPath
  })

  // Get last used vault path
  ipcMain.handle(IPC.VAULT_GET_LAST, () => {
    return getConfigValue('lastVaultPath') || null
  })

  // Read directory tree
  ipcMain.handle(IPC.FS_READ_TREE, async (_event, rootPath: string) => {
    return readTree(rootPath)
  })

  // Read file content
  ipcMain.handle(IPC.FS_READ_FILE, async (_event, filePath: string) => {
    return readFile(filePath)
  })

  // Write file content
  ipcMain.handle(IPC.FS_WRITE_FILE, async (_event, filePath: string, content: string) => {
    return writeFile(filePath, content)
  })

  // Create new file
  ipcMain.handle(IPC.FS_CREATE_FILE, async (_event, dirPath: string, name: string) => {
    return createFile(dirPath, name)
  })

  // Create new directory
  ipcMain.handle(IPC.FS_CREATE_DIR, async (_event, dirPath: string, name: string) => {
    return createDir(dirPath, name)
  })

  // Rename file or directory
  ipcMain.handle(IPC.FS_RENAME, async (_event, oldPath: string, newPath: string) => {
    return rename(oldPath, newPath)
  })

  // Delete file or directory (move to trash)
  ipcMain.handle(IPC.FS_DELETE, async (_event, itemPath: string) => {
    await shell.trashItem(itemPath)
  })

  // Search across vault
  ipcMain.handle(IPC.SEARCH_QUERY, async (_event, query: string, vaultPath: string) => {
    return searchVault(vaultPath, query)
  })
}
