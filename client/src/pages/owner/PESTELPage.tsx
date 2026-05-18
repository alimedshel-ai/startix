import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Factor {
  id: string
  text: string
  impact: 1 | 2 | 3 | 4 | 5
}

type Section = 'political' | 'economic' | 'social' | 'technological' | 'environmental' | 'legal'

interface PESTELData {
  political: Factor[]
  economic: Factor[]
  social: Factor[]
  technological: Factor[]
  environmental: Factor[]
  legal: Factor[]
}

const SECTIONS: { key: Section; label: string; color: string }[] = [
  { key: 'political',      label: 'Political',     color: 'bg-red-50' },
  { key: 'economic',       label: 'Economic',      color: 'bg-amber-50' },
  { key: 'social',         label: 'Social',        color: 'bg-yellow-50' },
  { key: 'technological',  label: 'Technological', color: 'bg-emerald-50' },
  { key: 'environmental',  label: 'Environmental', color: 'bg-sky-50' },
  { key: 'legal',          label: 'Legal',         color: 'bg-violet-50' },
]

const EMPTY: PESTELData = {
  political: [], economic: [], social: [], technological: [], environmental: [], legal: [],
}

export function PESTELPage() {
  return (
    <StrategicShell
      title="PESTEL analysis"
      description="External-environment scan across 6 dimensions. Rate impact 1–5 per factor."
    >
      {(companyId) => <PESTELEditor companyId={companyId} />}
    </StrategicShell>
  )
}

function PESTELEditor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<PESTELData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<PESTELData>(companyId, 'PESTEL').then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data })
    })
  }, [companyId])

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'PESTEL', data)
      toast.success('PESTEL saved')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function add(section: Section) {
    setData((prev) => ({
      ...prev,
      [section]: [...prev[section], { id: crypto.randomUUID(), text: '', impact: 3 }],
    }))
  }
  function update(section: Section, id: string, patch: Partial<Factor>) {
    setData((prev) => ({
      ...prev,
      [section]: prev[section].map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }))
  }
  function remove(section: Section, id: string) {
    setData((prev) => ({ ...prev, [section]: prev[section].filter((f) => f.id !== id) }))
  }

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.key} className={s.color}>
            <CardHeader>
              <CardTitle className="text-base">{s.label}</CardTitle>
              <CardDescription>{data[s.key].length} factor{data[s.key].length === 1 ? '' : 's'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data[s.key].map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input
                    value={f.text}
                    placeholder="Factor description"
                    onChange={(e) => update(s.key, f.id, { text: e.target.value })}
                  />
                  <select
                    className="rounded border bg-background px-2 py-1 text-xs"
                    value={f.impact}
                    onChange={(e) => update(s.key, f.id, { impact: Number(e.target.value) as Factor['impact'] })}
                  >
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>Impact {v}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => remove(s.key, f.id)}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => add(s.key)}>+ Factor</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save PESTEL'}</Button>
      </div>
    </>
  )
}
