import * as fs from 'fs/promises'
import * as path from 'path'
import { FileNode, SearchResult, GraphData, GraphNode, GraphLink } from '../shared/types'

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

// Build graph data: scan all files for inter-document links and shared tags
export async function buildGraphData(vaultPath: string): Promise<GraphData> {
  // Step 1: Collect all markdown files and their content
  const fileMap = new Map<string, { name: string; path: string; content: string; tags: string[] }>()

  async function collectFiles(dirPath: string): Promise<void> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        await collectFiles(fullPath)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8')
          const tags = extractTags(content)
          const name = entry.name.replace(/\.md$/, '')
          fileMap.set(fullPath, { name, path: fullPath, content, tags })
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await collectFiles(vaultPath)

  // Step 2: Build a name-to-path lookup for resolving wiki links
  const nameLookup = new Map<string, string>()
  for (const [filePath, info] of fileMap) {
    const lower = info.name.toLowerCase()
    // First match wins; duplicates are ambiguous
    if (!nameLookup.has(lower)) {
      nameLookup.set(lower, filePath)
    }
  }

  // Step 3: Extract links from each file
  const links: GraphLink[] = []
  const linkSet = new Set<string>() // deduplicate

  for (const [sourcePath, info] of fileMap) {
    // Wiki-style links: [[target]] or [[target|alias]]
    const wikiRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let match: RegExpExecArray | null
    while ((match = wikiRegex.exec(info.content)) !== null) {
      const target = match[1].trim()
      const targetPath = resolveLink(target, sourcePath, vaultPath, nameLookup)
      if (targetPath && targetPath !== sourcePath && fileMap.has(targetPath)) {
        const key = [sourcePath, targetPath].sort().join('|')
        if (!linkSet.has(key)) {
          linkSet.add(key)
          links.push({ source: sourcePath, target: targetPath, type: 'wiki' })
        }
      }
    }

    // Markdown links: [text](./path.md) or [text](path.md)
    const mdLinkRegex = /\[(?:[^\]]*)\]\(([^)]+\.md)\)/g
    while ((match = mdLinkRegex.exec(info.content)) !== null) {
      const href = match[1].trim()
      // Resolve relative path
      const sourceDir = path.dirname(sourcePath)
      const targetPath = path.resolve(sourceDir, href)
      if (targetPath !== sourcePath && fileMap.has(targetPath)) {
        const key = [sourcePath, targetPath].sort().join('|')
        if (!linkSet.has(key)) {
          linkSet.add(key)
          links.push({ source: sourcePath, target: targetPath, type: 'markdown' })
        }
      }
    }
  }

  // Step 4: Find shared tags and create tag-based links
  const tagToFiles = new Map<string, string[]>()
  for (const [filePath, info] of fileMap) {
    for (const tag of info.tags) {
      if (!tagToFiles.has(tag)) tagToFiles.set(tag, [])
      tagToFiles.get(tag)!.push(filePath)
    }
  }
  for (const [, files] of tagToFiles) {
    if (files.length < 2 || files.length > 20) continue // skip very common tags
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = [files[i], files[j]].sort().join('|')
        if (!linkSet.has(key)) {
          linkSet.add(key)
          links.push({ source: files[i], target: files[j], type: 'tag' })
        }
      }
    }
  }

  // Step 5: Count connections per node
  const connectionCount = new Map<string, number>()
  for (const link of links) {
    connectionCount.set(link.source, (connectionCount.get(link.source) || 0) + 1)
    connectionCount.set(link.target, (connectionCount.get(link.target) || 0) + 1)
  }

  // Step 6: Build nodes
  const nodes: GraphNode[] = Array.from(fileMap.entries()).map(([filePath, info]) => ({
    id: filePath,
    name: info.name,
    path: filePath,
    tags: info.tags,
    linkCount: connectionCount.get(filePath) || 0
  }))

  return { nodes, links }
}

// Extract #tags from content
function extractTags(content: string): string[] {
  const tagRegex = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_/-]*)/g
  const tags: string[] = []
  let match: RegExpExecArray | null
  while ((match = tagRegex.exec(content)) !== null) {
    tags.push(match[1].toLowerCase())
  }
  return [...new Set(tags)]
}

// Resolve a link target to a file path
function resolveLink(
  target: string,
  sourcePath: string,
  vaultPath: string,
  nameLookup: Map<string, string>
): string | null {
  // Try exact name match (case-insensitive)
  const lower = target.toLowerCase().replace(/\.md$/, '')
  if (nameLookup.has(lower)) {
    return nameLookup.get(lower)!
  }

  // Try as a relative path from source
  const sourceDir = path.dirname(sourcePath)
  const asRelative = path.resolve(sourceDir, target.endsWith('.md') ? target : target + '.md')
  try {
    // Check if file exists synchronously (we're already in async context)
    return nameLookup.has(path.basename(asRelative, '.md').toLowerCase())
      ? nameLookup.get(path.basename(asRelative, '.md').toLowerCase())!
      : null
  } catch {
    return null
  }
}
