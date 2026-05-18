import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadarChart } from '@/components/charts/RadarChart'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Force {
  rating: 1 | 2 | 3 | 4 | 5
  notes: string
}

interface PorterData {
  rivalry: Force
  supplierPower: Force
  buyerPower: Force
  substitutes: Force
  newEntrants: Force
}

const EMPTY: PorterData = {
  rivalry:       { rating: 3, notes: '' },
  supplierPower: { rating: 3, notes: '' },
  buyerPower:    { rating: 3, notes: '' },
  substitutes:   { rating: 3, notes: '' },
  newEntrants:   { rating: 3, notes: '' },
}

const FORCES: { key: keyof PorterData; label: string; description: string }[] = [
  { key: 'rivalry',       label: 'Competitive rivalry', description: 'Intensity among existing competitors.' },
  { key: 'supplierPower', label: 'Supplier power',      description: 'How easily can suppliers raise prices?' },
  { key: 'buyerPower',    label: 'Buyer power',         description: 'How easily can customers push prices down?' },
  { key: 'substitutes',   label: 'Threat of substitutes', description: 'Alternatives outside the industry.' },
  { key: 'newEntrants',   label: 'Threat of new entrants', description: 'How easy is it to enter the market?' },
]

export function PorterFiveForcesPage() {
  return (
    <StrategicShell title="Porter five forces" description="Rate each force 1 (weak) – 5 (strong) and capture notes.">
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<PorterData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<PorterData>(companyId, 'PORTER').then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data })
    })
  }, [companyId])

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'PORTER', data)
      toast.success('Porter saved')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const radar = FORCES.map((f) => ({ axis: f.label, value: (data[f.key].rating / 5) * 100 }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        {FORCES.map((f) => (
          <Card key={f.key}>
            <CardHeader>
              <CardTitle className="text-base">{f.label}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Rating</Label>
                <select
                  className="rounded border bg-background px-2 py-1 text-sm"
                  value={data[f.key].rating}
                  onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], rating: Number(e.target.value) as Force['rating'] } }))}
                >
                  {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">1 = weak · 5 = strong</span>
              </div>
              <Textarea
                rows={2}
                placeholder="Notes…"
                value={data[f.key].notes}
                onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], notes: e.target.value } }))}
              />
            </CardContent>
          </Card>
        ))}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pentagon</CardTitle>
          <CardDescription>Visual snapshot of force pressure.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadarChart data={radar} height={360} />
        </CardContent>
      </Card>
    </div>
  )
}
