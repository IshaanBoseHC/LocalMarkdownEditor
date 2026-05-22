import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'

const configPath = path.join(app.getPath('userData'), 'config.json')

interface AppConfig {
  lastVaultPath?: string
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
