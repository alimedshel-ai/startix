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

const SECTIONS: { key: Section; label: string; gradient: string; icon: string }[] = [
  { key: 'political',     label: 'سياسي',    icon: '🏛️', gradient: 'from-rose-500/15 to-rose-500/0 border-rose-200' },
  { key: 'economic',      label: 'اقتصادي',   icon: '💰', gradient: 'from-amber-500/15 to-amber-500/0 border-amber-200' },
  { key: 'social',        label: 'اجتماعي',   icon: '👥', gradient: 'from-yellow-500/15 to-yellow-500/0 border-yellow-200' },
  { key: 'technological', label: 'تقني',     icon: '💻', gradient: 'from-emerald-500/15 to-emerald-500/0 border-emerald-200' },
  { key: 'environmental', label: 'بيئي',     icon: '🌿', gradient: 'from-sky-500/15 to-sky-500/0 border-sky-200' },
  { key: 'legal',         label: 'قانوني',   icon: '⚖️', gradient: 'from-violet-500/15 to-violet-500/0 border-violet-200' },
]

const EMPTY: PESTELData = {
  political: [], economic: [], social: [], technological: [], environmental: [], legal: [],
}

export function PESTELPage() {
  return (
    <StrategicShell
      title="تحليل PESTEL"
      description="مسح للبيئة الخارجية عبر ٦ أبعاد. قيّم أثر كل عامل من ١ إلى ٥."
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
      toast.success('تم حفظ تحليل PESTEL')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
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
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.key} className={`bg-gradient-to-br ${s.gradient}`}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{s.icon}</span>
                {s.label}
              </CardTitle>
              <CardDescription>{data[s.key].length} عامل</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data[s.key].map((f) => (
                <div key={f.id} className="flex items-center gap-2">
                  <Input
                    value={f.text}
                    placeholder="وصف العامل"
                    onChange={(e) => update(s.key, f.id, { text: e.target.value })}
                  />
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={f.impact}
                    onChange={(e) => update(s.key, f.id, { impact: Number(e.target.value) as Factor['impact'] })}
                  >
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>أثر {v}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => remove(s.key, f.id)}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => add(s.key)}>+ عامل</Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ التحليل'}</Button>
      </div>
    </>
  )
}
