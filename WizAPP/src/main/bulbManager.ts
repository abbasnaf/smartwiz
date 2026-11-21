import { AppConfig, AppSettings, BulbConfigEntry, RoomConfig } from '@/types/bulbConfig'
import { systemConfig } from '@/types/systemConfig'
import { CONFIG, DISCOVER_TIMEOUT } from '@constants'
import { Bulb, discover, SCENES } from '@lib/wikari/src/mod'
import { MAX_DEFAULT_COLORS } from '@shared/constants'
import { BulbState } from '@shared/types/bulbState'
import { MultiBulbState } from '@shared/types/multiBulbState'
import { ToastMessage } from '@shared/types/toastMessage'
import { randomUUID } from 'crypto'
import { app, BrowserWindow } from 'electron'
import log from 'electron-log'
import fs from 'fs'

const MAX_DISCOVERY_RETRIES = 3
const DISCOVERY_RETRY_DELAY_MS = 5000

/**
    Decorator that updates the view after the method is executed.
    Also catches if the connection is lost.
*/
function needsViewUpdate(actionName: string) {
  return function (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: never[]) {
      const instance = this as BulbManager
      try {
        log.info(`Executing: ${actionName}`)
        await originalMethod.apply(this, args)
        instance.sendStateToRenderer()
      } catch (error) {
        log.error(`Failed to ${actionName}:`, error)
        // Try to reconnect the active bulb
        const activeBulb = instance.getActiveBulb()
        if (activeBulb) {
          await instance.reconnectBulb(activeBulb.ip)
        }
      }
    }
  }
}

class BulbManager {
  // Map of connected bulbs keyed by IP
  private bulbs: Map<string, Bulb> = new Map()
  private bulbStates: Map<string, BulbState> = new Map()

  // App-level config
  private appData: AppConfig

  // Active bulb
  private activeBulbIp: string | null = null

  // Discovery state
  private isDiscovering: boolean = false
  private discoveryFailed: boolean = false

  // Window reference
  public window: BrowserWindow

  private commandQueues: Map<string, Promise<void>> = new Map()
  private brightnessTimers: Map<string, NodeJS.Timeout> = new Map()

  constructor(window: BrowserWindow) {
    this.window = window
    this.appData = this.getConfigData()
    this.init()
  }

  private async init() {
    await this.discoverBulbs()
  }

  // --- Config ---

  private getDefaultSettings(): AppSettings {
    return { startWithWindows: false, minimizeToTray: true, theme: 'dark' }
  }

  private getConfigData(): AppConfig {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'))

      if (
        raw &&
        Array.isArray(raw.bulbs) &&
        Array.isArray(raw.customColors) &&
        Array.isArray(raw.favoriteColors)
      ) {
        log.info('Valid config found with', raw.bulbs.length, 'bulb entries')
        const config = raw as AppConfig
        config.rooms = Array.isArray(config.rooms) ? config.rooms : []
        config.settings = { ...this.getDefaultSettings(), ...(config.settings || {}) }
        config.bulbs = config.bulbs.map((b) => ({ ...b, roomId: b.roomId ?? null }))
        return config
      }

      log.warn('Config format does not match expected shape, overwriting with fresh config')
    } catch {
      log.warn('Config not found or unreadable, creating new config')
    }

    return {
      bulbs: [],
      activeBulbIp: null,
      customColors: [],
      favoriteColors: [
        SCENES['Warm White'],
        SCENES['Daylight'],
        SCENES['Night Light'],
        SCENES['Cozy']
      ],
      rooms: [],
      settings: this.getDefaultSettings()
    }
  }

  private saveConfig() {
    const bulbEntries: BulbConfigEntry[] = []
    for (const [ip, state] of this.bulbStates) {
      const saved = this.appData.bulbs.find((b) => b.bulbIp === ip || (b.mac && b.mac === state.mac))
      bulbEntries.push({
        bulbIp: ip,
        bulbName: state.name,
        mac: state.mac || saved?.mac,
        roomId: state.appRoomId ?? saved?.roomId ?? null
      })
    }

    this.appData.bulbs = bulbEntries
    this.appData.activeBulbIp = this.activeBulbIp
    this.appData.rooms = this.appData.rooms || []
    this.appData.settings = this.appData.settings || this.getDefaultSettings()
    fs.writeFileSync(CONFIG, JSON.stringify(this.appData))
  }

  private deleteConfig() {
    try {
      fs.unlinkSync(CONFIG)
    } catch {
      log.warn('Config file not found to delete')
    }
  }

  // --- Discovery ---

  async discoverBulbs() {
    this.isDiscovering = true
    this.discoveryFailed = false
    this.sendStateToRenderer()

    const savedIps = this.appData.bulbs.map((b) => b.bulbIp)

    // Phase 1: Try saved IPs from config
    if (savedIps.length > 0) {
      log.info('Phase 1: Trying', savedIps.length, 'saved IPs from config')

      for (let attempt = 0; attempt < MAX_DISCOVERY_RETRIES; attempt++) {
        for (const ip of savedIps) {
          if (this.bulbs.has(ip)) continue // Already connected

          try {
            const res = await discover({ addr: ip, waitMs: DISCOVER_TIMEOUT })
            if (res.length > 0) {
              await this.connectBulb(res[0], ip)
            }
          } catch (error) {
            log.warn('Error discovering bulb at IP:', ip, error)
          }
        }

        // If we found at least one, we're good
        if (this.bulbs.size > 0) {
          log.info('Phase 1: Connected to', this.bulbs.size, 'bulb(s) from saved IPs')
          break
        }

        if (attempt < MAX_DISCOVERY_RETRIES - 1) {
          log.info(`Phase 1: Retry ${attempt + 1}/${MAX_DISCOVERY_RETRIES}`)
          await this.delay(DISCOVERY_RETRY_DELAY_MS)
        }
      }
    }

    // Phase 2: General broadcast (only if no bulbs found from saved IPs)
    if (this.bulbs.size === 0) {
      log.info('Phase 2: Trying general broadcast discovery')

      for (let attempt = 0; attempt < MAX_DISCOVERY_RETRIES; attempt++) {
        try {
          const res = await discover({ waitMs: DISCOVER_TIMEOUT })
          for (const bulb of res) {
            const ip = bulb.address
            if (!this.bulbs.has(ip)) {
              await this.connectBulb(bulb, ip)
            }
          }
        } catch (error) {
          log.error('Error during broadcast discovery:', error)
        }

        if (this.bulbs.size > 0) {
          log.info('Phase 2: Found', this.bulbs.size, 'bulb(s) via broadcast')
          break
        }

        if (attempt < MAX_DISCOVERY_RETRIES - 1) {
          log.info(`Phase 2: Retry ${attempt + 1}/${MAX_DISCOVERY_RETRIES}`)
          await this.delay(DISCOVERY_RETRY_DELAY_MS)
        }
      }
    }

    // Finalize discovery
    this.isDiscovering = false

    if (this.bulbs.size === 0) {
      this.discoveryFailed = true
      log.error('Discovery failed: no bulbs found after all retries')
      this.sendToast({
        id: randomUUID(),
        message: 'toast.discoveryFailed',
        type: 'error',
        autoDismiss: false,
        retryAction: 'retry-discovery'
      })
    }

    // Set active bulb
    if (this.bulbs.size > 0 && !this.activeBulbIp) {
      // Try to restore from config, otherwise pick the first one
      if (this.appData.activeBulbIp && this.bulbStates.has(this.appData.activeBulbIp)) {
        this.activeBulbIp = this.appData.activeBulbIp
      } else {
        this.activeBulbIp = this.bulbStates.keys().next().value ?? null
      }
    }

    this.saveConfig()
    this.sendStateToRenderer()
  }

  private async connectBulb(bulb: Bulb, ip: string) {
    try {
      const state = await this.setUpSingleBulb(bulb, ip)

      // Handle IP change: if same MAC exists under different IP, replace old entry
      if (state.mac) {
        for (const [oldIp, oldState] of this.bulbStates.entries()) {
          if (oldIp !== ip && oldState.mac === state.mac) {
            this.bulbs.delete(oldIp)
            this.bulbStates.delete(oldIp)
            if (this.activeBulbIp === oldIp) this.activeBulbIp = ip
            log.info('Updated bulb IP for MAC', state.mac, 'from', oldIp, 'to', ip)
          }
        }
      }

      this.bulbs.set(ip, bulb)
      this.bulbStates.set(ip, state)

      if (!this.activeBulbIp) {
        this.activeBulbIp = ip
      }

      log.info('Connected to bulb at', ip, '- Name:', state.name)
      this.sendStateToRenderer()
    } catch (error) {
      log.error('Failed to set up bulb at', ip, ':', error)
    }
  }

  private async setUpSingleBulb(bulb: Bulb, ip: string): Promise<BulbState> {
    const pilot = (await bulb.getPilot()).result
    const bulbConfig = (await bulb.sendRaw({
      method: 'getSystemConfig',
      env: '',
      params: { mac: '', rssi: 0 }
    })) as systemConfig

    const configResult = bulbConfig.result

    const mac = (pilot as any).mac || (configResult as any).mac || ''
    const savedEntry = this.appData.bulbs.find((b) => b.bulbIp === ip || (mac && b.mac === mac))
    const name = savedEntry?.bulbName || configResult.moduleName

    return {
      ...pilot,
      ...configResult,
      mac,
      ip: ip,
      port: bulb.bulbPort,
      name: name,
      customColors: this.appData.customColors,
      favoriteColors: this.appData.favoriteColors,
      appRoomId: savedEntry?.roomId ?? null
    }
  }

  // --- State management ---

  public getActiveBulb(): BulbState | null {
    if (!this.activeBulbIp) return null
    return this.bulbStates.get(this.activeBulbIp) ?? null
  }

  private getActiveBulbInstance(): Bulb | null {
    if (!this.activeBulbIp) return null
    return this.bulbs.get(this.activeBulbIp) ?? null
  }

  public getSettings(): AppSettings {
    return this.appData.settings || this.getDefaultSettings()
  }

  public getMultiBulbState(): MultiBulbState {
    return {
      bulbs: Array.from(this.bulbStates.values()),
      activeBulb: this.getActiveBulb(),
      isDiscovering: this.isDiscovering,
      discoveryFailed: this.discoveryFailed,
      rooms: this.appData.rooms || [],
      settings: this.getSettings()
    }
  }

  public sendStateToRenderer() {
    this.window.webContents.send('on-update-bulb', this.getMultiBulbState())
  }

  private sendToast(toast: ToastMessage) {
    this.window.webContents.send('on-show-toast', toast)
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // --- Public actions: Multi-bulb ---

  public setActiveBulb(ip: string) {
    if (!this.bulbStates.has(ip)) {
      log.warn('Cannot set active bulb: IP not found:', ip)
      return
    }
    this.activeBulbIp = ip
    this.saveConfig()
    this.sendStateToRenderer()
  }

  @needsViewUpdate('toggle bulb by IP')
  public async toggleBulbByIp(ip: string) {
    const bulb = this.bulbs.get(ip)
    const state = this.bulbStates.get(ip)
    if (!bulb || !state) return

    await bulb.toggle()
    state.state = !state.state
  }

  public async addBulbByIp(ip: string) {
    // Check if already connected
    if (this.bulbs.has(ip)) {
      log.info('Bulb at', ip, 'already exists, ignoring')
      this.sendToast({
        id: randomUUID(),
        message: 'toast.addDuplicate',
        type: 'info',
        autoDismiss: true
      })
      return
    }

    try {
      const res = await discover({ addr: ip, waitMs: DISCOVER_TIMEOUT })
      if (res.length > 0) {
        await this.connectBulb(res[0], ip)
        this.saveConfig()

        this.sendToast({
          id: randomUUID(),
          message: 'toast.addSuccess',
          type: 'success',
          autoDismiss: true
        })
      } else {
        this.sendToast({
          id: randomUUID(),
          message: 'toast.addFailed',
          type: 'error',
          autoDismiss: true
        })
      }
    } catch (error) {
      log.error('Failed to add bulb by IP:', ip, error)
      this.sendToast({
        id: randomUUID(),
        message: 'toast.addFailed',
        type: 'error',
        autoDismiss: true
      })
    }
  }

  public async retryDiscovery() {
    // Clear previous state
    this.bulbs.clear()
    this.bulbStates.clear()
    this.activeBulbIp = null
    this.discoveryFailed = false

    await this.discoverBulbs()
  }

  public async reconnectBulb(ip: string) {
    // Remove from maps
    this.bulbs.delete(ip)
    this.bulbStates.delete(ip)

    // If this was the active bulb, reassign
    if (this.activeBulbIp === ip) {
      this.activeBulbIp = this.bulbStates.keys().next().value ?? null
    }

    this.sendStateToRenderer()

    // Try to reconnect
    try {
      const res = await discover({ addr: ip, waitMs: DISCOVER_TIMEOUT })
      if (res.length > 0) {
        await this.connectBulb(res[0], ip)
        this.saveConfig()
      }
    } catch (error) {
      log.error('Failed to reconnect to bulb at', ip, ':', error)
    }
  }

  // --- Public actions: Active bulb operations ---

  @needsViewUpdate('toggle active bulb')
  public async toggleBulb() {
    const bulb = this.getActiveBulbInstance()
    const state = this.getActiveBulb()
    if (!bulb || !state) return

    await bulb.toggle()
    state.state = !state.state
  }

  @needsViewUpdate('set brightness')
  public async setBrightness(brightness: number) {
    const bulb = this.getActiveBulbInstance()
    const state = this.getActiveBulb()
    if (!bulb || !state) return

    await bulb.brightness(brightness)
    state.dimming = brightness
  }

  @needsViewUpdate('set bulb name')
  public setBulbName(name: string, ip?: string) {
    const targetIp = ip || this.activeBulbIp
    if (!targetIp) return

    const state = this.bulbStates.get(targetIp)
    if (!state) return

    state.name = name
    this.saveConfig()
  }

  @needsViewUpdate('set scene')
  public async setScene(sceneId: number) {
    const bulb = this.getActiveBulbInstance()
    const state = this.getActiveBulb()
    if (!bulb || !state) return

    state.state = true
    await bulb.scene(sceneId)
    state.sceneId = sceneId
  }

  private getCustomColorNewId() {
    if (this.appData.customColors.length === 0) return MAX_DEFAULT_COLORS

    const ids = this.appData.customColors.map((color) => color.id)
    return Math.max(...ids) + 1
  }

  @needsViewUpdate('toggle favorite color')
  public async toggleFavoriteColor(colorId: number) {
    if (this.appData.favoriteColors.includes(colorId)) {
      this.appData.favoriteColors = this.appData.favoriteColors.filter((id) => id !== colorId)
    } else {
      this.appData.favoriteColors.push(colorId)
    }
    this.syncGlobalColorsToStates()
    this.saveConfig()
  }

  @needsViewUpdate('add custom color')
  public async addCustomColor(colorName: string, colorHex: string) {
    const newId = this.getCustomColorNewId()
    this.appData.customColors.push({ id: newId, name: colorName, hex: colorHex })
    this.syncGlobalColorsToStates()
    this.saveConfig()
  }

  @needsViewUpdate('set custom color')
  public async setCustomColor(colorId: number) {
    const bulb = this.getActiveBulbInstance()
    const state = this.getActiveBulb()
    if (!bulb || !state) return

    const color = this.appData.customColors.find((c) => c.id === colorId)
    if (!color) return

    state.state = true
    state.sceneId = colorId
    await bulb.color(color.hex as `#${string}`)
  }

  @needsViewUpdate('edit custom color')
  public async editCustomColor(colorId: number, colorName: string, colorHex: string) {
    const color = this.appData.customColors.find((c) => c.id === colorId)
    if (!color) return

    color.name = colorName
    color.hex = colorHex
    this.syncGlobalColorsToStates()
    this.saveConfig()
  }

  @needsViewUpdate('remove custom color')
  public async removeCustomColor(colorId: number) {
    this.appData.customColors = this.appData.customColors.filter((c) => c.id !== colorId)
    this.appData.favoriteColors = this.appData.favoriteColors.filter((id) => id !== colorId)
    this.syncGlobalColorsToStates()
    this.saveConfig()
  }

  @needsViewUpdate('set favorite colors order')
  public async setFavoriteColorsOrder(favoriteColors: number[]) {
    log.info('Setting favorite colors order:', favoriteColors)
    this.appData.favoriteColors = favoriteColors
    this.syncGlobalColorsToStates()
    this.saveConfig()
  }

  /**
   * Sync global customColors and favoriteColors into all BulbState instances
   * so the renderer always has up-to-date data.
   */
  private syncGlobalColorsToStates() {
    for (const state of this.bulbStates.values()) {
      state.customColors = this.appData.customColors
      state.favoriteColors = this.appData.favoriteColors
    }
  }

  // --- Delete operations ---

  @needsViewUpdate('delete bulb')
  public deleteBulb(ip?: string) {
    const targetIp = ip || this.activeBulbIp
    if (!targetIp) return

    // Do NOT call closeConnection() here — it uses static state and would
    // close the global UDP socket, breaking ALL bulb instances.
    // Just remove from our maps.
    this.bulbs.delete(targetIp)
    this.bulbStates.delete(targetIp)

    // Remove from saved config so re-adding works clean
    this.appData.bulbs = this.appData.bulbs.filter((b) => b.bulbIp !== targetIp)

    // Reassign active if needed
    if (this.activeBulbIp === targetIp) {
      this.activeBulbIp = this.bulbStates.keys().next().value ?? null
    }

    log.info('Bulb deleted:', targetIp)
    this.saveConfig()
  }

  @needsViewUpdate('delete profile')
  public deleteProfile() {
    // Do NOT call endConnection() here — it closes the static UDP socket,
    // making it impossible to create new Bulb instances afterwards.
    // Just clear our maps and let the socket stay open.
    this.bulbs.clear()
    this.bulbStates.clear()
    this.activeBulbIp = null

    log.info('Profile deleted')
    this.deleteConfig()
    this.appData = this.getConfigData()
    this.init()
  }

  // --- Rooms & Settings ---

  public getRooms(): RoomConfig[] {
    return this.appData.rooms || []
  }

  public createRoom(name: string) {
    const room = { id: randomUUID(), name: name.trim() || 'Room' }
    this.appData.rooms = [...(this.appData.rooms || []), room]
    this.saveConfig()
    this.sendStateToRenderer()
  }

  public renameRoom(roomId: string, name: string) {
    this.appData.rooms = (this.appData.rooms || []).map((r) => (r.id === roomId ? { ...r, name: name.trim() || r.name } : r))
    this.saveConfig()
    this.sendStateToRenderer()
  }

  public deleteRoom(roomId: string) {
    this.appData.rooms = (this.appData.rooms || []).filter((r) => r.id !== roomId)
    for (const state of this.bulbStates.values()) {
      if (state.appRoomId === roomId) state.appRoomId = null
    }
    this.saveConfig()
    this.sendStateToRenderer()
  }

  public assignBulbRoom(ip: string, roomId: string | null) {
    const state = this.bulbStates.get(ip)
    if (!state) return
    state.appRoomId = roomId
    this.saveConfig()
    this.sendStateToRenderer()
  }

  public setSettings(settings: Partial<AppSettings>) {
    this.appData.settings = { ...this.getSettings(), ...settings }
    this.applyStartupSetting(this.appData.settings.startWithWindows)
    this.saveConfig()
    this.sendStateToRenderer()
  }

  public applyStartupSetting(enabled: boolean) {
    if (process.platform !== 'win32') return
    app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
  }

  private enqueue(ip: string, fn: () => Promise<void>): Promise<void> {
    const prev = this.commandQueues.get(ip) || Promise.resolve()
    const next = prev.then(fn, fn).catch((e) => { log.error('Queued command failed for', ip, e) })
    this.commandQueues.set(ip, next)
    return next
  }

  // --- Group actions ---

  public async groupSetPower(ips: string[], on: boolean) {
    await Promise.all(ips.map((ip) => this.enqueue(ip, async () => {
      const bulb = this.bulbs.get(ip)
      const state = this.bulbStates.get(ip)
      if (!bulb || !state) return
      if (state.state !== on) await bulb.toggle()
      state.state = on
    })))
    this.sendStateToRenderer()
  }

  public async groupSetBrightness(ips: string[], brightness: number) {
    const value = Math.max(10, Math.min(100, Math.round(brightness)))
    for (const ip of ips) {
      const state = this.bulbStates.get(ip)
      if (state) state.dimming = value
      const existing = this.brightnessTimers.get(ip)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        this.brightnessTimers.delete(ip)
        void this.enqueue(ip, async () => {
          const bulb = this.bulbs.get(ip)
          const st = this.bulbStates.get(ip)
          if (!bulb || !st) return
          await bulb.brightness(value)
          st.dimming = value
          this.sendStateToRenderer()
        })
      }, 250)
      this.brightnessTimers.set(ip, timer)
    }
    this.sendStateToRenderer()
  }

  public async groupSetScene(ips: string[], sceneId: number) {
    await Promise.all(ips.map((ip) => this.enqueue(ip, async () => {
      const bulb = this.bulbs.get(ip)
      const state = this.bulbStates.get(ip)
      if (!bulb || !state) return
      await bulb.scene(sceneId)
      state.sceneId = sceneId
      state.state = true
    })))
    this.sendStateToRenderer()
  }

  public async groupSetColor(ips: string[], hex: string) {
    await Promise.all(ips.map(async (ip) => {
      try {
        const bulb = this.bulbs.get(ip)
        const state = this.bulbStates.get(ip)
        if (!bulb || !state) throw new Error('Bulb not found')
        await bulb.color(hex as `#${string}`)
        state.state = true
      } catch (e) {
        log.error('Group color failed for', ip, e)
      }
    }))
    this.sendStateToRenderer()
  }

  // --- Cleanup ---

  public endConnection() {
    for (const [ip, bulb] of this.bulbs) {
      try {
        bulb.closeConnection()
        log.info('Closed connection for bulb at', ip)
      } catch {
        // ignore
      }
    }
  }
}

export default BulbManager
