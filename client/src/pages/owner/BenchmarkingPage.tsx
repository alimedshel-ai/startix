import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

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
  competitors: { c1: 'Competitor 1', c2: 'Competitor 2', c3: 'Competitor 3' },
  rows: [],
}

export function BenchmarkingPage() {
  return (
    <StrategicShell title="Benchmarking" description="Compare your company against three named competitors across key metrics.">
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<BenchmarkData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BenchmarkData>(companyId, 'BENCHMARK').then((row) => {
      if (row?.data) setData({ competitors: { ...EMPTY.competitors, ...row.data.competitors }, rows: row.data.rows ?? [] })
    })
  }, [companyId])

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
      await upsertArtifact(companyId, 'BENCHMARK', data)
      toast.success('Benchmark saved')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Competitors</CardTitle>
          <CardDescription>Name the three competitors you are comparing against.</CardDescription>
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
          <CardTitle>Metrics</CardTitle>
          <CardDescription>{data.rows.length} row{data.rows.length === 1 ? '' : 's'}.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Metric</th>
                <th className="py-2">Ours</th>
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
            <Button variant="outline" size="sm" onClick={addRow}>+ Metric</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
