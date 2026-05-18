import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DEPT_LABEL,
  getMyFirstCompany,
  listDepartments,
  submitDeptSmart,
  type Department,
} from '@/lib/deptApi'

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
  const [departments, setDepartments] = useState<Department[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [recs, setRecs] = useState<{ kpis: KPIRow[]; insights: InsightRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (!company) {
          toast.error('Complete the manager diagnostic first')
          setLoading(false)
          return
        }
        const list = await listDepartments(company.id)
        if (cancel) return
        setDepartments(list)
        const audited = list.find((d) => (d.auditScore ?? 0) > 0)
        if (audited) setSelected(audited.id)
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not load departments'
        toast.error(msg)
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  const selectedDept = useMemo(() => departments.find((d) => d.id === selected) ?? null, [departments, selected])

  async function run() {
    if (!selected) return
    setRunning(true)
    try {
      const { recommendations } = await submitDeptSmart(selected)
      setRecs(recommendations)
      toast.success('KPIs and insights generated.')
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Could not generate recommendations'
      toast.error(msg)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="SMART recommendations"
        description="Per-department KPI targets and insights derived from the latest audit."
      />

      {loading && <Card><CardHeader><CardTitle>Loading…</CardTitle></CardHeader></Card>}

      {!loading && departments.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>No departments yet</CardTitle>
            <CardDescription>Pick a department and run its audit first.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {!loading && departments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose department</CardTitle>
            <CardDescription>Only departments with an audit can generate recommendations.</CardDescription>
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
                {d.auditScore != null && <span className="ml-1 text-xs">({Math.round(d.auditScore)}%)</span>}
              </Button>
            ))}
            <div className="ml-auto">
              <Button onClick={run} disabled={!selected || running}>
                {running ? 'Running…' : 'Generate'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {recs && selectedDept && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>KPI targets — {DEPT_LABEL[selectedDept.type]}</CardTitle>
              <CardDescription>{recs.kpis.length} KPIs adjusted to your audit health.</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2">KPI</th>
                    <th className="py-2">Target</th>
                    <th className="py-2">Unit</th>
                    <th className="py-2">Frequency</th>
                  </tr>
                </thead>
                <tbody>
                  {recs.kpis.map((k) => (
                    <tr key={k.name} className="border-b">
                      <td className="py-2 font-medium">{k.name}</td>
                      <td className="py-2">{k.targetValue}</td>
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
                <CardTitle>Insights</CardTitle>
                <CardDescription>Lowest-scoring axes drive the recommendations.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {recs.insights.map((i) => (
                    <li key={i.axis} className="rounded border p-3">
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
