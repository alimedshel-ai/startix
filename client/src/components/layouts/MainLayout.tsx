import { Outlet } from 'react-router-dom'

import { ClientContextBar } from '@/components/ClientContextBar'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SmartGuide } from '@/components/SmartGuide'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar />
      <ClientContextBar />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 px-6 py-6">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <SmartGuide />
    </div>
  )
}
