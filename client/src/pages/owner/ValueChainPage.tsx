import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

interface Activity {
  text: string
  rating: 1 | 2 | 3 | 4 | 5
}

interface ValueChainData {
  primary: Record<string, Activity>
  support: Record<string, Activity>
}

const PRIMARY_KEYS = ['inboundLogistics', 'operations', 'outboundLogistics', 'marketingSales', 'service'] as const
const SUPPORT_KEYS = ['firmInfrastructure', 'hrManagement', 'tech', 'procurement'] as const

const PRIMARY_LABELS: Record<typeof PRIMARY_KEYS[number], { title: string; icon: string; desc: string }> = {
  inboundLogistics:  { title: 'الإمداد الداخلي',     icon: '📥', desc: 'استقبال وتخزين المواد والمدخلات.' },
  operations:        { title: 'العمليات',             icon: '⚙️', desc: 'تحويل المدخلات إلى منتج أو خدمة.' },
  outboundLogistics: { title: 'الإمداد الخارجي',     icon: '📦', desc: 'تخزين وتوصيل المنتج للعميل.' },
  marketingSales:    { title: 'التسويق والمبيعات',    icon: '📣', desc: 'إيصال القيمة للعميل وإقناعه بالشراء.' },
  service:           { title: 'الخدمات بعد البيع',   icon: '🛠️', desc: 'دعم ما بعد البيع، تركيب، صيانة، إرجاع.' },
}

const SUPPORT_LABELS: Record<typeof SUPPORT_KEYS[number], { title: string; icon: string; desc: string }> = {
  firmInfrastructure: { title: 'البنية المؤسسية',       icon: '🏢', desc: 'إدارة عامة، حوكمة، تخطيط، تمويل.' },
  hrManagement:       { title: 'إدارة الموارد البشرية', icon: '👥', desc: 'توظيف، تدريب، تطوير، تعويض.' },
  tech:               { title: 'تطوير التقنية',         icon: '💻', desc: 'بحث وتطوير، تصميم، أتمتة، أدوات.' },
  procurement:        { title: 'المشتريات',             icon: '🛒', desc: 'تأمين المدخلات من الموردين.' },
}

function emptyActivity(): Activity {
  return { text: '', rating: 3 }
}

const EMPTY: ValueChainData = {
  primary: Object.fromEntries(PRIMARY_KEYS.map((k) => [k, emptyActivity()])) as Record<string, Activity>,
  support: Object.fromEntries(SUPPORT_KEYS.map((k) => [k, emptyActivity()])) as Record<string, Activity>,
}

export function ValueChainPage() {
  return (
    <StrategicShell
      title="سلسلة القيمة"
      description="تحديد الأنشطة الأساسية والمساندة وفق نموذج بورتر، مع تقييم نضج كل نشاط من 1 إلى 5."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<ValueChainData>(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getArtifact<ValueChainData>(companyId, 'VALUE_CHAIN').then((row) => {
      if (row?.data) {
        setData({
          primary: { ...EMPTY.primary, ...row.data.primary },
          support: { ...EMPTY.support, ...row.data.support },
        })
      }
    })
  }, [companyId])

  function update(group: 'primary' | 'support', key: string, patch: Partial<Activity>) {
    setData((p) => ({
      ...p,
      [group]: { ...p[group], [key]: { ...(p[group][key] ?? emptyActivity()), ...patch } },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'VALUE_CHAIN', data)
      toast.success('تم حفظ سلسلة القيمة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const allActivities = [
    ...PRIMARY_KEYS.map((k) => data.primary[k]),
    ...SUPPORT_KEYS.map((k) => data.support[k]),
  ]
  const avgRating = allActivities.length === 0 ? 0 : Math.round((allActivities.reduce((s, a) => s + a.rating, 0) / allActivities.length) * 20)

  return (
    <>
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>متوسط نضج السلسلة</CardTitle>
          <CardDescription>متوسط تقييم كل الأنشطة الأساسية والمساندة.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums text-emerald-700">{avgRating}%</div>
          <Progress value={avgRating} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            الأنشطة الأساسية
          </CardTitle>
          <CardDescription>الأنشطة التي تخلق القيمة مباشرة للعميل.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {PRIMARY_KEYS.map((k) => {
              const meta = PRIMARY_LABELS[k]
              const activity = data.primary[k] ?? emptyActivity()
              return (
                <ActivityCard
                  key={k}
                  title={meta.title}
                  icon={meta.icon}
                  desc={meta.desc}
                  tint="border-sky-200 bg-sky-50/40"
                  activity={activity}
                  onChange={(patch) => update('primary', k, patch)}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">🧱</span>
            الأنشطة المساندة
          </CardTitle>
          <CardDescription>الأنشطة التي تدعم الأنشطة الأساسية.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {SUPPORT_KEYS.map((k) => {
              const meta = SUPPORT_LABELS[k]
              const activity = data.support[k] ?? emptyActivity()
              return (
                <ActivityCard
                  key={k}
                  title={meta.title}
                  icon={meta.icon}
                  desc={meta.desc}
                  tint="border-violet-200 bg-violet-50/40"
                  activity={activity}
                  onChange={(patch) => update('support', k, patch)}
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ سلسلة القيمة'}</Button>
      </div>
    </>
  )
}

function ActivityCard({
  title, icon, desc, tint, activity, onChange,
}: {
  title: string
  icon: string
  desc: string
  tint: string
  activity: Activity
  onChange: (patch: Partial<Activity>) => void
}) {
  return (
    <div className={`rounded-xl border p-3 ${tint}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      <Textarea
        rows={2}
        className="mt-2 bg-background"
        value={activity.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="وصف موجز للوضع الحالي…"
      />
      <div className="mt-2 flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">النضج:</span>
        <select
          className="rounded-md border bg-background px-2 py-1"
          value={activity.rating}
          onChange={(e) => onChange({ rating: Number(e.target.value) as Activity['rating'] })}
        >
          {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <span className="text-muted-foreground">1 = ضعيف · 5 = ممتاز</span>
      </div>
    </div>
  )
}
