import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_ORG_DNA } from '@/lib/deptStrategyBanks'
import { getArtifact, upsertArtifact, type ArtifactType } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

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
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_ORG_DNA[user.specialtyDeptType] != null
  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `الحمض التنظيمي — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'الحمض التنظيمي'
  const description = isDeptScoped
    ? 'رؤية ورسالة وقيم إدارة العميل — مقترحات جاهزة يقبلها المدير ويعدّلها.'
    : 'الرؤية، الرسالة، القيم، نمط الثقافة، والهيكل التنظيمي — هوية المنشأة.'
  return (
    <StrategicShell title={title} description={description}>
      {(companyId) => (
        <Editor companyId={companyId} specialty={isDeptScoped ? (specialty as DeptCode) : null} />
      )}
    </StrategicShell>
  )
}

function Editor({ companyId, specialty }: { companyId: string; specialty: DeptCode | null }) {
  const artifactType: ArtifactType = specialty ? `ORG_DNA_${specialty}` : 'ORG_DNA'
  const suggestions = specialty ? DEPT_ORG_DNA[specialty] : null
  const [data, setData] = useState<OrgDNAData>(EMPTY)
  const [newValue, setNewValue] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<OrgDNAData>(companyId, artifactType).then((row) => {
      if (row?.data) setData({ ...EMPTY, ...row.data, values: row.data.values ?? [] })
    }).catch(() => undefined)
  }, [companyId, artifactType])

  function pickVision(v: string)  { setData((p) => ({ ...p, vision: v })) }
  function pickMission(m: string) { setData((p) => ({ ...p, mission: m })) }
  function toggleValue(v: string) {
    setData((p) => ({
      ...p,
      values: p.values.includes(v) ? p.values.filter((x) => x !== v) : [...p.values, v],
    }))
  }
  function fillFromDept() {
    if (!suggestions) return
    setData((p) => ({
      ...p,
      vision:  p.vision.trim()  ? p.vision  : suggestions.vision[0],
      mission: p.mission.trim() ? p.mission : suggestions.mission[0],
      values:  p.values.length > 0 ? p.values : suggestions.values,
    }))
    toast.success('🧠 تم ملء الرؤية والرسالة والقيم من بنك تخصّصك — عدّل حسب سياق عميلك.')
  }

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
      await upsertArtifact(companyId, artifactType, data)
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
      {specialty && suggestions && (
        <>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
              </span>
              <span className="text-muted-foreground">
                مقترحات رؤية/رسالة/قيم مخصّصة لإدارة العميل — اقبل الأقرب أو ابدأ يدوياً.
              </span>
            </CardContent>
          </Card>

          <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
            <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="text-3xl" aria-hidden>🧠</div>
                <div>
                  <div className="text-sm font-bold">توليد تلقائي من بنك تخصّصك</div>
                  <div className="text-xs text-muted-foreground">
                    نملأ الرؤية والرسالة والقيم بمقترحات مبنيّة على أفضل الممارسات — يبقى الحقل قابلاً للتعديل بالكامل.
                  </div>
                </div>
              </div>
              <Button onClick={fillFromDept} size="lg">✨ ولّد الآن</Button>
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-500/10 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="text-xl">🔭</span>
              الرؤية
            </CardTitle>
            <CardDescription>إلى أين تتطلع شركتك خلال 5–10 سنوات؟</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              rows={4}
              value={data.vision}
              onChange={(e) => setData((p) => ({ ...p, vision: e.target.value }))}
              placeholder="أن نكون…"
            />
            {suggestions && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">مقترحات:</div>
                {suggestions.vision.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => pickVision(v)}
                    className={`block w-full rounded-md border px-2 py-1 text-right text-[11px] transition ${
                      data.vision === v
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/20 bg-background/60 hover:bg-primary/5'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
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
          <CardContent className="space-y-2">
            <Textarea
              rows={4}
              value={data.mission}
              onChange={(e) => setData((p) => ({ ...p, mission: e.target.value }))}
              placeholder="نحن نوفر…"
            />
            {suggestions && (
              <div className="space-y-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">مقترحات:</div>
                {suggestions.mission.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => pickMission(m)}
                    className={`block w-full rounded-md border px-2 py-1 text-right text-[11px] transition ${
                      data.mission === m
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/20 bg-background/60 hover:bg-primary/5'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
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
            {suggestions && suggestions.values.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2">
                <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  💡 قيم مقترحة لتخصّصك — انقر للاختيار/الإلغاء:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.values.map((v) => {
                    const chosen = data.values.includes(v)
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => toggleValue(v)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                          chosen
                            ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                            : 'border-primary/30 bg-card hover:bg-primary hover:text-primary-foreground'
                        }`}
                      >
                        {chosen ? '✓ ' : '＋ '}{v}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addValue())}
                placeholder="أو اكتب قيمة مخصّصة…"
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
