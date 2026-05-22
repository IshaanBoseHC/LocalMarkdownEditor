import * as fs from 'fs/promises'
import * as path from 'path'
import { FileNode, SearchResult } from '../shared/types'

// Read directory tree recursively
export async function readTree(rootPath: string): Promise<FileNode[]> {
  const entries = await fs.readdir(rootPath, { withFileTypes: true })
  const nodes: FileNode[] = []

  // Sort: folders first, then files, both alphabetical
  const sorted = entries
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })

  for (const entry of sorted) {
    const fullPath = path.join(rootPath, entry.name)
    if (entry.isDirectory()) {
      const children = await readTree(fullPath)
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: true,
        children
      })
    } else if (entry.name.endsWith('.md')) {
      nodes.push({
        name: entry.name,
        path: fullPath,
        isDirectory: false
      })
    }
  }

  return nodes
}

// Read file content
export async function readFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

// Write file content
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8')
}

// Create a new file
export async function createFile(dirPath: string, name: string): Promise<string> {
  const filePath = path.join(dirPath, name.endsWith('.md') ? name : `${name}.md`)
  await fs.writeFile(filePath, '', 'utf-8')
  return filePath
}

// Create a new directory
export async function createDir(dirPath: string, name: string): Promise<string> {
  const newPath = path.join(dirPath, name)
  await fs.mkdir(newPath, { recursive: true })
  return newPath
}

// Rename a file or directory
export async function rename(oldPath: string, newPath: string): Promise<void> {
  await fs.rename(oldPath, newPath)
}

// Delete a file or directory (move to trash)
export async function deleteItem(itemPath: string): Promise<void> {
  // We'll use Electron's shell.trashItem in the IPC handler instead
  // This is a fallback that does permanent delete
  const stat = await fs.stat(itemPath)
  if (stat.isDirectory()) {
    await fs.rm(itemPath, { recursive: true })
  } else {
    await fs.unlink(itemPath)
  }
}

// Search across all markdown files in the vault
export async function searchVault(
  vaultPath: string,
  query: string
): Promise<SearchResult[]> {
  const results: SearchResult[] = []
  if (!query.trim()) return results

  const lowerQuery = query.toLowerCase()

  async function walkAndSearch(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await walkAndSearch(fullPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          for (let i = 0; i < lines.length; i++) {
            const lowerLine = lines[i].toLowerCase()
            let idx = lowerLine.indexOf(lowerQuery)
            while (idx !== -1) {
              results.push({
                filePath: fullPath,
                fileName: entry.name,
                line: i + 1,
                content: lines[i],
                matchStart: idx,
                matchEnd: idx + query.length
              })
              idx = lowerLine.indexOf(lowerQuery, idx + 1)
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }

  await walkAndSearch(vaultPath)
  return results
}
