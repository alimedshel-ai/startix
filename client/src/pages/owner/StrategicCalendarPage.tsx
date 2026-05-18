import { useEffect, useMemo, useState } from 'react'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { listCorrections, listProjects, listReviews, listTasks, type Correction, type Project, type Review, type Task } from '@/lib/strategicApi'

const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

type EventKind = 'task' | 'project_start' | 'project_end' | 'correction' | 'review'

interface CalEvent {
  date: Date
  kind: EventKind
  title: string
}

const KIND_TINT: Record<EventKind, string> = {
  task:          'bg-sky-500',
  project_start: 'bg-emerald-500',
  project_end:   'bg-rose-500',
  correction:    'bg-amber-500',
  review:        'bg-violet-500',
}
const KIND_LABEL: Record<EventKind, string> = {
  task:          'مهمة',
  project_start: 'بدء مشروع',
  project_end:   'انتهاء مشروع',
  correction:    'إجراء تصحيحي',
  review:        'مراجعة',
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfMonth(y: number, m: number): Date { return new Date(y, m, 1) }

export function StrategicCalendarPage() {
  return (
    <StrategicShell title="التقويم الاستراتيجي" description="عرض شهري لمواعيد الاستحقاق والمراجعات ومعالم المشاريع.">
      {(companyId) => <Calendar companyId={companyId} />}
    </StrategicShell>
  )
}

function Calendar({ companyId }: { companyId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [cursor, setCursor] = useState({ y: new Date().getFullYear(), m: new Date().getMonth() })

  useEffect(() => {
    Promise.all([listTasks(companyId), listProjects(companyId), listReviews(companyId), listCorrections(companyId)])
      .then(([t, p, r, c]) => { setTasks(t); setProjects(p); setReviews(r); setCorrections(c) })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [companyId])

  const events: CalEvent[] = useMemo(() => {
    const out: CalEvent[] = []
    for (const t of tasks) if (t.dueDate) out.push({ date: new Date(t.dueDate), kind: 'task', title: t.title })
    for (const p of projects) {
      if (p.startDate) out.push({ date: new Date(p.startDate), kind: 'project_start', title: p.title })
      if (p.endDate)   out.push({ date: new Date(p.endDate),   kind: 'project_end',   title: p.title })
    }
    for (const r of reviews) out.push({ date: new Date(r.reviewedAt), kind: 'review', title: `مراجعة ${r.type}` })
    for (const c of corrections) if (c.dueDate) out.push({ date: new Date(c.dueDate), kind: 'correction', title: c.title })
    return out
  }, [tasks, projects, reviews, corrections])

  const monthStart = startOfMonth(cursor.y, cursor.m)
  const firstDay = monthStart.getDay()
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate()

  const cells: { date: Date; inMonth: boolean }[] = []
  const startCell = new Date(monthStart)
  startCell.setDate(1 - firstDay)
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(startCell)
    d.setDate(startCell.getDate() + i)
    cells.push({ date: d, inMonth: d.getMonth() === cursor.m })
  }

  const today = new Date()

  function move(delta: number) {
    const next = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: next.getFullYear(), m: next.getMonth() })
  }
  function goToday() {
    const t = new Date()
    setCursor({ y: t.getFullYear(), m: t.getMonth() })
  }

  if (loading) return <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>

  const monthEvents = events.filter((e) => e.date.getFullYear() === cursor.y && e.date.getMonth() === cursor.m)

  return (
    <>
      <Card className="overflow-hidden bg-gradient-to-bl from-orange-500/10 to-transparent">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{MONTHS[cursor.m]} {cursor.y}</CardTitle>
            <CardDescription>{monthEvents.length} حدث في هذا الشهر · {daysInMonth} يوم</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => move(-1)}>← السابق</Button>
            <Button size="sm" variant="outline" onClick={goToday}>اليوم</Button>
            <Button size="sm" variant="outline" onClick={() => move(1)}>التالي →</Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-xs">
          {(Object.keys(KIND_LABEL) as EventKind[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`inline-block size-2.5 rounded-full ${KIND_TINT[k]}`} />
              {KIND_LABEL[k]}
            </span>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-3">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-1 pb-1 text-center text-[11px] font-medium text-muted-foreground">
              {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((c, i) => {
                const dayEvents = events.filter((e) => sameDay(e.date, c.date))
                const isToday = sameDay(c.date, today)
                return (
                  <div
                    key={i}
                    className={`min-h-[90px] rounded-md border p-1.5 text-[11px] ${
                      c.inMonth ? 'bg-card' : 'bg-muted/30 text-muted-foreground'
                    } ${isToday ? 'ring-2 ring-primary' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`tabular-nums ${isToday ? 'font-bold text-primary' : ''}`}>{c.date.getDate()}</span>
                      {dayEvents.length > 0 && <span className="rounded-full bg-primary/15 px-1.5 text-[9px] font-medium text-primary">{dayEvents.length}</span>}
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((e, idx) => (
                        <li key={idx} className="flex items-center gap-1 truncate" title={`${KIND_LABEL[e.kind]}: ${e.title}`}>
                          <span className={`inline-block size-1.5 shrink-0 rounded-full ${KIND_TINT[e.kind]}`} />
                          <span className="truncate">{e.title}</span>
                        </li>
                      ))}
                      {dayEvents.length > 3 && (
                        <li className="text-[9px] text-muted-foreground">+{dayEvents.length - 3} أكثر</li>
                      )}
                    </ul>
                  </div>
                )
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
