import { useBulbStore } from '@renderer/context/BulbStore'
import { useEffect, useState } from 'react'

export default function QuickPopup() {
  const { bulbs, isDiscovering, toggleBulbByIp, groupSetBrightness, groupSetColor } = useBulbStore()
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => {
    if (!selected && bulbs.length > 0) setSelected(bulbs[0].ip)
  }, [bulbs, selected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') window.api.hidePopup() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const bulb = bulbs.find((b) => b.ip === selected) || bulbs[0]
  const presets = ['#ff0000', '#00ff00', '#0000ff', '#8000ff', '#ff69b4', '#ff8c00', '#00ffff', '#fff4e5', '#e6f3ff']

  return (
    <div className="h-screen p-2 bg-transparent">
      <div className="h-full rounded-2xl bg-[#1b2230]/95 text-white border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="text-xs text-neutral-400">WiZAPP</div>
            <div className="font-semibold">Quick Controls</div>
          </div>
          <button onClick={() => window.api.openMainWindow()} className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20">Open App</button>
        </div>
        <div className="p-3 overflow-auto flex-1 space-y-3">
          {bulbs.length === 0 ? (
            <div className="text-sm text-neutral-400">{isDiscovering ? 'Discovering bulbs...' : 'No bulbs found. Open app to add a device.'}</div>
          ) : (
            <>
              <select value={bulb?.ip} onChange={(e) => setSelected(e.target.value)} className="w-full bg-[#111827] border border-white/10 rounded-lg px-2 py-2 text-sm">
                {bulbs.map((b) => <option key={b.ip} value={b.ip}>{b.name} {b.state ? '(On)' : '(Off)'}</option>)}
              </select>
              {bulb && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm">{bulb.name}</div>
                    <button onClick={() => toggleBulbByIp(bulb.ip)} className={`px-3 py-1.5 rounded-lg text-sm ${bulb.state ? 'bg-blue-600' : 'bg-white/10'}`}>{bulb.state ? 'ON' : 'OFF'}</button>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs text-neutral-400"><span>Brightness</span><span>{bulb.dimming ?? 100}%</span></div>
                    <input type="range" min={10} max={100} value={bulb.dimming ?? 100} onChange={(e) => groupSetBrightness([bulb.ip], Number(e.target.value))} className="w-full" />
                  </div>
                  <div>
                    <div className="text-xs text-neutral-400 mb-2">Color presets</div>
                    <div className="flex gap-2 flex-wrap">
                      {presets.map((c) => <button key={c} onClick={() => groupSetColor([bulb.ip], c)} className="w-7 h-7 rounded-full border border-white/20" style={{ background: c }} aria-label={c} />)}
                    </div>
                  </div>
                </>
              )}
              <div className="border-t border-white/10 pt-3">
                <div className="text-xs text-neutral-400 mb-2">All bulbs</div>
                <div className="space-y-2">
                  {bulbs.map((b) => (
                    <div key={b.ip} className="flex items-center justify-between text-sm bg-white/5 rounded-lg px-2 py-2">
                      <button className="text-left truncate mr-2" onClick={() => setSelected(b.ip)}>{b.name}</button>
                      <button onClick={() => toggleBulbByIp(b.ip)} className={`px-2 py-1 rounded text-xs ${b.state ? 'bg-blue-600' : 'bg-white/10'}`}>{b.state ? 'On' : 'Off'}</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
