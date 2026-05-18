import type { ReactNode } from 'react'

import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Props {
  title: string
  description?: string
  phase?: number
  breadcrumbs?: BreadcrumbItem[]
  action?: ReactNode
}

// Placeholder for routes whose backend or feature work lands in a later phase.
// Keeps the navigation graph reachable so we can wire the sidebar end-to-end now.
export function StubPage({ title, description, phase, breadcrumbs, action }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />

      <Card className="overflow-hidden border-dashed">
        <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-rose-500" />
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 text-3xl">
            🚧
          </div>
          <CardTitle className="text-xl">{title} — قيد التطوير</CardTitle>
          <CardDescription className="mx-auto max-w-md leading-relaxed">
            {phase
              ? `هذه الصفحة جاهزة كبنية في الـ navigation، والوظائف الكاملة تنزل في المرحلة ${phase} من خطة البناء.`
              : 'هذه الصفحة جاهزة كبنية في الـ navigation، والوظائف الكاملة تنزل في مرحلة لاحقة.'}
          </CardDescription>
        </CardHeader>
        {action && <CardContent className="flex justify-center pb-6">{action}</CardContent>}
      </Card>
    </div>
  )
}
