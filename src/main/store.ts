import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { RecentFile } from '../shared/types'

const configPath = path.join(app.getPath('userData'), 'config.json')

const MAX_RECENT_FILES = 20

interface AppConfig {
  lastVaultPath?: string
  recentFiles?: RecentFile[]
}

function readConfig(): AppConfig {
  try {
    const data = fs.readFileSync(configPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return {}
  }
}

function writeConfig(config: AppConfig): void {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return readConfig()[key]
}

export function setConfigValue<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  const config = readConfig()
  config[key] = value
  writeConfig(config)
}

export function getRecentFiles(): RecentFile[] {
  return readConfig().recentFiles || []
}

export function addRecentFile(filePath: string, fileName: string): void {
  const config = readConfig()
  const recents = config.recentFiles || []

  // Remove existing entry for this path
  const filtered = recents.filter((r) => r.path !== filePath)

  // Add to front
  filtered.unshift({
    path: filePath,
    name: fileName,
    openedAt: Date.now()
  })

  // Cap at max
  config.recentFiles = filtered.slice(0, MAX_RECENT_FILES)
  writeConfig(config)
}
