import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface Props {
  children: ReactNode
  className?: string
}

// Dashboard-specific grid wrapper. Intentionally simple — feature pages
// drop tiles in a 12-column grid via direct className usage.
export function DashboardLayout({ children, className }: Props) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 md:grid-cols-12', className)}>{children}</div>
  )
}
