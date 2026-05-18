import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface OrgDNAData {
  vision: string
  mission: string
  values: string[]
  cultureType: string
  orgStructure: string
}

const CULTURE_TYPES = [
  ['clan',      'عشائرية — تعاون وعائلية'],
  ['adhocracy', 'مبتكرة — تجريب وإبداع'],
  ['market',    'سوقية — تنافسية ونتائج'],
  ['hierarchy', 'هرمية — انضباط وإجراءات'],
] as const

const STRUCTURES = [
  ['functional', 'وظيفية (حسب التخصص)'],
  ['divisional', 'تقسيمية (حسب المنتج/السوق)'],
  ['matrix',     'مصفوفية (مزدوجة)'],
  ['flat',       'مسطّحة (قليلة الطبقات)'],
  ['network',    'شبكية (شراكات خارجية)'],
] as const

const EMPTY: OrgDNAData = {
  vision: '',
  mission: '',
  values: [],
  cultureType: 'clan',
  orgStructure: 'functional',
}

export function OrgDNAPage() {
  return (
    <StrategicShell
      title="الحمض التنظيمي"
      description="الرؤية، الرسالة، القيم، نمط الثقافة، والهيكل التنظيمي — هوية المنشأة."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<OrgDNAData>(EMPTY)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<OrgDNAData>(companyId, 'ORG_DNA').then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data, values: row.data.values ?? [] })
    })
  }, [companyId])

  function addValue() {
    const v = newValue.trim()
    if (!v) return
    setData((p) => ({ ...p, values: [...p.values, v] }))
    setNewValue('')
  }
  function removeValue(i: number) {
    setData((p) => ({ ...p, values: p.values.filter((_, idx) => idx !== i) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'ORG_DNA', data)
      toast.success('تم حفظ الحمض التنظيمي')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const cultureLabel = CULTURE_TYPES.find((c) => c[0] === data.cultureType)?.[1] ?? data.cultureType
  const structureLabel = STRUCTURES.find((s) => s[0] === data.orgStructure)?.[1] ?? data.orgStructure

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🔭</span>
              الرؤية
            </CardTitle>
            <CardDescription>إلى أين تتطلع شركتك خلال 5–10 سنوات؟</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={data.vision}
              onChange={(e) => setData((p) => ({ ...p, vision: e.target.value }))}
              placeholder="أن نكون…"
            />
          </CardContent>
        </Card>

        <Card className="border-violet-200 bg-gradient-to-br from-violet-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🎯</span>
              الرسالة
            </CardTitle>
            <CardDescription>ما الذي تفعله الشركة وكيف ولمن؟</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={4}
              value={data.mission}
              onChange={(e) => setData((p) => ({ ...p, mission: e.target.value }))}
              placeholder="نحن نوفر…"
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 border-rose-200 bg-gradient-to-br from-rose-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">💎</span>
              القيم الجوهرية
            </CardTitle>
            <CardDescription>السلوكيات غير القابلة للتفاوض ({data.values.length} قيمة).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
                placeholder="مثال: الشفافية، الجودة، التعاون…"
              />
              <Button variant="outline" onClick={addValue}>إضافة</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {data.values.map((v, i) => (
                <span
                  key={`${v}-${i}`}
                  className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm"
                >
                  <span className="text-rose-700">{v}</span>
                  <button
                    type="button"
                    onClick={() => removeValue(i)}
                    className="text-muted-foreground transition hover:text-destructive"
                  >
                    ×
                  </button>
                </span>
              ))}
              {data.values.length === 0 && (
                <span className="text-xs text-muted-foreground">أضف 3–7 قيم تصف منشأتك حقاً.</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🎭</span>
              نمط الثقافة
            </CardTitle>
            <CardDescription>الإطار الثقافي المهيمن داخل الفريق.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="cultureType">النمط</Label>
            <select
              id="cultureType"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={data.cultureType}
              onChange={(e) => setData((p) => ({ ...p, cultureType: e.target.value }))}
            >
              {CULTURE_TYPES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{cultureLabel}</p>
          </CardContent>
        </Card>

        <Card className="border-sky-200 bg-gradient-to-br from-sky-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🏗️</span>
              الهيكل التنظيمي
            </CardTitle>
            <CardDescription>كيف تُوزّع المسؤوليات وتُتخذ القرارات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="orgStructure">النوع</Label>
            <select
              id="orgStructure"
              className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
              value={data.orgStructure}
              onChange={(e) => setData((p) => ({ ...p, orgStructure: e.target.value }))}
            >
              {STRUCTURES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">{structureLabel}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ الحمض التنظيمي'}</Button>
      </div>
    </>
  )
}
