// Represents a file or folder in the vault tree
export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
  children?: FileNode[]
}

// Result from full-text search
export interface SearchResult {
  filePath: string
  fileName: string
  line: number
  content: string
  matchStart: number
  matchEnd: number
}

// Graph view types
export interface GraphNode {
  id: string        // file path
  name: string      // file name without extension
  path: string      // full path
  tags: string[]    // #tags found in the file
  linkCount: number // total connections
}

export interface GraphLink {
  source: string    // source file path
  target: string    // target file path
  type: 'wiki' | 'markdown' | 'tag' // relationship type
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

// Recent file entry
export interface RecentFile {
  path: string
  name: string
  openedAt: number  // timestamp
}

// Vault statistics for dashboard
export interface VaultStats {
  totalNotes: number
  totalFolders: number
  totalWords: number
  totalCharacters: number
  // Per-file info for charts
  files: {
    path: string
    name: string
    words: number
    characters: number
    createdAt: number   // birthtime ms
    modifiedAt: number  // mtime ms
    tags: string[]
    size: number        // bytes
  }[]
  // Aggregated tag counts
  tagCounts: { tag: string; count: number }[]
  // Daily activity: { "YYYY-MM-DD": count } for the last 365 days
  dailyCreated: Record<string, number>
  dailyModified: Record<string, number>
}

// IPC channel names
export const IPC = {
  VAULT_OPEN: 'vault:open',
  VAULT_GET_LAST: 'vault:getLast',
  FS_READ_TREE: 'fs:readTree',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  FS_CREATE_FILE: 'fs:createFile',
  FS_CREATE_DIR: 'fs:createDir',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  SEARCH_QUERY: 'search:query',
  FS_WATCH_EVENT: 'fs:watchEvent',
  GRAPH_BUILD: 'graph:build',
  RECENT_GET: 'recent:get',
  RECENT_ADD: 'recent:add',
  VAULT_STATS: 'vault:stats'
} as const
