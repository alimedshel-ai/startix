import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DEPT_LABEL,
  listDepartments,
  submitDeptSmart,
  type Department,
} from '@/lib/deptApi'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'

interface KPIRow {
  name: string
  unit: string
  targetValue: number
  frequency: string
}

interface InsightRow {
  axis: string
  severity: string
  insight: string
}

export function DeptSmartPage() {
  const scope = useClientScopedCompany()
  const company = scope.company
  const [departments, setDepartments] = useState<Department[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [recs, setRecs] = useState<{ kpis: KPIRow[]; insights: InsightRow[] } | null>(null)
  const [deptsLoading, setDeptsLoading] = useState(false)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    if (!company) return
    let cancel = false
    setDeptsLoading(true)
    setDepartments([])
    setSelected(null)
    setRecs(null)
    ;(async () => {
      try {
        const list = await listDepartments(company.id)
        if (cancel) return
        setDepartments(list)
        const audited = list.find((d) => (d.auditScore ?? 0) > 0)
        if (audited) setSelected(audited.id)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل الأقسام'
        toast.error(msg)
      } finally {
        if (!cancel) setDeptsLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [company])

  const loading = scope.loading || deptsLoading

  const selectedDept = useMemo(() => departments.find((d) => d.id === selected) ?? null, [departments, selected])

  async function run() {
    if (!selected) return
    setRunning(true)
    try {
      const { recommendations } = await submitDeptSmart(selected)
      setRecs(recommendations)
      toast.success('تم توليد مؤشرات الأداء والرؤى.')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر توليد التوصيات'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={company ? `توصيات SMART — ${company.name}` : 'توصيات SMART'}
        description={
          scope.error
            ? scope.error
            : 'أهداف مؤشرات الأداء لكل قسم ورؤى مستخلصة من آخر تدقيق.'
        }
      />

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {!loading && departments.length === 0 && (
        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-200">
          <CardHeader>
            <CardTitle>لا توجد أقسام بعد</CardTitle>
            <CardDescription>اختر قسماً ونفّذ تدقيقه أولاً.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && departments.length > 0 && (
        <Card className="bg-gradient-to-br from-teal-500/10 to-transparent border-teal-200">
          <CardHeader>
            <CardTitle>اختر القسم</CardTitle>
            <CardDescription>الأقسام التي تم تدقيقها فقط يمكنها توليد التوصيات.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {departments.map((d) => (
              <Button
                key={d.id}
                size="sm"
                variant={selected === d.id ? 'default' : 'outline'}
                onClick={() => setSelected(d.id)}
                disabled={!d.auditScore}
              >
                {DEPT_LABEL[d.type]}
                {d.auditScore != null && <span className="ml-1 text-xs tabular-nums">({Math.round(d.auditScore)}%)</span>}
              </Button>
            ))}
            <div className="ml-auto">
              <Button onClick={run} disabled={!selected || running}>
                {running ? 'جاري التوليد…' : 'توليد'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {recs && selectedDept && (
        <>
          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-l from-teal-500 via-cyan-500 to-emerald-500" />
            <CardHeader>
              <CardTitle>أهداف مؤشرات الأداء — {DEPT_LABEL[selectedDept.type]}</CardTitle>
              <CardDescription>{recs.kpis.length} مؤشر معدّل حسب صحة التدقيق لديك.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-right text-muted-foreground">
                    <th className="py-2">مؤشر الأداء</th>
                    <th className="py-2">الهدف</th>
                    <th className="py-2">الوحدة</th>
                    <th className="py-2">التكرار</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.kpis.map((k) => (
                    <tr key={k.name} className="border-b">
                      <td className="py-2 font-medium">{k.name}</td>
                      <td className="py-2 tabular-nums">{k.targetValue}</td>
                      <td className="py-2 text-muted-foreground">{k.unit}</td>
                      <td className="py-2 text-muted-foreground">{k.frequency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {recs.insights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>رؤى</CardTitle>
                <CardDescription>المحاور الأقل نقاطاً تقود التوصيات.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {recs.insights.map((i) => (
                    <li key={i.axis} className="rounded border p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                      <div className="text-xs font-medium uppercase text-muted-foreground">{i.axis} · {i.severity}</div>
                      <p className="mt-1">{i.insight}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
