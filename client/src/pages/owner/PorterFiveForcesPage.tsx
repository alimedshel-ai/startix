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

const FORCES: { key: keyof PorterData; label: string; description: string; icon: string; tint: string }[] = [
  { key: 'rivalry',       label: 'حدة المنافسة',       description: 'حدّة التنافس بين المنافسين الحاليين.',  icon: '⚔️', tint: 'border-rose-200 bg-rose-50/50' },
  { key: 'supplierPower', label: 'قوة الموردين',        description: 'مدى قدرة الموردين على رفع الأسعار.',     icon: '🏭', tint: 'border-amber-200 bg-amber-50/50' },
  { key: 'buyerPower',    label: 'قوة المشترين',        description: 'مدى قدرة العملاء على الضغط لخفض السعر.',  icon: '🛒', tint: 'border-emerald-200 bg-emerald-50/50' },
  { key: 'substitutes',   label: 'تهديد البدائل',       description: 'بدائل من خارج الصناعة.',                  icon: '🔄', tint: 'border-violet-200 bg-violet-50/50' },
  { key: 'newEntrants',   label: 'تهديد الداخلين الجدد', description: 'سهولة دخول لاعبين جدد للسوق.',           icon: '🚪', tint: 'border-sky-200 bg-sky-50/50' },
]

export function PorterFiveForcesPage() {
  return (
    <StrategicShell title="قوى بورتر الخمس" description="قيّم كل قوة من ١ (ضعيفة) إلى ٥ (قوية) مع ملاحظات.">
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
      toast.success('تم حفظ التحليل')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const radar = FORCES.map((f) => ({ axis: f.label, value: (data[f.key].rating / 5) * 100 }))

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        {FORCES.map((f) => (
          <Card key={f.key} className={f.tint}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-xl">{f.icon}</span>
                {f.label}
              </CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">التقييم</Label>
                <select
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  value={data[f.key].rating}
                  onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], rating: Number(e.target.value) as Force['rating'] } }))}
                >
                  {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="text-xs text-muted-foreground">١ = ضعيفة · ٥ = قوية</span>
              </div>
              <Textarea
                rows={2}
                placeholder="ملاحظات…"
                value={data[f.key].notes}
                onChange={(e) => setData((p) => ({ ...p, [f.key]: { ...p[f.key], notes: e.target.value } }))}
              />
            </CardContent>
          </Card>
        ))}
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-violet-500/5">
        <CardHeader>
          <CardTitle>الخماسي</CardTitle>
          <CardDescription>عرض مرئي لضغط القوى.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadarChart data={radar} height={360} />
        </CardContent>
      </Card>
    </div>
  )
}
