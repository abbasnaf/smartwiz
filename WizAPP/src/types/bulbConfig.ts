import { BulbState } from '@shared/types/bulbState'
import { CustomColor } from '@shared/types/customColor'

export interface BulbConfigEntry {
  bulbIp: string
  bulbName: string
  mac?: string
  roomId?: string | null
}

export interface RoomConfig {
  id: string
  name: string
}

export interface AppSettings {
  startWithWindows: boolean
  minimizeToTray: boolean
  theme: 'dark' | 'light' | 'system'
}

export interface AppConfig {
  bulbs: BulbConfigEntry[]
  activeBulbIp: string | null
  customColors: CustomColor[]
  favoriteColors: Array<BulbState['sceneId']>
  rooms?: RoomConfig[]
  settings?: AppSettings
}
