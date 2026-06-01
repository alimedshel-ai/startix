import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { apiErrorMessage } from '@/lib/api'
import { listCorrections, updateCorrection, type Correction } from '@/lib/strategicApi'

const STATUS = [
  ['open',        'مفتوحة',    'border-rose-300 bg-rose-50/60',     'bg-rose-500'],
  ['in_progress', 'قيد التنفيذ','border-sky-300 bg-sky-50/60',       'bg-sky-500'],
  ['done',        'منجزة',     'border-emerald-300 bg-emerald-50/60','bg-emerald-500'],
  ['blocked',     'متعطلة',    'border-amber-300 bg-amber-50/60',   'bg-amber-500'],
] as const

function sMeta(s: string) {
  return STATUS.find((x) => x[0] === s) ?? STATUS[0]
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function isOverdue(c: Correction): boolean {
  if (!c.dueDate || c.status === 'done') return false
  return new Date(c.dueDate).getTime() < Date.now()
}

export function CorrectionsPage() {
  return (
    <StrategicShell
      title="الإجراءات التصحيحية"
      description="قائمة بإجراءات التصحيح المُولّدة من المراجعات. لكل إجراء مسؤول، تاريخ، وحالة."
      actions={
        <Link to="/reviews" className={buttonVariants({ variant: 'outline' })}>
          ← العودة للمراجعات
        </Link>
      }
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Correction[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'done' | 'blocked'>('all')

  useEffect(() => {
    listCorrections(companyId).then(setItems).catch(() => undefined).finally(() => setLoading(false))
  }, [companyId])

  async function update(c: Correction, patch: Partial<Correction>) {
    try {
      const updated = await updateCorrection(c.id, patch)
      setItems((p) => p.map((x) => (x.id === c.id ? { ...x, ...updated } : x)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  const filtered = useMemo(
    () => (filter === 'all' ? items : items.filter((c) => c.status === filter)),
    [items, filter],
  )

  const counts = STATUS.reduce<Record<string, number>>((acc, [k]) => {
    acc[k] = items.filter((c) => c.status === k).length
    return acc
  }, {})
  const overdue = items.filter(isOverdue).length

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {STATUS.map(([k, label, tint]) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(filter === k ? 'all' : (k as typeof filter))}
            className={`rounded-xl border p-4 text-right transition ${tint} ${filter === k ? 'ring-2 ring-primary/30' : ''}`}
          >
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts[k] ?? 0}</div>
          </button>
        ))}
        <div className="rounded-xl border border-rose-300 bg-rose-50/60 p-4">
          <div className="text-xs text-muted-foreground">متأخرة</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{overdue}</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>القائمة</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')} disabled={filter === 'all'}>
              إزالة الفلتر
            </Button>
          </div>
          <CardDescription>{filtered.length} إجراء معروض من {items.length} إجمالي.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && <p className="text-sm text-muted-foreground">جاري التحميل…</p>}
          <ul className="space-y-2">
            {filtered.map((c) => {
              const meta = sMeta(c.status)
              const od = isOverdue(c)
              return (
                <li key={c.id} className={`flex items-center gap-2 rounded-xl border p-3 ${meta[2]}`}>
                  <span className={`inline-block size-2.5 shrink-0 rounded-full ${meta[3]}`} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span>{c.title}</span>
                      {od && <span className="rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">متأخرة</span>}
                    </div>
                    {c.description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>}
                    <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {c.owner && <span>👤 {c.owner}</span>}
                      <span className="tabular-nums">📅 {fmtDate(c.dueDate)}</span>
                      {c.reviewId && <span className="rounded-md border bg-card px-1.5 py-0.5 text-[10px]">من مراجعة</span>}
                    </div>
                  </div>
                  <select
                    className="rounded-md border bg-background px-1.5 py-1 text-xs"
                    value={c.status}
                    onChange={(e) => update(c, { status: e.target.value })}
                  >
                    {STATUS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                  </select>
                </li>
              )
            })}
            {!loading && filtered.length === 0 && (
              <li className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد إجراءات. أنشئ مراجعة مع إجراءات تصحيحية لرؤيتها هنا.
              </li>
            )}
          </ul>
        </CardContent>
      </Card>
    </>
  )
}
