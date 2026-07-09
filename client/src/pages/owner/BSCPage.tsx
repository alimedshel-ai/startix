import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

// ─── R6.2 — Balanced Scorecard ─────────────────────────────────────
// ٤ أبعاد: مالي، عملاء، عمليات داخلية، تعلّم ونموّ. لكل بُعد أهداف +
// مؤشرات + مبادرات (نصوص حرة). المصدر: Kaplan & Norton (1996).
// حفظ: StrategicArtifact بنوع BSC.

type PerspectiveKey = 'financial' | 'customer' | 'internal' | 'learning'

interface BSCPerspective {
  objectives: string
  measures: string
  initiatives: string
  target: string
}

interface BSCData {
  perspectives: Record<PerspectiveKey, BSCPerspective>
}

const EMPTY_PERSPECTIVE: BSCPerspective = { objectives: '', measures: '', initiatives: '', target: '' }
const EMPTY: BSCData = {
  perspectives: {
    financial: { ...EMPTY_PERSPECTIVE },
    customer: { ...EMPTY_PERSPECTIVE },
    internal: { ...EMPTY_PERSPECTIVE },
    learning: { ...EMPTY_PERSPECTIVE },
  },
}

const PERSPECTIVES: {
  key: PerspectiveKey; labelAr: string; icon: string; descAr: string; accent: string
}[] = [
  { key: 'financial', icon: '💰', labelAr: 'مالي',           descAr: 'كيف نبدو للمساهمين ماليّاً؟', accent: 'border-emerald-300 bg-emerald-50/40' },
  { key: 'customer',  icon: '👥', labelAr: 'العملاء',        descAr: 'كيف يرانا عملاؤنا؟',            accent: 'border-sky-300 bg-sky-50/40' },
  { key: 'internal',  icon: '⚙️', labelAr: 'العمليات الداخلية', descAr: 'في ماذا يجب أن نتفوّق؟',       accent: 'border-amber-300 bg-amber-50/40' },
  { key: 'learning',  icon: '📚', labelAr: 'التعلّم والنموّ',  descAr: 'كيف نستمرّ في التحسّن؟',       accent: 'border-violet-300 bg-violet-50/40' },
]

export function BSCPage() {
  return (
    <StrategicShell
      title="Balanced Scorecard (BSC)"
      description="٤ أبعاد مترابطة لتحويل الاستراتيجية إلى قياس متوازن."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const [data, setData] = useState<BSCData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<BSCData>(companyId, 'BSC').then((row) => {
      if (row?.data?.perspectives) {
        setData({
          perspectives: {
            financial: { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.financial },
            customer:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.customer },
            internal:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.internal },
            learning:  { ...EMPTY_PERSPECTIVE, ...row.data.perspectives.learning },
          },
        })
      }
    }).catch(() => undefined)
  }, [companyId])

  function setField(key: PerspectiveKey, field: keyof BSCPerspective, value: string) {
    setData((p) => ({
      perspectives: { ...p.perspectives, [key]: { ...p.perspectives[key], [field]: value } },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'BSC', data)
      toast.success('تم حفظ BSC')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <OpexHint opex={company?.opex} focus={['target', 'budget']} title="OPEX يُغذّي البُعد المالي" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div>
            <CardTitle>الأبعاد الأربعة</CardTitle>
            <CardDescription>لكل بُعد: أهداف، مقاييس، قيمة مستهدفة، مبادرات.</CardDescription>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? 'جاري الحفظ…' : 'حفظ'}
          </Button>
        </CardHeader>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {PERSPECTIVES.map((p) => (
          <Card key={p.key} className={p.accent}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span aria-hidden>{p.icon}</span>
                {p.labelAr}
              </CardTitle>
              <CardDescription>{p.descAr}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">الأهداف</label>
                <Textarea
                  rows={2}
                  value={data.perspectives[p.key].objectives}
                  onChange={(e) => setField(p.key, 'objectives', e.target.value)}
                  placeholder="مثال: زيادة هامش الربح ٢٠٪…"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">المقاييس</label>
                  <Textarea
                    rows={2}
                    value={data.perspectives[p.key].measures}
                    onChange={(e) => setField(p.key, 'measures', e.target.value)}
                    placeholder="ROI، NPS، …"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">القيمة المستهدفة</label>
                  <Input
                    value={data.perspectives[p.key].target}
                    onChange={(e) => setField(p.key, 'target', e.target.value)}
                    placeholder="مثال: 25%"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">المبادرات</label>
                <Textarea
                  rows={2}
                  value={data.perspectives[p.key].initiatives}
                  onChange={(e) => setField(p.key, 'initiatives', e.target.value)}
                  placeholder="ما الخطوات لتحقيق الهدف؟"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
