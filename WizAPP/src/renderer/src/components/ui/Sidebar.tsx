import logo from '@assets/logo_sidebar.png'
import BulbShortcut from '@components/BulbShortcut'
import MenuLink from '@components/MenuLink'
import Separator from '@components/ui/Separator'
import { useBulbStore } from '@renderer/context/BulbStore'
import { LuHouse, LuLamp, LuLayers, LuImages, LuSettings } from 'react-icons/lu'

export default function Sidebar() {
  const bulb = useBulbStore((state) => state.activeBulb)

  return (
    <aside className="bg-sidebar-bg p-4 w-56 flex flex-col min-h-screen max-h-screen fixed">
      <img src={logo} alt="Wiz logo banner" width={100} className="mx-auto" />
      <Separator />
      <div className="flex-grow-1">
        <p className="text-neutral-500 text-xs subpixel-antialiased mb-3 ps-2">MENU</p>
        <ul className="text-white flex flex-col gap-2">
          <MenuLink index={0} label="Overview" to="/" icon={<LuHouse size={20} />} />
          <MenuLink index={1} label="All Devices" to="/devices" icon={<LuLamp size={20} />} />
          <MenuLink index={2} label="Rooms" to="/rooms" icon={<LuLayers size={20} />} />
          <MenuLink index={3} label="Scenes" to="/scenes" icon={<LuImages size={20} />} />
          <MenuLink index={4} label="Settings" to="/settings" icon={<LuSettings size={20} />} />
        </ul>
      </div>
      {bulb && <BulbShortcut />}
    </aside>
  )
}
