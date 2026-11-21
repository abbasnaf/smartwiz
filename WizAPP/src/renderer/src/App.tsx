import Layout from '@components/Layout'
import Home from '@pages/Home'
import Information from '@pages/Information'
import Scenes from '@pages/Scenes'
import QuickPopup from '@pages/QuickPopup'
import Rooms from '@pages/Rooms'
import SettingsPage from '@pages/SettingsPage'
import { ReactNode } from 'react'
import { createHashRouter, RouterProvider } from 'react-router'

const router = createHashRouter([
  { path: '/popup', element: <QuickPopup /> },
  {
    path: '/',
    element: <Layout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/devices', element: <Home /> },
      { path: '/rooms', element: <Rooms /> },
      { path: '/scenes', element: <Scenes /> },
      { path: '/information', element: <Information /> },
      { path: '/settings', element: <SettingsPage /> }
    ]
  }
])

function App(): ReactNode {
  return <RouterProvider router={router} />
}

export default App
