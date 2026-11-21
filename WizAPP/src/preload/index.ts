import { electronAPI } from '@electron-toolkit/preload'
import { MultiBulbState } from '@shared/types/multiBulbState'
import { ToastMessage } from '@shared/types/toastMessage'
import { contextBridge, ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  onUpdateBulb: (callback: (state: MultiBulbState) => void) =>
    ipcRenderer.on('on-update-bulb', (_, state: MultiBulbState) => callback(state)),
  onShowToast: (callback: (toast: ToastMessage) => void) =>
    ipcRenderer.on('on-show-toast', (_, toast: ToastMessage) => callback(toast)),
  getBulbsWhenReady: () => ipcRenderer.invoke('get-bulbs'),

  // Active bulb operations
  toggleBulb: () => ipcRenderer.send('toggle-bulb-state'),
  setBrightness: (brightness: number) => ipcRenderer.send('set-brightness', brightness),
  setBulbName: (name: string, ip?: string) => ipcRenderer.send('set-bulb-name', name, ip),
  setScene: (sceneId: number) => ipcRenderer.send('set-scene', sceneId),
  toggleFavoriteColor: (colorId: number) => ipcRenderer.send('toggle-favorite-color', colorId),
  addCustomColor: (colorName: string, colorHex: string) =>
    ipcRenderer.send('add-custom-color', colorName, colorHex),
  setCustomColor: (colorId: number) => ipcRenderer.send('set-custom-color', colorId),
  editCustomColor: (colorId: number, colorName: string, colorHex: string) =>
    ipcRenderer.send('edit-color', colorId, colorName, colorHex),
  removeCustomColor: (colorId: number) => ipcRenderer.send('remove-color', colorId),
  setFavoriteColorsOrder: (favoriteColors: number[]) =>
    ipcRenderer.send('set-favorite-colors-order', favoriteColors),

  // Multi-bulb operations
  setActiveBulb: (ip: string) => ipcRenderer.send('set-active-bulb', ip),
  toggleBulbByIp: (ip: string) => ipcRenderer.send('toggle-bulb-by-ip', ip),
  addBulbByIp: (ip: string) => ipcRenderer.send('add-bulb-by-ip', ip),
  deleteBulb: (ip: string) => ipcRenderer.send('delete-bulb', ip),
  retryDiscovery: () => ipcRenderer.send('retry-discovery'),
  deleteProfile: () => ipcRenderer.send('delete-profile'),

  // Rooms & settings
  createRoom: (name: string) => ipcRenderer.send('create-room', name),
  renameRoom: (roomId: string, name: string) => ipcRenderer.send('rename-room', roomId, name),
  deleteRoom: (roomId: string) => ipcRenderer.send('delete-room', roomId),
  assignBulbRoom: (ip: string, roomId: string | null) => ipcRenderer.send('assign-bulb-room', ip, roomId),
  setSettings: (settings) => ipcRenderer.send('set-settings', settings),
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // Group actions
  groupSetPower: (ips: string[], on: boolean) => ipcRenderer.send('group-set-power', ips, on),
  groupSetBrightness: (ips: string[], brightness: number) => ipcRenderer.send('group-set-brightness', ips, brightness),
  groupSetScene: (ips: string[], sceneId: number) => ipcRenderer.send('group-set-scene', ips, sceneId),
  groupSetColor: (ips: string[], hex: string) => ipcRenderer.send('group-set-color', ips, hex),

  // Utility
  openAppFolder: () => ipcRenderer.send('open-app-folder'),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  showWindow: () => ipcRenderer.send('show-window'),
  hidePopup: () => ipcRenderer.send('hide-popup'),
  openMainWindow: () => ipcRenderer.send('open-main-window')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
