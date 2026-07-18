import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { StrategicShell } from '@/components/strategic/StrategicShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { analyzeDeepAnswers, type DeepAnswers, type VCSuggestion } from '@/lib/deepAnalysisToVC'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import { DEPT_VALUE_CHAIN, type ActivityDef } from '@/lib/deptValueChain'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

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

// S2.2 — قوالب نصية جاهزة لكل نشاط، تُصنَّف حسب مستوى النضج.
// المدير يختار السطر الذي يصف وضعه ويضاف مع النضج المقابل تلقائياً.
const ACTIVITY_TEMPLATES: Record<string, { text: string; rating: 1 | 2 | 3 | 4 | 5 }[]> = {
  inboundLogistics: [
    { text: 'استلام يدوي، بلا نظام تتبّع.',                                   rating: 1 },
    { text: 'جداول Excel لتتبّع المدخلات.',                                     rating: 2 },
    { text: 'نظام ERP بسيط للمخزون والاستلام.',                                 rating: 3 },
    { text: 'ERP متكامل + رمز شريطي + تنبيهات نقص.',                            rating: 4 },
    { text: 'أتمتة كاملة (RFID / IoT) وتكامل مباشر مع المورّدين.',              rating: 5 },
  ],
  operations: [
    { text: 'عمليات يدوية بلا SOPs.',                                           rating: 1 },
    { text: 'SOPs مكتوبة لكنها غير مطبّقة بالكامل.',                            rating: 2 },
    { text: 'SOPs مطبّقة مع مراقبة دورية.',                                     rating: 3 },
    { text: 'Lean/Six Sigma + قياس OEE.',                                       rating: 4 },
    { text: 'أتمتة صناعية + KPIs مباشرة على الشاشات (Andon).',                  rating: 5 },
  ],
  outboundLogistics: [
    { text: 'تسليم يدوي، بلا تتبّع.',                                           rating: 1 },
    { text: 'جدولة أساسية للتسليم.',                                            rating: 2 },
    { text: 'شركات شحن متعدّدة مع تتبّع رقمي.',                                 rating: 3 },
    { text: 'تحسين مسارات + تسليم في اليوم التالي غالباً.',                     rating: 4 },
    { text: 'شبكة توزيع متطوّرة + تسليم في نفس اليوم.',                         rating: 5 },
  ],
  marketingSales: [
    { text: 'اعتماد على العلاقات الشخصية فقط.',                                 rating: 1 },
    { text: 'حضور رقمي محدود (ملفات، إعلانات مبعثرة).',                         rating: 2 },
    { text: 'حملات منظّمة مع CRM أساسي.',                                       rating: 3 },
    { text: 'CRM متقدّم + قمع مبيعات مقاس.',                                    rating: 4 },
    { text: 'أتمتة تسويق كاملة + استهداف بيانات ضخمة.',                         rating: 5 },
  ],
  service: [
    { text: 'لا يوجد فريق دعم مخصّص.',                                          rating: 1 },
    { text: 'دعم عبر البريد/الهاتف بلا SLA.',                                   rating: 2 },
    { text: 'نظام تذاكر مع SLA محدّد.',                                         rating: 3 },
    { text: 'دعم متعدّد القنوات + قاعدة معرفة.',                                rating: 4 },
    { text: 'دعم استباقي + شات‑بوت ذكاء اصطناعي.',                              rating: 5 },
  ],
  firmInfrastructure: [
    { text: 'حوكمة غير رسمية، قرارات فردية.',                                  rating: 1 },
    { text: 'مجلس إدارة اسمي، ميزانية سنوية بسيطة.',                            rating: 2 },
    { text: 'مجلس + لجان + تقارير دورية للمساهمين.',                            rating: 3 },
    { text: 'حوكمة معتمَدة + مراجعة داخلية.',                                   rating: 4 },
    { text: 'حوكمة رفيعة المستوى + إفصاح شفاف + استدامة.',                     rating: 5 },
  ],
  hrManagement: [
    { text: 'توظيف حسب الحاجة، بلا تخطيط.',                                    rating: 1 },
    { text: 'خطة توظيف بسيطة، تدريب محدود.',                                    rating: 2 },
    { text: 'خطة سنوية + تدريب دوري + تقييم أداء.',                             rating: 3 },
    { text: 'تطوير مسارات وظيفية + خطة تعاقب.',                                 rating: 4 },
    { text: 'HR رقمي شامل + برامج قيادة + ثقافة عالمية.',                       rating: 5 },
  ],
  tech: [
    { text: 'اعتماد على أدوات مكتبية (Office) فقط.',                            rating: 1 },
    { text: 'برامج جاهزة معزولة عن بعضها.',                                     rating: 2 },
    { text: 'تكامل بين الأنظمة الرئيسية.',                                      rating: 3 },
    { text: 'سحابة مركزية + أتمتة سير عمل.',                                    rating: 4 },
    { text: 'ذكاء اصطناعي + تحليلات متقدّمة.',                                  rating: 5 },
  ],
  procurement: [
    { text: 'شراء عشوائي، بلا موردين ثابتين.',                                  rating: 1 },
    { text: 'قائمة موردين معتمدين، عقود سنوية.',                                rating: 2 },
    { text: 'تقييم دوري للموردين + تفاوض منظّم.',                               rating: 3 },
    { text: 'إدارة سلسلة إمداد متكاملة (SCM).',                                 rating: 4 },
    { text: 'شراكات استراتيجية مع موردين + JIT.',                                rating: 5 },
  ],
}

function emptyActivity(): Activity {
  return { text: '', rating: 3 }
}

const EMPTY: ValueChainData = {
  primary: Object.fromEntries(PRIMARY_KEYS.map((k) => [k, emptyActivity()])) as Record<string, Activity>,
  support: Object.fromEntries(SUPPORT_KEYS.map((k) => [k, emptyActivity()])) as Record<string, Activity>,
}

export function ValueChainPage() {
  // نُحدّد السياق مبكراً: هل المستخدم مدير مستقل بتخصّص؟ لو نعم → نستخدم سلسلة
  // قيمة الإدارة (VALUE_CHAIN_<DEPT>) بدل سلسلة القيمة الكلاسيكية للشركة.
  const user = useAuthStore((s) => s.user)
  const isDeptScoped =
    user?.userType === 'MANAGER' &&
    user?.managerType === 'INDEPENDENT_PRO' &&
    user?.specialtyDeptType != null &&
    DEPT_VALUE_CHAIN[user.specialtyDeptType] != null

  const specialty = user?.specialtyDeptType ?? null
  const title = isDeptScoped
    ? `سلسلة القيمة — ${DEPT_LABEL[specialty as DeptCode]}`
    : 'سلسلة القيمة'
  const description = isDeptScoped
    ? 'الأنشطة الأساسية والمُمكِّنة لإدارة العميل، مع تقييم نضج كل نشاط.'
    : 'تحديد الأنشطة الأساسية والمساندة وفق نموذج بورتر، مع تقييم نضج كل نشاط من 1 إلى 5.'

  return (
    <StrategicShell title={title} description={description}>
      {(companyId) =>
        isDeptScoped
          ? <DeptScopedEditor companyId={companyId} specialty={specialty as DeptCode} />
          : <Editor companyId={companyId} />
      }
    </StrategicShell>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const [data, setData] = useState<ValueChainData>(EMPTY)
  const [saving, setSaving] = useState(false)
  // Phase — قراءة التحليل العميق لتوليد ترجيحات ذكيّة.
  const [deepAnswers, setDeepAnswers] = useState<DeepAnswers | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    getArtifact<ValueChainData>(companyId, 'VALUE_CHAIN').then((row) => {
      if (row?.data) {
        setData({
          primary: { ...EMPTY.primary, ...row.data.primary },
          support: { ...EMPTY.support, ...row.data.support },
        })
      }
    })
    // ← نقرأ إجابات التحليل العميق (٤ أسئلة multi-choice) لتوليد VC ذكي.
    getArtifact<DeepAnswers>(companyId, 'DEPT_DEEP_ANSWERS').then((row) => {
      if (row?.data) setDeepAnswers(row.data)
    }).catch(() => undefined)
  }, [companyId])

  const suggestions = useMemo(() => analyzeDeepAnswers(deepAnswers), [deepAnswers])
  const hasSuggestions = suggestions.length > 0
  const hasDeepAnswers = deepAnswers !== null

  function update(group: 'primary' | 'support', key: string, patch: Partial<Activity>) {
    setData((p) => ({
      ...p,
      [group]: { ...p[group], [key]: { ...(p[group][key] ?? emptyActivity()), ...patch } },
    }))
  }

  // تطبيق كل الترجيحات دفعة واحدة — يحوّل التحليل العميق إلى VC مكتمل.
  function generateFromDeepAnalysis() {
    if (!suggestions.length) return
    setGenerating(true)
    const nextPrimary = { ...data.primary }
    const nextSupport = { ...data.support }
    let applied = 0
    for (const sug of suggestions) {
      const isPrimary = (PRIMARY_KEYS as readonly string[]).includes(sug.activityKey)
      const target = isPrimary ? nextPrimary : nextSupport
      // نطبّق فقط إن كان النشاط فارغاً أو ذي rating افتراضي — نحترم التعديل اليدوي.
      const current = target[sug.activityKey] ?? emptyActivity()
      if (current.text.trim() === '') {
        target[sug.activityKey] = { text: sug.suggestedText, rating: sug.suggestedRating }
        applied++
      }
    }
    setData({ primary: nextPrimary, support: nextSupport })
    setGenerating(false)
    if (applied === 0) {
      toast.message('كل الأنشطة مُعبّأة يدوياً — التوليد لم يستبدل شيئاً.')
    } else {
      toast.success(`✨ ولّدنا ${applied} نشاطاً من التحليل العميق — راجع وعدّل ثم احفظ`)
    }
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
      {/* ← ربط ورائي: التحليل العميق يُغذّي سلسلة القيمة */}
      <DeepAnalysisSourceCard
        hasDeepAnswers={hasDeepAnswers}
        hasSuggestions={hasSuggestions}
        suggestionsCount={suggestions.length}
        onGenerate={generateFromDeepAnalysis}
        generating={generating}
        suggestions={suggestions}
      />

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
                  activityKey={k}
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
                  activityKey={k}
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

// ─── بطاقة الربط الورائي: التحليل العميق → سلسلة القيمة ────────
// تُعرض أعلى الصفحة. ٣ حالات:
//   • لا تحليل عميق → دعوة لتعبئته أوّلاً
//   • تحليل عميق موجود + توصيات → زر «✨ ولّد من التحليل العميق»
//   • تحليل عميق فارغ → إشعار
function DeepAnalysisSourceCard({
  hasDeepAnswers, hasSuggestions, suggestionsCount, onGenerate, generating, suggestions,
}: {
  hasDeepAnswers: boolean
  hasSuggestions: boolean
  suggestionsCount: number
  onGenerate: () => void
  generating: boolean
  suggestions: VCSuggestion[]
}) {
  if (!hasDeepAnswers) {
    return (
      <Card className="border-2 border-dashed border-amber-300 bg-amber-50/40">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔬</span>
            <div>
              <div className="text-sm font-bold text-amber-900">لا يوجد تحليل عميق بعد</div>
              <p className="mt-0.5 text-amber-800">
                لو عبّأت التحليل العميق (٤ أسئلة قيود/هشاشة/أتمتة/ممارسات جيّدة)،
                نُوَلِّد لك سلسلة القيمة تلقائياً بناءً على إجاباتك.
              </p>
            </div>
          </div>
          <Link
            to="/manager/dept-deep"
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-amber-700"
          >
            🔬 افتح التحليل العميق ←
          </Link>
        </CardContent>
      </Card>
    )
  }
  if (!hasSuggestions) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-3 text-xs text-muted-foreground">
          التحليل العميق موجود لكن بلا إجابات كافية لتوليد ترجيحات — أكمل التحليل العميق أوّلاً.
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-2 border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🔬</div>
            <div>
              <div className="text-sm font-bold">توليد ذكي من التحليل العميق</div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                لدينا <b className="text-foreground">{suggestionsCount}</b> ترجيح مستنبَط من إجاباتك في التحليل العميق
                (قيود · هشاشة · أتمتة · ممارسات جيّدة). سنُعبّئ الأنشطة الفارغة فقط — لن نستبدل ما كتبته يدويّاً.
              </p>
            </div>
          </div>
          <Button onClick={onGenerate} disabled={generating} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </div>
        {/* استعراض التوصيات المحسوبة قبل التطبيق */}
        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-medium text-primary hover:underline">
            ▼ استعرض التوصيات المحسوبة ({suggestionsCount})
          </summary>
          <ul className="mt-2 grid gap-1 text-[11px]">
            {suggestions.map((sug) => (
              <li key={sug.activityKey} className="rounded-md border bg-white/70 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{activityLabelAr(sug.activityKey)}</span>
                  <span className="tabular-nums text-muted-foreground">النضج المقترح: <b className="text-foreground">{sug.suggestedRating}★</b></span>
                </div>
                <div className="mt-0.5 text-muted-foreground">
                  {sug.suggestedText}
                </div>
                <div className="mt-1 text-[10px] italic text-muted-foreground/80">💡 {sug.reason}</div>
              </li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  )
}

function activityLabelAr(key: string): string {
  const labels: Record<string, string> = {
    inboundLogistics: '📥 الإمداد الداخلي',
    operations: '⚙️ العمليات',
    outboundLogistics: '📦 الإمداد الخارجي',
    marketingSales: '📣 التسويق والمبيعات',
    service: '🛠️ الخدمات بعد البيع',
    firmInfrastructure: '🏢 البنية المؤسّسيّة',
    hrManagement: '👥 الموارد البشريّة',
    tech: '💻 التقنية',
    procurement: '🛒 المشتريات',
  }
  return labels[key] ?? key
}

function ActivityCard({
  activityKey, title, icon, desc, tint, activity, onChange,
}: {
  activityKey: string
  title: string
  icon: string
  desc: string
  tint: string
  activity: Activity
  onChange: (patch: Partial<Activity>) => void
}) {
  const templates = ACTIVITY_TEMPLATES[activityKey] ?? []
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
      {templates.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">اختر ما يصفك (يضبط النضج):</div>
          {templates.map((t) => {
            const chosen = activity.text === t.text
            return (
              <button
                key={t.text}
                type="button"
                onClick={() => onChange({ text: t.text, rating: t.rating })}
                className={`block w-full rounded-md border px-2 py-1 text-right text-[11px] transition ${
                  chosen
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/20 bg-background/60 hover:bg-primary/5'
                }`}
              >
                <span className="tabular-nums font-bold text-muted-foreground">{t.rating}★</span>
                <span className="mr-1.5">{t.text}</span>
              </button>
            )
          })}
        </div>
      )}
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

// ─── سلسلة قيمة على مستوى الإدارة (للمدير المستقل الخبير) ───────────
// شكل التخزين: {core: Record<key, Activity>, enablers: Record<key, Activity>}
// نوع الـartifact: VALUE_CHAIN_<DEPT> — مستقلّ عن سلسلة القيمة الشركية.

interface DeptVCData {
  core: Record<string, Activity>
  enablers: Record<string, Activity>
}

function DeptScopedEditor({ companyId, specialty }: { companyId: string; specialty: DeptCode }) {
  const config = DEPT_VALUE_CHAIN[specialty]!
  const empty: DeptVCData = {
    core: Object.fromEntries(config.core.map((a) => [a.key, emptyActivity()])),
    enablers: Object.fromEntries(config.enablers.map((a) => [a.key, emptyActivity()])),
  }

  const [data, setData] = useState<DeptVCData>(empty)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    getArtifact<DeptVCData>(companyId, `VALUE_CHAIN_${specialty}`).then((row) => {
      if (row?.data) {
        setData({
          core: { ...empty.core, ...row.data.core },
          enablers: { ...empty.enablers, ...row.data.enablers },
        })
        setSavedAt(row.updatedAt)
      }
    }).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, specialty])

  function update(group: 'core' | 'enablers', key: string, patch: Partial<Activity>) {
    setData((p) => ({
      ...p,
      [group]: { ...p[group], [key]: { ...(p[group][key] ?? emptyActivity()), ...patch } },
    }))
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await upsertArtifact(companyId, `VALUE_CHAIN_${specialty}`, data)
      setSavedAt(saved.updatedAt)
      toast.success('تم حفظ سلسلة قيمة الإدارة')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  const all = [
    ...config.core.map((a) => data.core[a.key] ?? emptyActivity()),
    ...config.enablers.map((a) => data.enablers[a.key] ?? emptyActivity()),
  ]
  const avg = Math.round((all.reduce((s, a) => s + a.rating, 0) / all.length) * 20)

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
          <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
            🎯 السياق: إدارة {DEPT_LABEL[specialty]} فقط
          </span>
          <span className="text-muted-foreground">
            الأنشطة أدناه مخصّصة لهذه الإدارة (وليست سلسلة قيمة الشركة الكاملة).
          </span>
          {savedAt && (
            <span className="ml-auto text-muted-foreground">
              آخر حفظ: {new Date(savedAt).toLocaleDateString('ar-SA')}
            </span>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-emerald-500 via-teal-500 to-sky-500" />
        <CardHeader>
          <CardTitle>متوسط نضج الإدارة</CardTitle>
          <CardDescription>
            {config.core.length} نشاط أساسي + {config.enablers.length} مُمكِّن.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums text-emerald-700">{avg}%</div>
          <Progress value={avg} className="h-2" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            الأنشطة الأساسية للإدارة
          </CardTitle>
          <CardDescription>الأنشطة التي تُنتج قيمة إدارتك مباشرة.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            {config.core.map((a) => (
              <DeptActivityCard
                key={a.key}
                def={a}
                tint="border-sky-200 bg-sky-50/40"
                activity={data.core[a.key] ?? emptyActivity()}
                onChange={(patch) => update('core', a.key, patch)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-xl">🧱</span>
            الأنشطة المُمكِّنة
          </CardTitle>
          <CardDescription>الأنشطة الداعمة التي تُمكّن الأنشطة الأساسية.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {config.enablers.map((a) => (
              <DeptActivityCard
                key={a.key}
                def={a}
                tint="border-violet-200 bg-violet-50/40"
                activity={data.enablers[a.key] ?? emptyActivity()}
                onChange={(patch) => update('enablers', a.key, patch)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : 'حفظ سلسلة قيمة الإدارة'}
        </Button>
      </div>
    </>
  )
}

function DeptActivityCard({
  def, tint, activity, onChange,
}: {
  def: ActivityDef
  tint: string
  activity: Activity
  onChange: (patch: Partial<Activity>) => void
}) {
  return (
    <div className={`rounded-xl border p-3 ${tint}`}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{def.icon}</span>
        <h4 className="text-sm font-semibold">{def.labelAr}</h4>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{def.desc}</p>
      <Textarea
        rows={2}
        className="mt-2 bg-background"
        value={activity.text}
        onChange={(e) => onChange({ text: e.target.value })}
        placeholder="وصف موجز للوضع الحالي…"
      />
      {def.templates.length > 0 && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">اختر ما يصفك (يضبط النضج):</div>
          {def.templates.map((t) => {
            const chosen = activity.text === t.text
            return (
              <button
                key={t.text}
                type="button"
                onClick={() => onChange({ text: t.text, rating: t.rating })}
                className={`block w-full rounded-md border px-2 py-1 text-right text-[11px] transition ${
                  chosen
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-muted-foreground/20 bg-background/60 hover:bg-primary/5'
                }`}
              >
                <span className="tabular-nums font-bold text-muted-foreground">{t.rating}★</span>
                <span className="mr-1.5">{t.text}</span>
              </button>
            )
          })}
        </div>
      )}
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
