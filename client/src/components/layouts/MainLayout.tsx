import { Outlet } from 'react-router-dom'

import { ClientContextBar } from '@/components/ClientContextBar'
import { CommandPalette } from '@/components/CommandPalette'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SmartGuide } from '@/components/SmartGuide'
import { useStageGuard } from '@/hooks/useStageGuard'
import { QuickNav } from './QuickNav'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

export function MainLayout() {
  useStageGuard() // قفل المراحل الصلب — حرس مسار يعيد توجيه URL المقفل (خلف flag)
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Topbar />
      <QuickNav />
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
      <CommandPalette />
    </div>
  )
}
