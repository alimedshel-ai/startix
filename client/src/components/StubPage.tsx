import type { ReactNode } from 'react'

import { PageHeader, type BreadcrumbItem } from '@/components/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export type StubAccent = 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky' | 'orange' | 'fuchsia'

interface Props {
  title: string
  description?: string
  phase?: number
  icon?: string
  accent?: StubAccent
  breadcrumbs?: BreadcrumbItem[]
  action?: ReactNode
}

const GRADIENT: Record<StubAccent, string> = {
  teal:    'from-teal-500 via-cyan-500 to-emerald-500',
  indigo:  'from-indigo-500 via-blue-500 to-sky-500',
  amber:   'from-amber-500 via-orange-500 to-yellow-500',
  emerald: 'from-emerald-500 via-green-500 to-teal-500',
  rose:    'from-rose-500 via-pink-500 to-red-500',
  violet:  'from-violet-500 via-purple-500 to-fuchsia-500',
  sky:     'from-sky-500 via-blue-500 to-indigo-500',
  orange:  'from-orange-500 via-amber-500 to-rose-500',
  fuchsia: 'from-fuchsia-500 via-purple-500 to-violet-500',
}

const BG_SOFT: Record<StubAccent, string> = {
  teal:    'from-teal-500/15 to-cyan-500/15',
  indigo:  'from-indigo-500/15 to-sky-500/15',
  amber:   'from-amber-500/15 to-yellow-500/15',
  emerald: 'from-emerald-500/15 to-green-500/15',
  rose:    'from-rose-500/15 to-pink-500/15',
  violet:  'from-violet-500/15 to-fuchsia-500/15',
  sky:     'from-sky-500/15 to-blue-500/15',
  orange:  'from-orange-500/15 to-amber-500/15',
  fuchsia: 'from-fuchsia-500/15 to-purple-500/15',
}

export function StubPage({ title, description, phase, icon = '🚧', accent = 'violet', breadcrumbs, action }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} description={description} breadcrumbs={breadcrumbs} />

      <Card className="overflow-hidden border-dashed shadow-sm">
        <div className={`h-1.5 bg-gradient-to-l ${GRADIENT[accent]}`} />
        <CardHeader className="text-center">
          <div
            className={`mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-gradient-to-br ${BG_SOFT[accent]} text-3xl shadow-inner`}
          >
            {icon}
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="mx-auto max-w-md leading-relaxed">
            {description ?? 'هذه الصفحة جاهزة كبنية في الـ navigation.'}{' '}
            {phase
              ? `الوظائف الكاملة تنزل في المرحلة ${phase} من خطة البناء.`
              : 'الوظائف الكاملة تنزل في مرحلة لاحقة.'}
          </CardDescription>
        </CardHeader>
        {action && <CardContent className="flex justify-center pb-6">{action}</CardContent>}
      </Card>
    </div>
  )
}
