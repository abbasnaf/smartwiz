import BulbCard from '@renderer/components/BulbCard'
import FavoriteScene from '@renderer/components/FavoriteScene'
import AddDeviceModal from '@renderer/components/modals/AddDeviceModal'
import DeleteDialog from '@renderer/components/modals/DeleteDialog'
import EditNameModal from '@renderer/components/modals/EditNameModal'
import SearchBulbCard from '@renderer/components/SearchBulbCard'
import Button from '@renderer/components/ui/Button'
import { useBulbStore } from '@renderer/context/BulbStore'
import { HomeModalState, ModalType } from '@renderer/types/modals'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LuCirclePlus, LuSquarePen, LuToggleLeft, LuTrash } from 'react-icons/lu'

export default function Home() {
  const { bulbs, activeBulb, isDiscovering, toggleBulbByIp, setActiveBulb, deleteBulb, isReady, groupSetPower, groupSetBrightness, rooms } = useBulbStore()
  const { t } = useTranslation()
  const [modals, setModals] = useState<HomeModalState>({ edit: false, delete: false, ip: false })
  const [targetBulbIp, setTargetBulbIp] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])

  useEffect(() => {
    if (isReady) {
      document.fonts.ready.then(() => requestAnimationFrame(() => window.api.showWindow()))
    }
  }, [isReady])

  const toggleModal = (modal: ModalType) => setModals((prev) => ({ ...prev, [modal]: !prev[modal] }))
  const handleDeleteBulb = () => { if (targetBulbIp) deleteBulb(targetBulbIp); toggleModal('delete'); setTargetBulbIp(null) }
  const getMenuItemsForBulb = useCallback((ip: string) => [
    { label: t('home.toggle'), icon: <LuToggleLeft size={20} />, onClick: () => toggleBulbByIp(ip) },
    { label: t('home.edit.entry'), icon: <LuSquarePen size={20} />, onClick: () => { setTargetBulbIp(ip); toggleModal('edit') } },
    { label: t('home.delete.entry'), icon: <LuTrash size={20} />, onClick: () => { setTargetBulbIp(ip); toggleModal('delete') } }
  ], [t, toggleBulbByIp])

  const targetBulb = targetBulbIp ? bulbs.find((b) => b.ip === targetBulbIp) : activeBulb
  const stats = useMemo(() => ({
    total: bulbs.length,
    on: bulbs.filter((b) => b.state).length,
    off: bulbs.filter((b) => !b.state).length,
    rooms: rooms.length
  }), [bulbs, rooms])

  const toggleSelect = (ip: string) => setSelected((prev) => prev.includes(ip) ? prev.filter((x) => x !== ip) : [...prev, ip])
  const selectedIps = selected.filter((ip) => bulbs.some((b) => b.ip === ip))

  return (
    <section className="py-8 px-8">
      <h1 className="font-bold text-4xl">Overview</h1>
      <p className="text-sm lg:text-lg mt-2 text-neutral-400 font-medium">Manage all your WiZ bulbs from one place.</p>

      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-secondary rounded-xl p-4 border border-white/10"><div className="text-neutral-400 text-sm">Total devices</div><div className="text-2xl font-semibold">{stats.total}</div></div>
        <div className="bg-secondary rounded-xl p-4 border border-white/10"><div className="text-neutral-400 text-sm">Bulbs ON</div><div className="text-2xl font-semibold">{stats.on}</div></div>
        <div className="bg-secondary rounded-xl p-4 border border-white/10"><div className="text-neutral-400 text-sm">Bulbs OFF</div><div className="text-2xl font-semibold">{stats.off}</div></div>
        <div className="bg-secondary rounded-xl p-4 border border-white/10"><div className="text-neutral-400 text-sm">Rooms</div><div className="text-2xl font-semibold">{stats.rooms}</div></div>
      </div>

      <div className="mt-6 bg-secondary rounded-xl p-4 border border-white/10 flex flex-wrap gap-2 items-center">
        <span className="text-sm text-neutral-300 mr-2">Group control ({selectedIps.length} selected):</span>
        <button className="px-3 py-1.5 rounded bg-white/10 text-sm" onClick={() => setSelected(bulbs.map((b) => b.ip))}>Select All</button>
        <button className="px-3 py-1.5 rounded bg-white/10 text-sm" onClick={() => setSelected([])}>Deselect All</button>
        <button className="px-3 py-1.5 rounded bg-blue-600 text-sm disabled:opacity-40" disabled={!selectedIps.length} onClick={() => groupSetPower(selectedIps, true)}>Turn ON</button>
        <button className="px-3 py-1.5 rounded bg-white/10 text-sm disabled:opacity-40" disabled={!selectedIps.length} onClick={() => groupSetPower(selectedIps, false)}>Turn OFF</button>
        <label className="text-sm text-neutral-300 ml-2">Brightness</label>
        <input type="range" min={10} max={100} defaultValue={100} disabled={!selectedIps.length} onChange={(e) => groupSetBrightness(selectedIps, Number(e.target.value))} />
      </div>

      {activeBulb && <p className="mt-6 text-sm text-neutral-400 font-medium">{t('home.selectedBulb')}: <span className="text-primary font-semibold">{activeBulb.name}</span></p>}

      <article className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {bulbs.map((b) => (
          <div key={b.ip} className="relative">
            <label className="absolute top-2 left-2 z-20 text-xs bg-black/40 px-2 py-1 rounded">
              <input type="checkbox" checked={selectedIps.includes(b.ip)} onChange={() => toggleSelect(b.ip)} /> Select
            </label>
            <BulbCard bulb={b} isActive={b.ip === activeBulb?.ip} onSelect={() => setActiveBulb(b.ip)} onToggle={() => toggleBulbByIp(b.ip)} menuItems={getMenuItemsForBulb(b.ip)} />
            <div className="text-xs text-neutral-400 mt-1 px-1">Room: {rooms.find((r) => r.id === b.appRoomId)?.name || 'Unassigned'} • Brightness: {b.dimming ?? 100}%</div>
          </div>
        ))}
        {isDiscovering && bulbs.length === 0 && <SearchBulbCard />}
        <Button variant="secondary" onClick={() => toggleModal('ip')} className="flex flex-col items-center justify-center w-full h-31 g-1">
          <LuCirclePlus size={32} strokeWidth={1} />
          <p className="mt-2 text-lg">{t('home.add.entry')}</p>
        </Button>
      </article>

      {targetBulb && (
        <>
          <EditNameModal isOpen={modals.edit} onClose={() => toggleModal('edit')} targetBulb={targetBulb} />
          <DeleteDialog isOpen={modals.delete} onClose={() => toggleModal('delete')} title={t('home.delete.title')} description={`${t('home.delete.message')} "${targetBulb.name}"?`} onConfirm={handleDeleteBulb} />
        </>
      )}
      <AddDeviceModal isOpen={modals.ip} onClose={() => toggleModal('ip')} />
      <article className="mt-8 w-full"><FavoriteScene /></article>
    </section>
  )
}
