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

export function StakeholdersPage() {
  return (
    <StrategicShell title="Stakeholders" description="Map name × type × influence × interest. Plotted on a 2×2 quadrant chart.">
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
      toast.success('Stakeholders saved')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const scatter = data.rows.map((r) => ({ name: r.name || '—', influence: r.influence, interest: r.interest }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Stakeholders</CardTitle>
          <CardDescription>{data.rows.length} entries.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">Name</th>
                <th className="py-2">Type</th>
                <th className="py-2">Influence</th>
                <th className="py-2">Interest</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 pr-1"><Input value={r.name} onChange={(e) => set(r.id, { name: e.target.value })} placeholder="Name" /></td>
                  <td className="py-1 pr-1">
                    <select className="rounded border bg-background px-2 py-1 text-xs" value={r.type} onChange={(e) => set(r.id, { type: e.target.value })}>
                      <option value="internal">Internal</option>
                      <option value="customer">Customer</option>
                      <option value="supplier">Supplier</option>
                      <option value="regulator">Regulator</option>
                      <option value="investor">Investor</option>
                      <option value="other">Other</option>
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className="rounded border bg-background px-2 py-1 text-xs" value={r.influence} onChange={(e) => set(r.id, { influence: Number(e.target.value) as Stakeholder['influence'] })}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-1">
                    <select className="rounded border bg-background px-2 py-1 text-xs" value={r.interest} onChange={(e) => set(r.id, { interest: Number(e.target.value) as Stakeholder['interest'] })}>
                      {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </td>
                  <td className="py-1"><Button variant="ghost" size="sm" onClick={() => remove(r.id)}>×</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 flex justify-between">
            <Button variant="outline" size="sm" onClick={add}>+ Stakeholder</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Influence × Interest</CardTitle>
          <CardDescription>Top-right: manage closely. Top-left: keep satisfied. Bottom-right: keep informed.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={340}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" dataKey="interest" name="Interest" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
              <YAxis type="number" dataKey="influence" name="Influence" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
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
