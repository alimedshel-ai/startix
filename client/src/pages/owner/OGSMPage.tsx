import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface OGSMRow {
  id: string
  objective: string
  goal: string
  strategy: string
  measure: string
}

interface OGSMData {
  rows: OGSMRow[]
}

const EMPTY: OGSMData = { rows: [] }

const COLS: { key: keyof OGSMRow; label: string; icon: string; hint: string; tint: string }[] = [
  { key: 'objective', label: 'الهدف العام',     icon: '🎯', hint: 'النية الاستراتيجية الكبرى',  tint: 'bg-emerald-50/60' },
  { key: 'goal',      label: 'الغاية الكمية',   icon: '📏', hint: 'قياس واضح للنجاح',         tint: 'bg-sky-50/60' },
  { key: 'strategy',  label: 'الاستراتيجية',     icon: '🧭', hint: 'كيف نصل للغاية',             tint: 'bg-amber-50/60' },
  { key: 'measure',   label: 'المقياس',         icon: '📊', hint: 'مؤشر متابعة دوري',           tint: 'bg-violet-50/60' },
]

export function OGSMPage() {
  return (
    <StrategicShell
      title="إطار OGSM"
      description="Objectives / Goals / Strategies / Measures — إطار رباعي يربط النية بالتنفيذ بالقياس."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<OGSMData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<OGSMData>(companyId, 'OGSM').then((row) => {
      if (row?.data?.rows?.length) setData({ rows: row.data.rows })
    }).catch(() => undefined)
  }, [companyId])

  function add() {
    setData((p) => ({
      rows: [...p.rows, { id: crypto.randomUUID(), objective: '', goal: '', strategy: '', measure: '' }],
    }))
  }
  function update(id: string, patch: Partial<OGSMRow>) {
    setData((p) => ({ rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  function remove(id: string) {
    setData((p) => ({ rows: p.rows.filter((r) => r.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'OGSM', data)
      toast.success('تم حفظ OGSM')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="grid gap-2 md:grid-cols-4">
            {COLS.map((c) => (
              <div key={c.key} className={`rounded-xl border p-3 ${c.tint}`}>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-base">{c.icon}</span>
                  {c.label}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.hint}</p>
              </div>
            ))}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الصفوف</CardTitle>
          <CardDescription>{data.rows.length} صف.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.rows.map((r, i) => (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium">الصف {i + 1}</span>
                  <button onClick={() => remove(r.id)} className="hover:text-destructive">حذف</button>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {COLS.map((c) => (
                    <div key={c.key}>
                      <div className={`mb-1 inline-block rounded-md px-2 py-0.5 text-[10px] font-medium ${c.tint}`}>
                        {c.icon} {c.label}
                      </div>
                      <Textarea
                        rows={3}
                        value={r[c.key]}
                        onChange={(e) => update(r.id, { [c.key]: e.target.value } as Partial<OGSMRow>)}
                        placeholder={c.hint}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {data.rows.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                لا توجد صفوف بعد. أضف أول صف بضغطة زر.
              </p>
            )}
          </div>
          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={add}>+ صف جديد</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ OGSM'}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
