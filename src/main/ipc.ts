import { ipcMain, dialog, shell, BrowserWindow } from 'electron'
import { spawn } from 'child_process'
import * as path from 'path'
import { IPC } from '../shared/types'
import { getConfigValue, setConfigValue, getRecentFiles, addRecentFile } from './store'
import {
  readTree,
  readFile,
  writeFile,
  createFile,
  createDir,
  rename,
  searchVault,
  buildGraphData,
  getVaultStats
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

  // Build graph data
  ipcMain.handle(IPC.GRAPH_BUILD, async (_event, vaultPath: string) => {
    return buildGraphData(vaultPath)
  })

  // Get recent files
  ipcMain.handle(IPC.RECENT_GET, () => {
    return getRecentFiles()
  })

  // Add to recent files
  ipcMain.handle(IPC.RECENT_ADD, (_event, filePath: string, fileName: string) => {
    addRecentFile(filePath, fileName)
  })

  // Get vault statistics for dashboard
  ipcMain.handle(IPC.VAULT_STATS, async (_event, vaultPath: string) => {
    return getVaultStats(vaultPath)
  })

  // Run opencode raw-notes-summarizer on a file
  ipcMain.handle(IPC.AI_SUMMARIZE, async (_event, filePath: string) => {
    const dir = path.dirname(filePath)

    // Resolve the full path to the opencode binary so spawn can find it
    // without shell: true (which breaks paths with spaces)
    const opencodeBin = await new Promise<string>((res) => {
      const which = spawn('which', ['opencode'], { shell: true })
      let out = ''
      which.stdout.on('data', (d: Buffer) => { out += d.toString() })
      which.on('close', () => res(out.trim() || 'opencode'))
    })

    const send = (text: string) => {
      mainWindow.webContents.send(IPC.AI_SUMMARIZE_OUTPUT, text)
    }

    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      send('Starting opencode...\n')

      const proc = spawn(
        opencodeBin,
        [
          'run',
          '--format', 'json',
          `Use the raw-notes-summarizer skill to summarize the file at ${filePath}`
        ],
        {
          cwd: dir,
          env: { ...process.env }
        }
      )

      let stderr = ''
      let buffer = ''

      proc.stdout.on('data', (data: Buffer) => {
        buffer += data.toString()
        // Process complete JSON lines
        const lines = buffer.split('\n')
        buffer = lines.pop() || '' // keep incomplete last line
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const event = JSON.parse(line)
            switch (event.type) {
              case 'step_start':
                send('Agent is thinking...\n')
                break
              case 'text':
                if (event.part?.text) {
                  send(event.part.text)
                }
                break
              case 'tool_start':
                if (event.part?.tool) {
                  const name = event.part.tool
                  send(`\n[Tool: ${name}]\n`)
                }
                break
              case 'tool_result':
                if (event.part?.text) {
                  // Truncate long tool results
                  const txt = event.part.text
                  send(txt.length > 300 ? txt.slice(0, 300) + '...\n' : txt + '\n')
                }
                break
              case 'step_finish':
                send('\nStep complete.\n')
                break
              default:
                // Ignore other event types
                break
            }
          } catch {
            // Not valid JSON, send raw
            send(line + '\n')
          }
        }
      })

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString()
        stderr += text
        send(text)
      })

      proc.on('close', (code) => {
        // Process any remaining buffer
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer)
            if (event.type === 'text' && event.part?.text) {
              send(event.part.text)
            }
          } catch {
            send(buffer)
          }
        }

        if (code === 0) {
          send('\n--- Done ---\n')
          resolve({ success: true })
        } else {
          send('\n--- Failed ---\n')
          resolve({ success: false, error: stderr || `Process exited with code ${code}` })
        }
      })

      proc.on('error', (err) => {
        send(`\nError: ${err.message}\n`)
        resolve({ success: false, error: err.message })
      })
    })
  })
}
