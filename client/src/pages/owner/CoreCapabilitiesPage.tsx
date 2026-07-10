import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import type { DeptCode } from '@/lib/deptApi'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

interface Capability {
  id: string
  name: string
  description?: string
  maturity: 1 | 2 | 3 | 4 | 5
  isCore: boolean
}

interface CoreCapData {
  capabilities: Capability[]
}

const EMPTY: CoreCapData = { capabilities: [] }

const MATURITY_LABEL: Record<number, string> = {
  1: 'ضعيف جداً',
  2: 'ضعيف',
  3: 'متوسط',
  4: 'قوي',
  5: 'ممتاز',
}

const MATURITY_COLOR: Record<number, string> = {
  1: 'hsl(0 75% 55%)',
  2: 'hsl(25 85% 55%)',
  3: 'hsl(45 90% 55%)',
  4: 'hsl(150 60% 45%)',
  5: 'hsl(160 70% 40%)',
}

// S2.3 — قدرات مقترحة شائعة حسب تخصّص المدير المستقل.
// المدير ينقر → تُضاف إلى القائمة كقدرة جديدة بنضج مبدئي = 3.
const CAP_SUGGESTIONS: Partial<Record<DeptCode, string[]>> = {
  HR: [
    'استقطاب الكفاءات', 'الاحتفاظ بالموظفين', 'التطوير المهني',
    'ثقافة أداء', 'قيادة تنفيذية', 'توطين الكفاءات',
  ],
  FINANCE: [
    'التحكم في التكاليف', 'تحليل الربحية', 'التخطيط المالي',
    'إدارة النقد', 'شفافية التقارير', 'إدارة المخاطر المالية',
  ],
  SALES: [
    'إغلاق الصفقات الكبيرة', 'توليد العملاء المحتملين', 'التسعير الديناميكي',
    'إدارة الحسابات الرئيسية', 'التنبّؤ بالإيرادات', 'قنوات بيع متعدّدة',
  ],
  MARKETING: [
    'بناء العلامة التجارية', 'تسويق رقمي', 'تحليل السوق',
    'قصص محتوى قوية', 'ولاء العملاء', 'استهداف دقيق للجمهور',
  ],
  OPERATIONS: [
    'كفاءة سلاسل الإمداد', 'أتمتة العمليات', 'ضبط الجودة',
    'مرونة الإنتاج', 'إدارة السعة', 'Lean/Six Sigma',
  ],
  IT: [
    'أمن سيبراني', 'موثوقية البنية التحتية', 'تكامل الأنظمة',
    'DevOps وسرعة النشر', 'الذكاء الاصطناعي وتحليل البيانات', 'الحوسبة السحابية',
  ],
  CUSTOMER_SERVICE: [
    'حل شكاوى سريع (FCR)', 'رضا العملاء العالي', 'دعم متعدّد القنوات',
    'قاعدة معرفة قوية', 'تدريب الفريق', 'تخصيص الخدمة',
  ],
  SUPPORT: [
    'إدارة المشتريات', 'تفاوض مع المورّدين', 'إدارة الأصول',
    'صيانة استباقية', 'إدارة العقود', 'دعم لوجستي',
  ],
  LOGISTICS: [
    'شبكة توزيع واسعة', 'كفاءة تسليم OTIF', 'إدارة المخزون',
    'أتمتة المستودعات', 'تنويع الناقلين', 'تتبّع الشحنات',
  ],
  QUALITY: [
    'شهادات ISO', 'خفض معدل العيوب', 'ضبط عمليات SPC',
    'CAPA فعّال', 'ثقافة جودة شاملة', 'تدقيق مستمر',
  ],
  PROJECTS: [
    'تسليم في الموعد', 'ضمن الميزانية', 'إدارة المخاطر',
    'PMO ناضج', 'منهجية مرنة (Agile)', 'إدارة أصحاب المصلحة',
  ],
  COMPLIANCE: [
    'التزام ZATCA', 'التزام GOSI', 'حماية البيانات PDPL',
    'مراجعة داخلية', 'أخلاقيات وحوكمة', 'التزام قطاعي متخصّص',
  ],
  GOVERNANCE: [
    'فعالية مجلس الإدارة', 'استقلالية اللجان', 'إفصاح شفاف',
    'إدارة المخاطر المؤسسية', 'تدقيق داخلي مستقل', 'قيم أخلاقية معتمَدة',
  ],
}

export function CoreCapabilitiesPage() {
  return (
    <StrategicShell
      title="القدرات الجوهرية"
      description="القدرات التي تميّز شركتك عن المنافسين. حدّد قدرة، قيّم نضجها، وحدد إن كانت جوهرية."
    >
      {(companyId) => <Editor companyId={companyId} />}
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const suggestions = specialty ? CAP_SUGGESTIONS[specialty] ?? [] : []
  const [data, setData] = useState<CoreCapData>(EMPTY)
  const [saving, setSaving] = useState(false)

  function addSuggestion(name: string) {
    if (data.capabilities.some((c) => c.name === name)) return
    setData((p) => ({
      capabilities: [
        ...p.capabilities,
        { id: crypto.randomUUID(), name, description: '', maturity: 3, isCore: false },
      ],
    }))
  }

  useEffect(() => {
    getArtifact<CoreCapData>(companyId, 'CORE_CAPABILITIES').then((row) => {
      if (row?.data) setData({ capabilities: row.data.capabilities ?? [] })
    })
  }, [companyId])

  function add() {
    setData((p) => ({
      capabilities: [
        ...p.capabilities,
        { id: crypto.randomUUID(), name: '', description: '', maturity: 3, isCore: false },
      ],
    }))
  }
  function update(id: string, patch: Partial<Capability>) {
    setData((p) => ({
      capabilities: p.capabilities.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }))
  }
  function remove(id: string) {
    setData((p) => ({ capabilities: p.capabilities.filter((c) => c.id !== id) }))
  }

  async function save() {
    setSaving(true)
    try {
      await upsertArtifact(companyId, 'CORE_CAPABILITIES', data)
      toast.success('تم حفظ القدرات')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const chartData = data.capabilities
    .filter((c) => c.name.trim())
    .map((c) => ({ name: c.name, maturity: c.maturity, isCore: c.isCore }))
    .sort((a, b) => b.maturity - a.maturity)

  const coreCount = data.capabilities.filter((c) => c.isCore).length
  const avgMaturity = data.capabilities.length === 0
    ? 0
    : Math.round((data.capabilities.reduce((s, c) => s + c.maturity, 0) / data.capabilities.length) * 20)

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-fuchsia-200 bg-gradient-to-br from-fuchsia-500/10 to-transparent">
          <CardHeader>
            <CardDescription>إجمالي القدرات</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-fuchsia-700">{data.capabilities.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 bg-gradient-to-br from-amber-500/10 to-transparent">
          <CardHeader>
            <CardDescription>القدرات الجوهرية</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-amber-700">{coreCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-emerald-200 bg-gradient-to-br from-emerald-500/10 to-transparent">
          <CardHeader>
            <CardDescription>متوسط النضج</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-emerald-700">{avgMaturity}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {suggestions.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💡 قدرات مقترحة لتخصّصك — انقر للإضافة</CardTitle>
            <CardDescription>ابدأ بالقدرات الشائعة في مجالك، ثم صنّف الجوهرية منها.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => {
              const already = data.capabilities.some((c) => c.name === s)
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSuggestion(s)}
                  disabled={already}
                  className={`rounded-full border px-2.5 py-1 text-xs transition ${
                    already
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                      : 'border-primary/40 bg-card hover:bg-primary hover:text-primary-foreground'
                  }`}
                >
                  {already ? '✓ ' : '＋ '}{s}
                </button>
              )
            })}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>القدرات</CardTitle>
            <CardDescription>أضف قدرة جوهرية، قيّم نضجها، وميّزها كجوهرية إذا كانت تميّزك تنافسياً.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.capabilities.map((c) => (
              <div key={c.id} className="rounded-xl border bg-card p-3 transition hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <Input
                    value={c.name}
                    placeholder="اسم القدرة (مثال: تطوير منتج سريع)"
                    onChange={(e) => update(c.id, { name: e.target.value })}
                    className="flex-1"
                  />
                  <label className="flex shrink-0 items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={c.isCore}
                      onChange={(e) => update(c.id, { isCore: e.target.checked })}
                    />
                    جوهرية
                  </label>
                  <select
                    className="rounded-md border bg-background px-2 py-1 text-xs"
                    value={c.maturity}
                    onChange={(e) => update(c.id, { maturity: Number(e.target.value) as Capability['maturity'] })}
                  >
                    {[1, 2, 3, 4, 5].map((v) => <option key={v} value={v}>{v} — {MATURITY_LABEL[v]}</option>)}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>×</Button>
                </div>
                <Textarea
                  rows={2}
                  className="mt-2"
                  value={c.description ?? ''}
                  onChange={(e) => update(c.id, { description: e.target.value })}
                  placeholder="وصف اختياري للقدرة وأين تظهر…"
                />
              </div>
            ))}
            {data.capabilities.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                لا توجد قدرات بعد. ابدأ بإضافة 5–10 قدرات تميّز شركتك.
              </p>
            )}
            <div className="flex justify-between pt-1">
              <Button variant="outline" size="sm" onClick={add}>+ قدرة جديدة</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ'}</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>الرسم البياني</CardTitle>
            <CardDescription>القدرات مرتبة حسب النضج.</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground">أدخل قدرة وأعطها اسماً لرؤيتها هنا.</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(220, chartData.length * 32 + 40)}>
                <BarChart data={chartData} layout="vertical" margin={{ right: 12, left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="maturity" radius={[0, 6, 6, 0]}>
                    {chartData.map((d, i) => (
                      <rect key={i} fill={MATURITY_COLOR[d.maturity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
