import Sidebar from '@components/ui/Sidebar'
import { ToastContainer } from '@components/ui/Toast'
import { Outlet, useNavigate } from 'react-router'
import { useEffect } from 'react'

export default function Layout() {
  const navigate = useNavigate()
  useEffect(() => {
    const handler = (_: unknown, path: string) => { if (path) navigate(path) }
    window.electron.ipcRenderer.on('navigate-to', handler)
    return () => { window.electron.ipcRenderer.removeListener('navigate-to', handler) }
  }, [navigate])

  return (
    <div className="flex w-full">
      <Sidebar />
      <main className="bg-main-bg text-white nonSelectable grow-1 pl-56 min-h-screen">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  )
}
