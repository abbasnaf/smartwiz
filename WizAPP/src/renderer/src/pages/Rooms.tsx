import { useBulbStore } from '@renderer/context/BulbStore'
import { useState } from 'react'

export default function Rooms() {
  const { bulbs, rooms, createRoom, renameRoom, deleteRoom, assignBulbRoom, groupSetPower, groupSetBrightness } = useBulbStore()
  const [newRoom, setNewRoom] = useState('')

  return (
    <section className="py-8 px-8">
      <h1 className="font-bold text-4xl">Rooms</h1>
      <p className="text-neutral-400 mt-2">Organize bulbs into rooms and control them together.</p>

      <div className="mt-6 flex gap-2">
        <input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="New room name" className="px-3 py-2 rounded-lg bg-secondary text-white border border-white/10" />
        <button onClick={() => { if (newRoom.trim()) { createRoom(newRoom.trim()); setNewRoom('') } }} className="px-4 py-2 rounded-lg bg-primary text-white">Create Room</button>
      </div>

      <div className="mt-6 space-y-4">
        {rooms.length === 0 && <div className="text-neutral-400">No rooms yet. Create one to organize your bulbs.</div>}
        {rooms.map((room) => {
          const roomBulbs = bulbs.filter((b) => b.appRoomId === room.id)
          return (
            <div key={room.id} className="bg-secondary rounded-xl p-4 border border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-lg">{room.name}</div>
                  <div className="text-xs text-neutral-400">{roomBulbs.length} bulb(s)</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => groupSetPower(roomBulbs.map((b) => b.ip), true)} className="px-2 py-1 rounded bg-white/10 text-sm">All On</button>
                  <button onClick={() => groupSetPower(roomBulbs.map((b) => b.ip), false)} className="px-2 py-1 rounded bg-white/10 text-sm">All Off</button>
                  <button onClick={() => { const name = prompt('Rename room', room.name); if (name) renameRoom(room.id, name) }} className="px-2 py-1 rounded bg-white/10 text-sm">Rename</button>
                  <button onClick={() => deleteRoom(room.id)} className="px-2 py-1 rounded bg-red-500/20 text-red-300 text-sm">Delete</button>
                </div>
              </div>
              <div className="mt-3">
                <label className="text-xs text-neutral-400">Room brightness</label>
                <input type="range" min={10} max={100} defaultValue={100} onChange={(e) => groupSetBrightness(roomBulbs.map((b) => b.ip), Number(e.target.value))} className="w-full" />
              </div>
              <div className="mt-3 grid md:grid-cols-2 gap-2">
                {roomBulbs.map((b) => (
                  <div key={b.ip} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-2 text-sm">
                    <span>{b.name} <span className="text-neutral-400">({b.state ? 'On' : 'Off'})</span></span>
                    <button onClick={() => assignBulbRoom(b.ip, null)} className="text-xs text-neutral-400 hover:text-white">Remove</button>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-xs text-neutral-400">Assign bulb to room</label>
                <select className="ml-2 bg-black/20 border border-white/10 rounded px-2 py-1 text-sm" defaultValue="" onChange={(e) => { if (e.target.value) assignBulbRoom(e.target.value, room.id); e.target.value = '' }}>
                  <option value="">Select bulb...</option>
                  {bulbs.filter((b) => b.appRoomId !== room.id).map((b) => <option key={b.ip} value={b.ip}>{b.name}</option>)}
                </select>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
