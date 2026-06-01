import { useEffect, useMemo, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listActivity, type ActivityRow } from '@/lib/strategicApi'

type ActivityType = ActivityRow['type'] | 'all'

const TYPE_META: Record<ActivityRow['type'], { label: string; icon: string; tint: string }> = {
  task:        { label: 'مهام',          icon: '✓',  tint: 'border-slate-300 bg-slate-50/60' },
  kpi_entry:   { label: 'مؤشرات',         icon: '📊', tint: 'border-sky-300 bg-sky-50/60' },
  review:      { label: 'مراجعات',        icon: '🔁', tint: 'border-orange-300 bg-orange-50/60' },
  correction:  { label: 'إجراءات تصحيح',  icon: '🔧', tint: 'border-rose-300 bg-rose-50/60' },
}

function fmtRelative(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'الآن'
  if (mins < 60) return `قبل ${mins} د`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `قبل ${hours} س`
  const days = Math.floor(hours / 24)
  if (days < 7) return `قبل ${days} يوم`
  return d.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })
}

export function ActivityFeedPage() {
  return (
    <StrategicShell title="سجل النشاط" description="سجل زمني لكل التغييرات على المهام والمؤشرات والمراجعات والإجراءات.">
      {(companyId) => <Feed companyId={companyId} />}
    </StrategicShell>
  )
}

function Feed({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<ActivityType>('all')

  useEffect(() => {
    listActivity(companyId).then(setRows).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  const filtered = useMemo(
    () => (filter === 'all' ? rows : rows.filter((r) => r.type === filter)),
    [rows, filter],
  )

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of rows) c[r.type] = (c[r.type] ?? 0) + 1
    return c
  }, [rows])

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>التصفية</CardTitle>
          <CardDescription>{rows.length} حدث في آخر فترة.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
            الكل ({rows.length})
          </Button>
          {(Object.keys(TYPE_META) as ActivityRow['type'][]).map((t) => (
            <Button key={t} size="sm" variant={filter === t ? 'default' : 'outline'} onClick={() => setFilter(t)}>
              {TYPE_META[t].icon} {TYPE_META[t].label} ({counts[t] ?? 0})
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأحداث</CardTitle>
          <CardDescription>{filtered.length} حدث معروض.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {filtered.map((r) => {
              const m = TYPE_META[r.type]
              return (
                <li key={`${r.type}-${r.id}`} className={`flex items-start gap-3 rounded-xl border p-3 ${m.tint}`}>
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg border bg-card text-base">
                    {m.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{r.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{fmtRelative(r.at)}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {r.type === 'task'       && <>المهمة الآن: <span className="font-medium">{r.status ?? '—'}</span></>}
                      {r.type === 'kpi_entry'  && <>القيمة المسجلة: <span className="tabular-nums font-medium">{r.value?.toLocaleString('ar-SA') ?? '—'}</span></>}
                      {r.type === 'review'     && <>مخرج: <span className="font-medium">{r.outcome ?? '—'}</span></>}
                      {r.type === 'correction' && <>الحالة: <span className="font-medium">{r.status ?? '—'}</span></>}
                    </div>
                  </div>
                </li>
              )
            })}
            {filtered.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد أحداث.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
