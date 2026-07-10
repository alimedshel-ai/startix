import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_STAKEHOLDERS, type StakeholderSuggestion } from '@/lib/deptStrategyBanks'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

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
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_STAKEHOLDERS[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `أصحاب المصلحة — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'أصحاب المصلحة'
  const description = isDeptScoped
    ? 'أصحاب مصلحة نموذجيون لإدارتك مع تقديرات جاهزة للتأثير × الاهتمام.'
    : 'خريطة: الاسم × النوع × التأثير × الاهتمام، مع رسم على مصفوفة ٢×٢.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor companyId={companyId} specialty={isDeptScoped ? (specialty as DeptCode) : null} />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  const artifactType: ArtifactType = specialty ? `STAKEHOLDERS_${specialty}` : 'STAKEHOLDERS'
  const suggestions = specialty ? DEPT_STAKEHOLDERS[specialty] ?? [] : []
  const [data, setData] = useState<StakeholderData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<StakeholderData>(companyId, artifactType).then((row) => {
      if (row?.data) setData({ rows: row.data.rows ?? [] })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function addSuggestion(s: StakeholderSuggestion) {
    if (data.rows.some((r) => r.name === s.name)) return
    setData((p) => ({
      rows: [...p.rows, { id: crypto.randomUUID(), name: s.name, type: s.type, influence: s.influence, interest: s.interest }],
    }))
  }
  function addAllSuggestions() {
    const existing = new Set(data.rows.map((r) => r.name))
    const toAdd = suggestions.filter((s) => !existing.has(s.name))
    if (toAdd.length === 0) return
    setData((p) => ({
      rows: [
        ...p.rows,
        ...toAdd.map((s) => ({ id: crypto.randomUUID(), name: s.name, type: s.type, influence: s.influence, interest: s.interest })),
      ],
    }))
  }

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
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ أصحاب المصلحة')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const scatter = data.rows.map((r) => ({ name: r.name || '—', influence: r.influence, interest: r.interest }))

  return (
    <>
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
            </span>
            <span className="text-muted-foreground">
              أصحاب مصلحة نموذجيون لإدارتك — قِيَم التأثير والاهتمام مبدئية، عدّلها حسب سياق العميل.
            </span>
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="border-primary/40 bg-gradient-to-l from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm">💡 أصحاب مصلحة مقترحون لتخصّصك</CardTitle>
              <CardDescription>كل طرف بنوعه + تقدير مبدئي للتأثير والاهتمام. انقر لإضافته، ثم عدّل.</CardDescription>
            </div>
            {suggestions.some((s) => !data.rows.some((r) => r.name === s.name)) && (
              <Button size="sm" onClick={addAllSuggestions}>
                ＋ أضِف الكل ({suggestions.filter((s) => !data.rows.some((r) => r.name === s.name)).length})
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.map((s) => {
              const already = data.rows.some((r) => r.name === s.name)
              const typeLabel = TYPE_OPTIONS.find((t) => t.value === s.type)?.label ?? s.type
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => addSuggestion(s)}
                  disabled={already}
                  className={`rounded-lg border p-2 text-right transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/30 bg-card hover:border-primary hover:bg-primary/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs">{already ? '✓' : '＋'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    <span className="rounded bg-muted px-1.5 py-0 text-muted-foreground">{typeLabel}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0 text-primary">تأثير {s.influence}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0 text-primary">اهتمام {s.interest}</span>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

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
    </>
  )
}
