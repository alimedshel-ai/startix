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
  competitors: { c1: 'منافس ١', c2: 'منافس ٢', c3: 'منافس ٣' },
  rows: [],
}

export function BenchmarkingPage() {
  return (
    <StrategicShell title="المقارنة المرجعية" description="قارن شركتك بثلاثة منافسين عبر مقاييس مفتاحية.">
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
      toast.success('تم حفظ المقارنة')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Card className="bg-gradient-to-bl from-violet-500/5 to-indigo-500/5">
        <CardHeader>
          <CardTitle>المنافسون</CardTitle>
          <CardDescription>سمِّ المنافسين الثلاثة الذين تقارن معهم.</CardDescription>
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
