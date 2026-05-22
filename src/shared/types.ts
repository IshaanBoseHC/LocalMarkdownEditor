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
  FS_WATCH_EVENT: 'fs:watchEvent'
} as const
