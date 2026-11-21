import { useBulbStore } from '@renderer/context/BulbStore'

export default function SettingsPage() {
  const { settings, setSettings, bulbs, rooms } = useBulbStore()
  return (
    <section className="py-8 px-8 max-w-4xl">
      <h1 className="font-bold text-4xl">Settings</h1>
      <p className="text-neutral-400 mt-2">Manage application and device preferences.</p>

      <div className="mt-6 space-y-4">
        <div className="bg-secondary rounded-xl p-4 border border-white/10 space-y-4">
          <h2 className="font-semibold text-lg">Application</h2>
          <label className="flex items-center justify-between">
            <span>Start with Windows</span>
            <input type="checkbox" checked={!!settings.startWithWindows} onChange={(e) => setSettings({ startWithWindows: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Minimize to tray when closed</span>
            <input type="checkbox" checked={!!settings.minimizeToTray} onChange={(e) => setSettings({ minimizeToTray: e.target.checked })} />
          </label>
          <label className="flex items-center justify-between">
            <span>Theme</span>
            <select value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as any })} className="bg-black/20 border border-white/10 rounded px-2 py-1">
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </label>
        </div>

        <div className="bg-secondary rounded-xl p-4 border border-white/10">
          <h2 className="font-semibold text-lg">Summary</h2>
          <div className="text-sm text-neutral-300 mt-2 space-y-1">
            <div>Saved bulbs: {bulbs.length}</div>
            <div>Rooms: {rooms.length}</div>
            <div>Connected: {bulbs.length}</div>
          </div>
          <p className="text-xs text-neutral-500 mt-3">Device discovery, manual IP add, and per-device controls are available from the Overview/All Devices screens.</p>
        </div>
      </div>
    </section>
  )
}
