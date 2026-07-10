import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_BENCHMARK, type BenchmarkMetric } from '@/lib/deptStrategyBanks'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface Row {
  id: string
  metric: string
  ours: string
  comp1: string
  comp2: string
  comp3: string
}

interface BenchmarkData {
  competitors: { c1: string; c2: string; c3: string }
  rows: Row[]
}

const EMPTY: BenchmarkData = {
  competitors: { c1: 'منافس ١', c2: 'منافس ٢', c3: 'منافس ٣' },
  rows: [],
}

export function BenchmarkingPage() {
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_BENCHMARK[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `المقارنة المرجعية — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'المقارنة المرجعية'
  const description = isDeptScoped
    ? 'مقاييس مرجعية مخصّصة لتخصّصك مع أرقام السوق السعودي — اقبل ما يناسبك ثم قارن.'
    : 'قارن شركتك بثلاثة منافسين عبر مقاييس مفتاحية.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor companyId={companyId} specialty={isDeptScoped ? (specialty as DeptCode) : null} />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  const artifactType: ArtifactType = specialty ? `BENCHMARK_${specialty}` : 'BENCHMARK'
  const suggestions = specialty ? DEPT_BENCHMARK[specialty] ?? [] : []
  const [data, setData] = useState<BenchmarkData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BenchmarkData>(companyId, artifactType).then((row) => {
      if (row?.data) setData({ competitors: { ...EMPTY.competitors, ...row.data.competitors }, rows: row.data.rows ?? [] })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function addSuggestion(m: BenchmarkMetric) {
    const label = `${m.name} (${m.unit})`
    if (data.rows.some((r) => r.metric === label)) return
    setData((p) => ({
      ...p,
      rows: [
        ...p.rows,
        {
          id: crypto.randomUUID(),
          metric: label,
          ours: '',
          comp1: m.saudiBenchmark,  // نضع المرجع في عمود المنافس الأوّل
          comp2: '',
          comp3: '',
        },
      ],
    }))
  }
  function addAllSuggestions() {
    const existing = new Set(data.rows.map((r) => r.metric))
    const toAdd = suggestions.filter((s) => !existing.has(`${s.name} (${s.unit})`))
    if (toAdd.length === 0) return
    setData((p) => ({
      ...p,
      rows: [
        ...p.rows,
        ...toAdd.map((m) => ({
          id: crypto.randomUUID(),
          metric: `${m.name} (${m.unit})`,
          ours: '',
          comp1: m.saudiBenchmark,
          comp2: '',
          comp3: '',
        })),
      ],
      // نُغيّر اسم المنافس الأوّل إلى "المرجع السعودي" (لو كان الاسم الافتراضي).
      competitors: {
        ...p.competitors,
        c1: p.competitors.c1 === 'منافس ١' ? 'مرجع السوق السعودي' : p.competitors.c1,
      },
    }))
  }

  function addRow() {
    setData((p) => ({ ...p, rows: [...p.rows, { id: crypto.randomUUID(), metric: '', ours: '', comp1: '', comp2: '', comp3: '' }] }))
  }
  function setRow(id: string, patch: Partial<Row>) {
    setData((p) => ({ ...p, rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))
  }
  function removeRow(id: string) {
    setData((p) => ({ ...p, rows: p.rows.filter((r) => r.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, artifactType, data)
      toast.success('تم حفظ المقارنة')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
            </span>
            <span className="text-muted-foreground">
              المقاييس أدناه مخصّصة لإدارتك — أرقام مرجعية من السوق السعودي جاهزة للاستخدام.
            </span>
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="border-primary/40 bg-gradient-to-l from-primary/10 to-primary/5">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-sm">💡 مقاييس مرجعية لتخصّصك — انقر لإضافتها</CardTitle>
              <CardDescription>كل مقياس يأتي مع الوحدة + الرقم المرجعي في السوق السعودي + المصدر.</CardDescription>
            </div>
            {suggestions.some((s) => !data.rows.some((r) => r.metric === `${s.name} (${s.unit})`)) && (
              <Button size="sm" onClick={addAllSuggestions}>
                ＋ أضِف الكل ({suggestions.filter((s) => !data.rows.some((r) => r.metric === `${s.name} (${s.unit})`)).length})
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {suggestions.map((m) => {
              const already = data.rows.some((r) => r.metric === `${m.name} (${m.unit})`)
              return (
                <button
                  key={m.name}
                  type="button"
                  onClick={() => addSuggestion(m)}
                  disabled={already}
                  className={`rounded-lg border p-2.5 text-right transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/30 bg-card hover:border-primary hover:bg-primary/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{m.name}</span>
                    <span className="text-xs">{already ? '✓ مُضاف' : '＋ أضِف'}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                    <span className="rounded bg-muted px-1.5 py-0 text-muted-foreground">الوحدة: {m.unit}</span>
                    <span className="rounded bg-primary/10 px-1.5 py-0 text-primary font-bold">مرجع: {m.saudiBenchmark}</span>
                    <span className="rounded bg-muted/50 px-1.5 py-0 text-muted-foreground">من: {m.source}</span>
                  </div>
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card className="bg-gradient-to-bl from-violet-500/5 to-indigo-500/5">
        <CardHeader>
          <CardTitle>المنافسون</CardTitle>
          <CardDescription>سمِّ المنافسين الثلاثة الذين تقارن معهم (أو استخدم "مرجع السوق السعودي" في العمود الأوّل).</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-3">
          {(['c1', 'c2', 'c3'] as const).map((k) => (
            <Input
              key={k}
              value={data.competitors[k]}
              onChange={(e) => setData((p) => ({ ...p, competitors: { ...p.competitors, [k]: e.target.value } }))}
            />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>المقاييس</CardTitle>
          <CardDescription>{data.rows.length} صف.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-right text-muted-foreground">
                <th className="py-2">المقياس</th>
                <th className="py-2">شركتنا</th>
                <th className="py-2">{data.competitors.c1}</th>
                <th className="py-2">{data.competitors.c2}</th>
                <th className="py-2">{data.competitors.c3}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1"><Input value={r.metric} onChange={(e) => setRow(r.id, { metric: e.target.value })} /></td>
                  <td className="py-1"><Input value={r.ours} onChange={(e) => setRow(r.id, { ours: e.target.value })} /></td>
                  <td className="py-1"><Input value={r.comp1} onChange={(e) => setRow(r.id, { comp1: e.target.value })} /></td>
                  <td className="py-1"><Input value={r.comp2} onChange={(e) => setRow(r.id, { comp2: e.target.value })} /></td>
                  <td className="py-1"><Input value={r.comp3} onChange={(e) => setRow(r.id, { comp3: e.target.value })} /></td>
                  <td className="py-1"><Button variant="ghost" size="sm" onClick={() => removeRow(r.id)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={addRow}>+ مقياس</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
