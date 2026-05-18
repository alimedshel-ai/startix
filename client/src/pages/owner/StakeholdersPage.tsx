import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Stakeholder {
  id: string
  name: string
  type: string
  influence: 1 | 2 | 3 | 4 | 5
  interest: 1 | 2 | 3 | 4 | 5
}

interface StakeholderData {
  rows: Stakeholder[]
}

const EMPTY: StakeholderData = { rows: [] }

const TYPE_OPTIONS = [
  { value: 'internal',  label: 'داخلي' },
  { value: 'customer',  label: 'عميل' },
  { value: 'supplier',  label: 'مورد' },
  { value: 'regulator', label: 'جهة تنظيمية' },
  { value: 'investor',  label: 'مستثمر' },
  { value: 'other',     label: 'آخر' },
]

export function StakeholdersPage() {
  return (
    <StrategicShell title="أصحاب المصلحة" description="خريطة: الاسم × النوع × التأثير × الاهتمام، مع رسم على مصفوفة ٢×٢.">
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<StakeholderData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<StakeholderData>(companyId, 'STAKEHOLDERS').then((row) => {
      if (row?.data) setData({ rows: row.data.rows ?? [] })
    })
  }, [companyId])

  function add() {
    setData((p) => ({ rows: [...p.rows, { id: crypto.randomUUID(), name: '', type: 'internal', influence: 3, interest: 3 }] }))
  }
  function set(id: string, patch: Partial<Stakeholder>) {
    setData((p) => ({ rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  function remove(id: string) { setData((p) => ({ rows: p.rows.filter((r) => r.id !== id) })) }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'STAKEHOLDERS', data)
      toast.success('تم حفظ أصحاب المصلحة')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const scatter = data.rows.map((r) => ({ name: r.name || '—', influence: r.influence, interest: r.interest }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>الأصحاب</CardTitle>
          <CardDescription>{data.rows.length} طرف.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="py-2">الاسم</th>
                <th className="py-2">النوع</th>
                <th className="py-2">التأثير</th>
                <th className="py-2">الاهتمام</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 pl-1"><Input value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="الاسم" /></td>
                  <td className="py-1 pl-1">
                    <select className="rounded-md border bg-background px-2 py-1 text-xs" value={r.type} onChange={(e) => set(r.id, { type: e.target.value })}>
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pl-1">
                    <select className="rounded-md border bg-background px-2 py-1 text-xs" value={r.influence} onChange={(e) => set(r.id, { influence: Number(e.target.value) as Stakeholder['influence'] })}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pl-1">
                    <select className="rounded-md border bg-background px-2 py-1 text-xs" value={r.interest} onChange={(e) => set(r.id, { interest: Number(e.target.value) as Stakeholder['interest'] })}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-1"><Button variant="ghost" size="sm" onClick={() => remove(r.id)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={add}>+ صاحب مصلحة</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-indigo-500/5 to-emerald-500/5">
        <CardHeader>
          <CardTitle>التأثير × الاهتمام</CardTitle>
          <CardDescription>أعلى يمين: إدارة قريبة. أعلى يسار: إبقاؤهم راضين. أسفل يمين: إبقاؤهم مطّلعين.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="interest" name="الاهتمام" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <YAxis type="number" dataKey="influence" name="التأثير" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <ZAxis range={[80, 80]} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
              <Scatter data={scatter} fill="hsl(220 90% 56%)" />
            </ScatterChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
