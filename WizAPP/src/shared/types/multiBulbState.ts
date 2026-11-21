import { BulbState } from './bulbState'

export interface Room {
  id: string
  name: string
}

export interface AppSettings {
  startWithWindows: boolean
  minimizeToTray: boolean
  theme: 'dark' | 'light' | 'system'
}

export interface MultiBulbState {
  bulbs: BulbState[]
  activeBulb: BulbState | null
  isDiscovering: boolean
  discoveryFailed: boolean
  rooms: Room[]
  settings: AppSettings
}
