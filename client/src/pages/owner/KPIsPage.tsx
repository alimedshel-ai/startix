import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { OpexHint } from '@/components/OpexHint'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import {
  DEPT_KPI_BANK, GENERAL_KPI_BANK,
  IMPORTANCE_META, KPI_CATEGORY_META,
  findKPIMeta, isKPIInPath,
  type KPICategory, type KPISuggestion,
} from '@/lib/deptKPIs'
import { generateSCurve } from '@/lib/sCurve'
import { createKPI, deleteKPI, listKPIs, listObjectives, updateKPI, type KPI, type Objective } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

const FREQS = [
  ['daily',     'يومي'],
  ['weekly',    'أسبوعي'],
  ['monthly',   'شهري'],
  ['quarterly', 'ربعي'],
  ['annual',    'سنوي'],
] as const

function freqLabel(f: string): string {
  return FREQS.find((x) => x[0] === f)?.[1] ?? f
}

function pct(k: KPI): number {
  if (!k.targetValue) return 0
  return Math.min(150, Math.round((k.currentValue / k.targetValue) * 100))
}

function statusOf(p: number): { label: string; tint: string } {
  if (p >= 95) return { label: 'محقق',      tint: 'border-emerald-300 bg-emerald-50/60' }
  if (p >= 70) return { label: 'في المسار', tint: 'border-sky-300 bg-sky-50/60' }
  if (p >= 40) return { label: 'في خطر',    tint: 'border-amber-300 bg-amber-50/60' }
  return { label: 'متعثر', tint: 'border-rose-300 bg-rose-50/60' }
}

export function KPIsPage() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const q = client ? `&client=${client}` : ''
  return <Navigate to={`/measure?tab=kpis${q}`} replace />
}

export function KPIsView({ companyId }: { companyId: string }) {
  return <Editor companyId={companyId} />
}

// شريط تنقّل — الطريق: الأهداف ↔ OGSM ↔ KPIs ↔ إدخالات ↔ BSC.
function CrossNavBar() {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2 text-xs">
      <span className="text-muted-foreground">
        💡 KPIs تُغذّي OGSM و BSC والإدخالات — كلها متّصلة.
      </span>
      <div className="flex flex-wrap gap-2">
        <Link
          to={`/measure?tab=objectives${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          🎯 الأهداف ←
        </Link>
        <Link
          to={`/measure?tab=ogsm${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          🧩 OGSM ←
        </Link>
        <Link
          to={`/measure?tab=bsc${qs}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          ⚖️ BSC ←
        </Link>
      </div>
    </div>
  )
}

// CTA الخطوة التاليّة — تظهر عند وجود KPI واحد على الأقل.
// إن لم توجد → تحذير: أنشئ KPI قبل الانتقال إلى الإدخالات.
function NextStepCTA({ kpisCount, hasUnsavedForm }: { kpisCount: number; hasUnsavedForm: boolean }) {
  const [params] = useSearchParams()
  const client = params.get('client')
  const qs = client ? `&client=${client}` : ''

  function handleNavigate(e: React.MouseEvent<HTMLAnchorElement>) {
    if (hasUnsavedForm) {
      const ok = confirm(
        'لديك حقول لم تحفظ بعد في نموذج «مؤشر جديد».\n\n' +
        'إن انتقلت الآن ستفقد ما كتبته. متأكّد من الانتقال؟'
      )
      if (!ok) e.preventDefault()
    }
  }

  if (kpisCount === 0) {
    return (
      <Card className="border-2 border-amber-300 bg-amber-50/40">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-amber-900">⚠️ أنشئ KPI واحداً على الأقل</CardTitle>
            <CardDescription>
              الإدخالات تعتمد على وجود مؤشّرات. أنشئ مؤشراً من الأعلى (يدوي أو ✨ ولّد الآن أو من البنك)،
              ثم يمكنك الانتقال إلى صفحة الإدخالات لتسجيل القيم الدوريّة.
            </CardDescription>
          </div>
          {/* الأزرار مُعطَّلة بصريّاً */}
          <div className="flex flex-wrap gap-2">
            <span
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border bg-muted/50 px-3 py-2 text-sm font-medium text-muted-foreground opacity-60"
              title="أنشئ KPI أوّلاً"
            >
              ✍️ إدخالات KPIs 🔒
            </span>
          </div>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-emerald-300 bg-emerald-50/40">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base text-emerald-900">✓ {kpisCount} مؤشر جاهز — الخطوة التاليّة</CardTitle>
          <CardDescription>
            سجّل قيم دوريّة لهذه المؤشّرات لتتبّع الاتجاه عبر الوقت، أو راجع OGSM و BSC.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/measure?tab=entries${qs}`}
            onClick={handleNavigate}
            className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            ✍️ إدخالات KPIs ←
          </Link>
          <Link
            to={`/measure?tab=ogsm${qs}`}
            onClick={handleNavigate}
            className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
          >
            🧩 OGSM ←
          </Link>
        </div>
      </CardHeader>
    </Card>
  )
}

function Editor({ companyId }: { companyId: string }) {
  const { company } = useCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null
  const strategyPath = user?.strategyPath ?? null
  const bank = specialty ? DEPT_KPI_BANK[specialty] ?? GENERAL_KPI_BANK : GENERAL_KPI_BANK

  const [kpis, setKpis] = useState<KPI[]>([])
  const [objectives, setObjectives] = useState<Objective[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<KPICategory | null>(null)

  // R4.2 — لو OPEX.target موجود، نقترحه للـfrequency الحالي كافتراضي.
  const opexTarget = company?.opex?.target
  const suggestTarget = (freq: string) =>
    opexTarget == null ? '100'
    : freq === 'annual'    ? String(opexTarget)
    : freq === 'quarterly' ? String(Math.round(opexTarget / 4))
    : freq === 'monthly'   ? String(Math.round(opexTarget / 12))
    : freq === 'weekly'    ? String(Math.round(opexTarget / 52))
    : freq === 'daily'     ? String(Math.round(opexTarget / 365))
    : '100'
  // Phase 1 — أضِفنا حقل baseline لبدء مسار S-Curve. افتراضياً فارغ.
  const [form, setForm] = useState({ name: '', unit: '%', targetValue: '100', baselineValue: '', frequency: 'monthly' })
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    setFetchError(null)
    Promise.all([
      listKPIs(companyId).catch((err) => { console.error('[KPIs] listKPIs failed:', err); throw err }),
      listObjectives(companyId).catch(() => []),
    ]).then(([ks, obs]) => {
      setKpis(ks)
      setObjectives(obs)
    }).catch((err) => {
      setFetchError(apiErrorMessage(err, 'تعذّر جلب المؤشّرات من الخادم'))
    }).finally(() => setLoading(false))
  }, [companyId])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const target = Number(form.targetValue)
    if (!Number.isFinite(target) || target <= 0) {
      toast.error('قيمة مستهدفة غير صالحة')
      return
    }
    // Phase 1 — لو أُدخل baseline صالح، نُولّد منحنى S تلقائياً بمدى ١٢ شهراً
    // (بحسب frequency: annual=١٢، quarterly=١٢، monthly=١٢، weekly=٣، daily=١).
    const baselineNum = form.baselineValue.trim() ? Number(form.baselineValue) : NaN
    const hasBaseline = Number.isFinite(baselineNum) && baselineNum !== target
    const durationMap: Record<string, number> = { daily: 1, weekly: 3, monthly: 12, quarterly: 12, annual: 12 }
    const duration = durationMap[form.frequency] ?? 12
    const expectedPath = hasBaseline
      ? generateSCurve({ baseline: baselineNum, target, durationMonths: duration })
      : undefined
    setCreating(true)
    try {
      const k = await createKPI({
        companyId,
        name: form.name,
        unit: form.unit,
        targetValue: target,
        currentValue: hasBaseline ? baselineNum : undefined,
        frequency: form.frequency,
        baselineValue: hasBaseline ? baselineNum : undefined,
        expectedPath,
        startedAt: hasBaseline ? new Date().toISOString() : undefined,
      })
      setKpis((p) => [...p, k])
      setForm({ name: '', unit: '%', targetValue: '100', baselineValue: '', frequency: form.frequency })
      toast.success(hasBaseline
        ? `✓ أُنشئ مع منحنى S: ${baselineNum} → ${target} خلال ${duration} شهراً`
        : 'تم إنشاء المؤشر')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإنشاء'))
    } finally {
      setCreating(false)
    }
  }

  // إضافة مؤشر من البنك بضغطة واحدة — يستعمل ميتاداتاه للـtarget والوحدة.
  async function addSuggestion(sug: KPISuggestion) {
    if (kpis.some((k) => k.name === sug.name)) {
      toast.message(`«${sug.name}» مضاف مسبقاً.`)
      return
    }
    try {
      const k = await createKPI({
        companyId,
        name: sug.name,
        unit: sug.unit,
        targetValue: sug.defaultTarget,
        frequency: sug.frequency,
      })
      setKpis((p) => [...p, k])
      toast.success(`＋ ${sug.name}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الإضافة'))
    }
  }

  // 🧠 توليد تلقائي — من الأهداف المحفوظة + المؤشرات الحرجة في البنك.
  async function generateFromContext() {
    setGenerating(true)
    try {
      const existing = new Set(kpis.map((k) => k.name.trim()))
      const toCreate: KPISuggestion[] = []

      // 1) لكل هدف بلا مؤشر → نُنشئ مؤشراً افتراضياً بنفس الاسم.
      const objectivesWithoutKpi = objectives.filter(
        (o) => !kpis.some((k) => k.objectiveId === o.id) &&
               !existing.has(`إنجاز: ${o.title}`),
      )
      for (const obj of objectivesWithoutKpi.slice(0, 3)) {
        const t = `إنجاز: ${obj.title.slice(0, 40)}`
        if (existing.has(t)) continue
        toCreate.push({
          name: t, unit: '%', defaultTarget: 100, frequency: 'quarterly',
          category: 'efficiency', importance: 'important',
          why: `يقيس تنفيذ هدف: ${obj.title}`,
          pathFit: ['QUICK', 'MEDIUM', 'LONG'],
        })
        existing.add(t)
      }

      // 2) المؤشرات الحرجة (critical) من البنك المطابقة للمسار.
      const criticalInPath = bank
        .filter((s) => s.importance === 'critical' && isKPIInPath(s, strategyPath))
        .filter((s) => !existing.has(s.name))
      for (const s of criticalInPath.slice(0, 4)) {
        toCreate.push(s)
        existing.add(s.name)
      }

      // 3) إن لم يوجد شيء بعد، نأخذ ٢-٣ مهمّة (important).
      if (toCreate.length < 3) {
        const importantInPath = bank
          .filter((s) => s.importance === 'important' && isKPIInPath(s, strategyPath))
          .filter((s) => !existing.has(s.name))
        for (const s of importantInPath.slice(0, 3 - toCreate.length)) {
          toCreate.push(s)
          existing.add(s.name)
        }
      }

      if (toCreate.length === 0) {
        toast.error('لا مؤشرات جديدة للتوليد — أضِف أهدافاً أو غيّر مسارك.')
        return
      }
      // إنشاء KPIs على السيرفر بالتوازي.
      const created = await Promise.all(
        toCreate.map((s) =>
          createKPI({
            companyId,
            name: s.name,
            unit: s.unit,
            targetValue: s.defaultTarget,
            frequency: s.frequency,
          }).catch(() => null),
        ),
      )
      const okCreated = created.filter((c): c is KPI => c != null)
      setKpis((p) => [...p, ...okCreated])
      toast.success(`🧠 أُضيف ${okCreated.length} مؤشر: ${objectivesWithoutKpi.length > 0 ? 'من الأهداف + ' : ''}من البنك (${strategyPath ?? 'كل المسارات'}).`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر التوليد التلقائي'))
    } finally {
      setGenerating(false)
    }
  }

  async function updateCurrent(id: string, currentValue: number) {
    try {
      const updated = await updateKPI(id, { currentValue })
      setKpis((p) => p.map((k) => (k.id === id ? { ...k, ...updated } : k)))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل التحديث'))
    }
  }

  async function remove(k: KPI) {
    if (!confirm(`حذف المؤشر "${k.name}"؟`)) return
    try {
      await deleteKPI(k.id)
      setKpis((p) => p.filter((x) => x.id !== k.id))
      toast.success('تم الحذف')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'فشل الحذف'))
    }
  }

  // إحصاءات الحالات (محقق/في المسار/في خطر/متعثر).
  const stats = kpis.reduce<Record<string, number>>((acc, k) => {
    const s = statusOf(pct(k)).label
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  // البنك المفلتَر بحسب الفئة (لعرض مقترحات).
  const bankFiltered = useMemo(() => {
    let items = bank.filter((s) => !kpis.some((k) => k.name === s.name))
    if (categoryFilter) items = items.filter((s) => s.category === categoryFilter)
    // ترتيب: المطابق للمسار أولاً + الحرج قبل المهم.
    return items.sort((a, b) => {
      const aIn = isKPIInPath(a, strategyPath) ? 1 : 0
      const bIn = isKPIInPath(b, strategyPath) ? 1 : 0
      if (aIn !== bIn) return bIn - aIn
      const impRank: Record<string, number> = { critical: 3, important: 2, nice: 1 }
      return impRank[b.importance] - impRank[a.importance]
    })
  }, [bank, kpis, categoryFilter, strategyPath])

  // فئات موجودة في البنك (لبناء رقائق الفلترة).
  const categoriesInBank = useMemo(() => {
    const set = new Set<KPICategory>()
    for (const s of bank) set.add(s.category)
    return Array.from(set)
  }, [bank])

  const hasUnsavedForm = form.name.trim().length > 0

  return (
    <>
      {fetchError && (
        <Card className="border-rose-300 bg-rose-50/60">
          <CardHeader>
            <CardTitle className="text-rose-900">⚠️ تعذّر جلب KPIs</CardTitle>
            <CardDescription className="text-rose-800">
              {fetchError} — companyId: <code className="rounded bg-white/70 px-1.5 py-0.5 text-[11px]">{companyId}</code>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            راجع Developer Console (F12) وطلب <code>GET /api/strategic/kpis/{companyId}</code>.
          </CardContent>
        </Card>
      )}

      <CrossNavBar />

      {/* شارة السياق للمدير المستقل */}
      {specialty && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-3 p-3 text-xs">
            <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
              🎯 السياق: إدارة {DEPT_LABEL[specialty]}
            </span>
            {strategyPath && (
              <span className="rounded-full border bg-card px-2 py-0.5 font-medium">
                {strategyPath === 'QUICK' ? '⚡ مسارك: تشغيلي (قصير)' : strategyPath === 'MEDIUM' ? '🎯 مسارك: تكتيكي (متوسّط)' : '🔭 مسارك: استراتيجي (طويل)'}
              </span>
            )}
            <span className="text-muted-foreground">
              المؤشرات المُقترَحة مُصفّاة بحسب تخصّصك ومسارك — البنك يحوي {bank.length} مؤشر مع «لماذا».
            </span>
          </CardContent>
        </Card>
      )}

      {/* بطاقات الحالة الأربع */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/60">
          <CardHeader>
            <CardDescription>محقق</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-emerald-700">{stats['محقق'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-sky-200 bg-sky-50/60">
          <CardHeader>
            <CardDescription>في المسار</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-sky-700">{stats['في المسار'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardDescription>في خطر</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-amber-700">{stats['في خطر'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-rose-200 bg-rose-50/60">
          <CardHeader>
            <CardDescription>متعثر</CardDescription>
            <CardTitle className="text-2xl tabular-nums text-rose-700">{stats['متعثر'] ?? 0}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <OpexHint opex={company?.opex} focus={['budget', 'target']} title="أرقام لتغذية المستهدفات" />

      {/* 🧠 توليد تلقائي — من الأهداف + المؤشرات الحرجة في البنك */}
      <Card className="border-primary/40 bg-gradient-to-l from-primary/15 to-primary/5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>🧠</div>
            <div>
              <div className="text-sm font-bold">توليد تلقائي — من أهدافك + البنك المطابق لمسارك</div>
              <div className="text-xs text-muted-foreground">
                نقرأ {objectives.length} هدف محفوظ + نختار المؤشرات الحرجة/المهمّة المطابقة لمسارك ({strategyPath ?? '—'}).
                {objectives.length === 0 && ' لا أهداف بعد — سيُنشأ من البنك فقط.'}
              </div>
            </div>
          </div>
          <Button onClick={generateFromContext} disabled={generating || creating} size="lg">
            {generating ? 'جاري…' : '✨ ولّد الآن'}
          </Button>
        </CardContent>
      </Card>

      {/* 💡 بنك المقترحات — مصنّف حسب الفئة، مطابق لتخصّصك ومسارك */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">💡 بنك المقترحات — {bankFiltered.length} متاح</CardTitle>
              <CardDescription className="text-xs">
                كل مؤشر مع «لماذا» يوضّح أهميته. اضغط «＋ إضِف» لإنشاء المؤشر مباشرة.
              </CardDescription>
            </div>
            {categoriesInBank.length > 1 && (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] ${
                    categoryFilter === null ? 'border-primary bg-primary/15 text-primary' : 'bg-card hover:bg-muted'
                  }`}
                >
                  كل الفئات
                </button>
                {categoriesInBank.map((c) => {
                  const meta = KPI_CATEGORY_META[c]
                  const active = categoryFilter === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategoryFilter(active ? null : c)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${
                        active ? 'border-primary bg-primary/15 text-primary' : meta.color
                      }`}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.labelAr}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {bankFiltered.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
              {categoryFilter
                ? 'لا مؤشرات في هذه الفئة — امسح الفلترة.'
                : 'كل المؤشرات في البنك مضافة سلفاً — أحسنت!'}
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {bankFiltered.slice(0, 12).map((s) => (
                <SuggestionRow
                  key={s.name}
                  sug={s}
                  matchesPath={isKPIInPath(s, strategyPath)}
                  onAdd={() => addSuggestion(s)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* نموذج إنشاء مؤشر يدوي */}
      <Card className="overflow-hidden bg-gradient-to-bl from-emerald-500/10 to-transparent">
        <div className="h-1.5 bg-gradient-to-l from-rose-500 via-amber-500 to-emerald-500" />
        <CardHeader>
          <CardTitle className="text-base">＋ إنشاء مؤشر يدوي</CardTitle>
          <CardDescription>
            عرّف المؤشر، وحدد قيمة الهدف وتكرار القياس. للمقترحات الجاهزة استخدم البنك أعلاه.
          </CardDescription>
        </CardHeader>
        <form onSubmit={create}>
          <CardContent className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="name">اسم المؤشر</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="مثال: نسبة الاحتفاظ بالعملاء" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">الوحدة</Label>
              <Input id="unit" value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="baseline">
                القيمة الحاليّة (اختياريّة)
                <span className="mr-1 text-[9px] font-normal text-primary" title="لو أُدخلت مع الهدف، نُولّد منحنى S تلقائياً">✨ توليد منحنى</span>
              </Label>
              <Input
                id="baseline"
                type="number"
                value={form.baselineValue}
                onChange={(e) => setForm((p) => ({ ...p, baselineValue: e.target.value }))}
                placeholder="مثال: ٠٫٨"
              />
              <p className="text-[9px] text-muted-foreground">
                نقطة البدء لمنحنى «متوقّع مقابل واقع».
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="target">القيمة المستهدفة</Label>
              <div className="flex gap-1">
                <Input id="target" type="number" value={form.targetValue} onChange={(e) => setForm((p) => ({ ...p, targetValue: e.target.value }))} placeholder="مثال: ١٫٢" />
                {opexTarget != null && (
                  <button
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, targetValue: suggestTarget(p.frequency) }))}
                    className="shrink-0 rounded-md border bg-primary/5 px-2 text-xs hover:bg-primary hover:text-primary-foreground"
                    title="استخدم OPEX.target حسب تكرار القياس"
                  >
                    من OPEX
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-1 sm:col-span-1">
              <Label htmlFor="freq">التكرار</Label>
              <select
                id="freq"
                className="h-9 w-full rounded-lg border bg-background px-3 text-sm"
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value }))}
              >
                {FREQS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2 flex justify-end self-end">
              <Button type="submit" disabled={creating || !form.name.trim()}>
                {creating ? 'جاري الإنشاء…' : '+ إنشاء المؤشر'}
              </Button>
            </div>
          </CardContent>
        </form>
      </Card>

      {loading && <Card><CardHeader><CardTitle>جاري التحميل…</CardTitle></CardHeader></Card>}

      {/* قائمة المؤشرات المُدخَلة — بترقيم + شرح «لماذا؟» قابل للفتح */}
      {kpis.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="text-sm font-semibold">
              🎯 مؤشراتي — {kpis.length} مؤشر
            </div>
            <div className="text-[10px] text-muted-foreground">
              اضغط «❔ لماذا؟» تحت كل مؤشر لفهم أهميته
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((k, i) => (
              <KPICard
                key={k.id}
                kpi={k}
                index={i}
                specialty={specialty}
                expanded={expandedKpiId === k.id}
                onToggleReason={() => setExpandedKpiId(expandedKpiId === k.id ? null : k.id)}
                onUpdateCurrent={(v) => updateCurrent(k.id, v)}
                onRemove={() => remove(k)}
              />
            ))}
          </div>
        </div>
      )}
      {!loading && kpis.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا مؤشرات بعد — استعمل «✨ ولّد الآن» أعلاه أو اختر من البنك أو أنشئ يدوياً.
          </CardContent>
        </Card>
      )}

      {!loading && <NextStepCTA kpisCount={kpis.length} hasUnsavedForm={hasUnsavedForm} />}
    </>
  )
}

// ─── بطاقة مؤشر مقترح في البنك ─────────────────────────────────
function SuggestionRow({
  sug, matchesPath, onAdd,
}: { sug: KPISuggestion; matchesPath: boolean; onAdd: () => void }) {
  const cat = KPI_CATEGORY_META[sug.category]
  const imp = IMPORTANCE_META[sug.importance]
  return (
    <div className={`rounded-lg border p-3 ${matchesPath ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none">{cat.icon}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold leading-tight">{sug.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[9px]">
            <span className={`rounded-full border px-1.5 py-0.5 ${cat.color}`}>{cat.labelAr}</span>
            <span className={`rounded-full border px-1.5 py-0.5 ${imp.color}`}>{imp.badge} {imp.labelAr}</span>
            <span className="rounded-full border bg-card px-1.5 py-0.5 text-muted-foreground">
              {sug.defaultTarget} {sug.unit} / {freqLabel(sug.frequency)}
            </span>
            {matchesPath && (
              <span className="rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-primary">
                ✓ مطابق لمسارك
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-2 rounded-md border border-dashed bg-card/50 p-1.5 text-[10px] leading-relaxed">
        <b>لماذا؟</b> {sug.why}
      </div>
      <Button size="sm" onClick={onAdd} className="mt-2 w-full">＋ إضِف كمؤشر</Button>
    </div>
  )
}

// ─── بطاقة مؤشر مضاف — بترقيم + «لماذا؟» قابل للفتح ────────────
function KPICard({
  kpi, index, specialty, expanded, onToggleReason, onUpdateCurrent, onRemove,
}: {
  kpi: KPI
  index: number
  specialty: DeptCode | null
  expanded: boolean
  onToggleReason: () => void
  onUpdateCurrent: (v: number) => void
  onRemove: () => void
}) {
  const p = pct(kpi)
  const s = statusOf(p)
  // نبحث عن ميتاداتاه في البنك بمطابقة الاسم — إن وجدت نعرض «لماذا».
  const meta = findKPIMeta(kpi.name, specialty)
  const catMeta = meta ? KPI_CATEGORY_META[meta.category] : null
  const impMeta = meta ? IMPORTANCE_META[meta.importance] : null

  return (
    <Card className={s.tint}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold tabular-nums text-primary-foreground"
            title="ترقيم المؤشر"
          >
            #{index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <CardTitle className="truncate text-base">{kpi.name}</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-1 text-[10px]">
              <span>{freqLabel(kpi.frequency)}</span>
              {catMeta && (
                <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 ${catMeta.color}`}>
                  <span>{catMeta.icon}</span>
                  <span>{catMeta.labelAr}</span>
                </span>
              )}
              {impMeta && (
                <span className={`rounded-full border px-1.5 ${impMeta.color}`}>
                  {impMeta.badge} {impMeta.labelAr}
                </span>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{kpi.currentValue.toLocaleString('ar-SA')}</span>
          <span className="text-sm text-muted-foreground tabular-nums">/ {kpi.targetValue.toLocaleString('ar-SA')} {kpi.unit}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>{s.label}</span>
            <span className="tabular-nums">{p}%</span>
          </div>
          <Progress value={Math.min(100, p)} className="h-2" />
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-28 bg-background tabular-nums"
            type="number"
            value={kpi.currentValue}
            onChange={(e) => onUpdateCurrent(Number(e.target.value) || 0)}
          />
          <span className="text-xs text-muted-foreground">قيمة حالية</span>
          <Button variant="ghost" size="sm" className="mr-auto" onClick={onRemove}>حذف</Button>
        </div>

        {/* «لماذا؟» — يفتح فقط لو له ميتاداتا معروفة (من البنك) */}
        {meta ? (
          <>
            <button
              type="button"
              onClick={onToggleReason}
              className="w-full rounded-md border bg-card px-2 py-1.5 text-[11px] font-medium text-muted-foreground transition hover:bg-muted"
            >
              {expanded ? '▲ إخفاء' : '❔ لماذا هذا المؤشر مهم؟'}
            </button>
            {expanded && (
              <div className="rounded-lg border border-dashed bg-muted/20 p-2.5 text-[11px] leading-relaxed">
                <div className="mb-1 font-semibold text-foreground">لماذا هذا المؤشر:</div>
                <p className="text-muted-foreground">{meta.why}</p>
                {meta.pathFit.length > 0 && (
                  <div className="mt-2 border-t pt-2">
                    <div className="mb-0.5 font-semibold text-foreground">مناسب لمسارات:</div>
                    <div className="flex flex-wrap gap-1">
                      {meta.pathFit.map((p) => (
                        <span key={p} className="rounded-full border bg-card px-1.5 py-0.5 text-[9px]">
                          {p === 'QUICK' ? '⚡ تشغيلي' : p === 'MEDIUM' ? '🎯 تكتيكي' : '🔭 استراتيجي'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-md border border-dashed bg-card/40 p-1.5 text-center text-[10px] text-muted-foreground">
            💡 مؤشر يدوي — لا شرح تلقائي. أضِف من البنك للحصول على «لماذا».
          </div>
        )}
      </CardContent>
    </Card>
  )
}
