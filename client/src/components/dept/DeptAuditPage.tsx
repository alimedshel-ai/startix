import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { JourneyProgress } from '@/journey/shared/JourneyProgress'
import { RiskFastPathBanner } from '@/components/manager/RiskFastPathBanner'
import { NextStepCard } from '@/components/strategic/NextStepCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeptAuditWizard } from '@/components/dept/DeptAuditWizard'
import {
  DEPT_ICON,
  DEPT_LABEL,
  createDepartment,
  dangerZoneColor,
  getDeptAuditHistory,
  getLatestDeptAudit,
  submitDeptSmart,
  type AuditScore,
  type DeptCode,
} from '@/lib/deptApi'
import { budgetStatus } from '@/lib/budgetGuard'
import { getTaggedSWOT, listInitiatives, type Initiative } from '@/lib/strategicApi'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { useAuthStore } from '@/store/authStore'

interface Props {
  deptCode: DeptCode
  variant?: 'basic' | 'pro'
  afterResult?: (deptId: string) => React.ReactNode
}

// حالة الصفحة:
// - loading: نجلب الشركة/الإدارة/آخر تدقيق.
// - error: خطأ (شركة غير مربوطة أو فشل شبكة).
// - result: يوجد تدقيق سابق → اعرض النتيجة + زر "أعِد التدقيق".
// - wizard: لا يوجد تدقيق سابق (أو المستخدم اختار إعادة) → اعرض الأسئلة.
type ViewMode = 'loading' | 'error' | 'result' | 'wizard'

const AXIS_LABEL: Record<string, string> = {
  governance: 'الحوكمة',
  financial:  'المالية',
  team:       'الفريق',
  digital:    'الرقمي',
}

const ZONE_LABEL: Record<string, string> = {
  GREEN:  'منطقة آمنة',
  YELLOW: 'منطقة تحذير',
  ORANGE: 'منطقة خطر',
  RED:    'منطقة حرجة',
}

export function DeptAuditPage({ deptCode, variant = 'basic', afterResult }: Props) {
  const scope = useClientScopedCompany()
  const company = scope.company
  const viewer = useAuthStore((s) => s.user)
  // المسار الموجّه مخصّص للمدير المستقل (§١) — لا نغيّر تجربة المدير الداخلي.
  const guided = viewer?.userType === 'MANAGER' && viewer?.managerType === 'INDEPENDENT_PRO'
  const clientQuery = company ? `?client=${company.id}` : ''
  const [deptId, setDeptId] = useState<string | null>(null)
  const [mode, setMode] = useState<ViewMode>('loading')
  const [error, setError] = useState<string | null>(null)
  const [savedScore, setSavedScore] = useState<AuditScore | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [requestingSmart, setRequestingSmart] = useState(false)

  // يحمّل آخر تدقيق للإدارة. يُستدعى عند التحميل الأول وبعد اكتمال تدقيق
  // جديد لتحديث البطاقة المعروضة بلا إعادة كسر السير الطبيعي للأسئلة.
  const loadLatest = useCallback(async (id: string) => {
    const latest = await getLatestDeptAudit(id)
    if (latest.audit) {
      setSavedScore(latest.audit.scores)
      setSavedAt(latest.audit.createdAt)
      return true
    }
    return false
  }, [])

  useEffect(() => {
    // ننتظر حتى يحسم hook الشركة النشطة قبل بناء الإدارة.
    if (scope.loading) {
      setMode('loading')
      return
    }
    if (!company) {
      setError(scope.error ?? 'لم تربط شركة بعد. أكمل تشخيص المدير أولاً.')
      setMode('error')
      return
    }
    let cancel = false
    setMode('loading')
    setError(null)
    setDeptId(null)
    setSavedScore(null)
    setSavedAt(null)
    ;(async () => {
      try {
        const dept = await createDepartment({ companyId: company.id, type: deptCode })
        if (cancel) return
        setDeptId(dept.id)
        const hasPrior = await loadLatest(dept.id)
        if (cancel) return
        // لو عنده تدقيق سابق نعرض النتيجة أولاً؛ خلاف ذلك ندخل الويزارد.
        // بهذا رجوعه للصفحة لا يمسح تحليله السابق أو يجبره على إعادة الإجابات.
        setMode(hasPrior ? 'result' : 'wizard')
      } catch (err) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر تحميل بيانات الإدارة'
        setError(msg)
        setMode('error')
      }
    })()
    return () => { cancel = true }
  }, [deptCode, loadLatest, company, scope.loading, scope.error])

  async function requestSmart() {
    if (!deptId) return
    setRequestingSmart(true)
    try {
      const { recommendations } = await submitDeptSmart(deptId)
      toast.success(`تم توليد ${recommendations.kpis.length} مؤشر أداء`)
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'تعذّر توليد المؤشرات'
      toast.error(msg)
    } finally {
      setRequestingSmart(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${DEPT_ICON[deptCode]} تدقيق ${DEPT_LABEL[deptCode]}${variant === 'pro' ? ' (احترافي)' : ''}`}
        description={`تقييم نضج عبر ٤ محاور لـ${company?.name ?? 'شركتك'}.`}
        breadcrumbs={[
          { label: 'الإدارات', to: '/manager/select-dept' },
          { label: DEPT_LABEL[deptCode] },
        ]}
        actions={
          mode === 'result' && deptId ? (
            <Button variant="outline" onClick={requestSmart} disabled={requestingSmart}>
              {requestingSmart ? 'جاري التوليد…' : 'توليد مؤشرات الأداء'}
            </Button>
          ) : null
        }
      />

      {/* §٣ — شريط «أنت هنا» مثبَّت أعلى الصفحة (للمدير المستقل فقط) */}
      {guided && company && <JourneyProgress companyId={company.id} clientQuery={clientQuery} />}

      {/* §٤ — بوصلة الإجراء الواحد: بطاقة الخطوة التالية مرفوعة للأعلى بعد اكتمال التدقيق */}
      {guided && mode === 'result' && (
        <NextStepCard clientQuery={clientQuery} companyId={company?.id} />
      )}

      {/* لماذا التدقيق؟ — بطاقة قيمة قبل التدقيق فقط؛ تُخفى بعد النتيجة (حشو) */}
      {mode !== 'result' && <AuditValueCard deptCode={deptCode} />}

      {mode === 'loading' && (
        <Card>
          <CardHeader>
            <CardTitle>جاري التحميل…</CardTitle>
          </CardHeader>
        </Card>
      )}

      {mode === 'error' && (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader>
            <CardTitle className="text-rose-900">تعذّر بدء التدقيق</CardTitle>
            <CardDescription className="text-rose-700">{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => (window.location.href = '/manager/diagnostic')}>
              تشغيل تشخيص المدير
            </Button>
          </CardContent>
        </Card>
      )}

      {mode === 'result' && savedScore && deptId && (
        <>
          {/* 📈 مؤشّر التحسّن — «قبل ← بعد» + خروج من الطوارئ (يُظهر نجاحك) */}
          <ImprovementBanner deptId={deptId} />
          {/* ربط الفحص بالمسار: خطر ⇐ توصية بالمسار السريع قبل التكتيكي/الطويل */}
          {guided && company && (
            <RiskFastPathBanner companyId={company.id} healthPct={savedScore.healthPct} dangerZone={savedScore.dangerZone} />
          )}
          <SavedAuditCard
            deptCode={deptCode}
            score={savedScore}
            savedAt={savedAt}
            onRetake={() => setMode('wizard')}
          />
          {/* الثانويّ (الأدوات المفتوحة + اللقطة) مطويّ — لتبقى «الخطوة التالية» أعلاه هي الوجهة الواضحة */}
          <details className="group rounded-xl border bg-card/40">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4 text-sm font-semibold transition hover:bg-accent/40">
              <span>🧰 تفاصيل ومخرجات (اختياريّ) — الأدوات المفتوحة + لقطتك الاستراتيجيّة</span>
              <span className="text-xs text-muted-foreground transition group-open:rotate-180">▼</span>
            </summary>
            <div className="space-y-6 border-t p-4">
              <UnlockedToolsCard deptCode={deptCode} clientQuery={company ? `?client=${company.id}` : ''} />
              {company && <StrategicSnapshotCard companyId={company.id} budget={company.opex?.budget ?? null} />}
            </div>
          </details>
          {afterResult ? afterResult(deptId) : null}
          {/* المدير الداخلي: تبقى البطاقة أسفل النتيجة (سلوك سابق). المستقل: رُفِعت للأعلى (§٤). */}
          {!guided && (
            <NextStepCard clientQuery={clientQuery} companyId={company?.id} />
          )}
        </>
      )}

      {mode === 'wizard' && deptId && (
        <>
          {/* Wizard key يُعاد تحميله عند إعادة التدقيق ليمسح الحالة الداخلية. */}
          <DeptAuditWizard
            key={`${deptId}-${savedAt ?? 'fresh'}`}
            deptId={deptId}
            deptCode={deptCode}
            variant={variant}
            onComplete={async (s) => {
              setSavedScore(s)
              setSavedAt(new Date().toISOString())
              // نعيد تحميل آخر تدقيق من السيرفر لضمان الاتساق (السجل الفعلي).
              await loadLatest(deptId).catch(() => {})
              setMode('result')
            }}
          />
        </>
      )}
    </div>
  )
}

// ─── 📈 مؤشّر التحسّن — يقارن آخر تدقيقين ويُظهر «قبل ← بعد» + خروج الطوارئ ──
// الـeffect لا يستدعي setState متزامناً — فقط بعد await (then). لا خطأ lint.
function ImprovementBanner({ deptId }: { deptId: string }) {
  const [hist, setHist] = useState<{ healthPct: number; createdAt: string }[] | null>(null)
  useEffect(() => {
    let alive = true
    getDeptAuditHistory(deptId).then((r) => { if (alive) setHist(r.history) }).catch(() => { if (alive) setHist([]) })
    return () => { alive = false }
  }, [deptId])

  if (!hist || hist.length < 2) return null // نحتاج تدقيقين على الأقل للمقارنة
  const cur = Math.round(hist[0].healthPct)
  const prev = Math.round(hist[1].healthPct)
  const delta = cur - prev
  if (delta === 0) return null
  const up = delta > 0
  const exitedRed = prev < 40 && cur >= 40
  return (
    <div className={`rounded-xl border-2 p-4 shadow-sm ${up ? 'border-emerald-300 bg-emerald-50/60' : 'border-rose-300 bg-rose-50/60'}`}>
      <div className="flex flex-wrap items-center gap-2 text-base font-bold">
        <span>{up ? '📈' : '📉'}</span>
        <span className={up ? 'text-emerald-900' : 'text-rose-900'}>الصحّة: {prev}٪ ← {cur}٪</span>
        <span className={`rounded-full px-2 py-0.5 text-sm text-white ${up ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {up ? '⬆️ +' : '⬇️ '}{delta}
        </span>
      </div>
      {exitedRed && (
        <p className="mt-1.5 text-sm font-bold text-emerald-800">🎉 خرجتَ من المنطقة الحمراء — لم تعد في طوارئ! ارتقى مستواك.</p>
      )}
      <p className="mt-0.5 text-[11px] text-muted-foreground">مقارنةً بتدقيقك السابق ({hist[1].createdAt.slice(0, 10)}).</p>
    </div>
  )
}

function SavedAuditCard({
  deptCode, score, savedAt, onRetake,
}: {
  deptCode: DeptCode
  score: AuditScore
  savedAt: string | null
  onRetake: () => void
}) {
  const zoneClass = dangerZoneColor(score.dangerZone)
  const date = savedAt ? new Date(savedAt).toLocaleDateString('ar-SA') : null
  return (
    <Card className="overflow-hidden">
      <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              نتيجة تدقيق {DEPT_LABEL[deptCode]}
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${zoneClass}`}>
                {ZONE_LABEL[score.dangerZone]}
              </span>
            </CardTitle>
            <CardDescription className="mt-1">
              {date ? `آخر تحديث: ${date} · ` : ''}
              الصحة الإجمالية {Math.round(score.healthPct)}٪
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onRetake}>
            أعِد التدقيق
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {score.byAxis.map((axis) => {
            const pct = axis.cap === 0 ? 0 : Math.round((axis.score / axis.cap) * 100)
            return (
              <div key={axis.axis} className="rounded-xl border bg-card p-3">
                <div className="text-xs text-muted-foreground">{AXIS_LABEL[axis.axis] ?? axis.axis}</div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums">{pct}</span>
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── لماذا هذا التدقيق؟ — بطاقة قيمة ─────────────────────────────
// المدير المستقل يفتح صفحة التدقيق، فيحتاج فهم لماذا يقضي ١٠ دقائق فيها.
// هذه البطاقة تُوضّح:
//   1) ماذا يقيس التدقيق (٤ محاور).
//   2) كم من الوقت يستغرق.
//   3) ما الأدوات التي تُفتح تلقائياً بعده.

function AuditValueCard({ deptCode }: { deptCode: DeptCode }) {
  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-l from-primary/10 to-primary/5">
      <div className="h-1 bg-gradient-to-l from-primary to-violet-500" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>🎯</span>
          لماذا هذا التدقيق؟
        </CardTitle>
        <CardDescription>
          تقييم نضج إدارة {DEPT_LABEL[deptCode]} على ٤ محاور — يستغرق ٥-١٠ دقائق.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            ما تحصل عليه:
          </div>
          <ul className="space-y-1 text-sm">
            <li>✓ درجة صحّة إجمالية (٠-١٠٠٪)</li>
            <li>✓ درجة كل محور: حوكمة / مالي / فريق / رقمي</li>
            <li>✓ منطقة الخطر (آمن / تحذير / خطر / حرج)</li>
            <li>✓ مقارنة مع تدقيقات سابقة</li>
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            ما يفتح تلقائياً بعده:
          </div>
          <ul className="space-y-1 text-sm">
            <li>🎯 البيئة الداخلية (7S)</li>
            <li>🧠 ذكاء KPIs (مؤشرات مخصّصة)</li>
            <li>📐 تحليل الفجوة (تلقائي)</li>
            <li>🗺️ الخطة الاستراتيجية</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── بعد التدقيق: ما الذي فُتِح؟ ولماذا؟ ─────────────────────────
// المدير كان يشوف ٦ أدوات مفتوحة بلا سياق — يظنّ أنها كلها مطلوبة الآن.
// الآن كل أداة تُصنّف بمستوى الخطّة (تشغيلي/تكتيكي/استراتيجي)، ويُشرح
// «لماذا فُتِحت» و «لماذا الآن»، ويفلتر المدير بحسب خطّته.
type PlanLevel = 'operational' | 'tactical' | 'strategic'

const PLAN_LEVEL_META: Record<PlanLevel, { icon: string; labelAr: string; color: string; horizonAr: string }> = {
  operational: { icon: '⚙️', labelAr: 'تشغيليّة',   color: 'border-emerald-400 bg-emerald-50 text-emerald-800', horizonAr: 'يوم/شهر' },
  tactical:    { icon: '🎯', labelAr: 'تكتيكيّة',   color: 'border-sky-400 bg-sky-50 text-sky-800',           horizonAr: '٣-١٢ شهر' },
  strategic:   { icon: '🔭', labelAr: 'استراتيجيّة', color: 'border-purple-400 bg-purple-50 text-purple-800',   horizonAr: '١+ سنة' },
}

// خرائط: مسار المدير → مستوى الخطّة الافتراضي.
function pathToPlanLevel(path: string | null | undefined): PlanLevel | null {
  if (path === 'QUICK')  return 'operational'
  if (path === 'MEDIUM') return 'tactical'
  if (path === 'LONG')   return 'strategic'
  return null
}

// ─── اللقطة الاستراتيجيّة — تجمّع المبنيّ في مكان واحد ──────────────
// عرض فقط (لا goalSource ولا ربط جديد): حالة SWOT + المبادرات مع
// المستوى والتكلفة + بانر الميزانيّة. يُخرِج ما بُنِي من صفحاته المتفرّقة
// إلى صفحة التدقيق ليراه المدير مجمّعاً.
function StrategicSnapshotCard({ companyId, budget }: { companyId: string; budget: number | null }) {
  const [swot, setSwot] = useState<{ s: number; w: number; o: number; t: number } | null>(null)
  const [inits, setInits] = useState<Initiative[]>([])
  const [loading, setLoading] = useState(true)
  const clientQ = `?client=${companyId}`

  useEffect(() => {
    let alive = true
    Promise.allSettled([getTaggedSWOT(companyId), listInitiatives(companyId)]).then(([sw, ini]) => {
      if (!alive) return
      if (sw.status === 'fulfilled') {
        const v = sw.value
        setSwot({ s: v.strengths?.length ?? 0, w: v.weaknesses?.length ?? 0, o: v.opportunities?.length ?? 0, t: v.threats?.length ?? 0 })
      }
      if (ini.status === 'fulfilled') setInits(ini.value)
      setLoading(false)
    })
    return () => { alive = false }
  }, [companyId])

  if (loading) return null

  const swotTotal = swot ? swot.s + swot.w + swot.o + swot.t : 0
  const bs = budgetStatus(inits.map((i) => i.cost), budget)
  const fmt = (n: number) => n.toLocaleString('en-US')

  return (
    <Card className="border-primary/20 bg-gradient-to-l from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">🧩 اللقطة الاستراتيجيّة</CardTitle>
        <CardDescription className="text-xs">مخرجاتك المبنيّة مجمّعة: SWOT · المبادرات (المستوى/التكلفة) · الميزانيّة.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* حالة SWOT */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">SWOT:</span>
          {swotTotal > 0 ? (
            <>
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">✓ {swotTotal} بند</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">💪{swot!.s} · 🔻{swot!.w} · 🌱{swot!.o} · ⚠️{swot!.t}</span>
            </>
          ) : (
            <span className="rounded-full border bg-card px-2 py-0.5 text-[10px] text-muted-foreground">لم يبدأ</span>
          )}
          <Link to={`/swot${clientQ}`} className="text-[10px] text-primary underline-offset-2 hover:underline">فتح ←</Link>
        </div>

        {/* بانر الميزانيّة */}
        {(bs.budget != null || bs.spent > 0) && (
          <div className={`rounded-lg border p-3 ${bs.overBudget ? 'border-rose-400 bg-rose-50/50' : 'border-emerald-300 bg-emerald-50/40'}`}>
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
              <span className="font-medium">💰 ميزانيّة المبادرات</span>
              {bs.budget != null ? (
                <span className={`font-bold tabular-nums ${bs.overBudget ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {fmt(bs.spent)} / {fmt(bs.budget)} SAR ({bs.pct}٪)
                </span>
              ) : (
                <span className="text-muted-foreground tabular-nums">التكاليف: {fmt(bs.spent)} SAR · بلا ميزانيّة</span>
              )}
            </div>
            {bs.overBudget && <p className="mt-1 text-[11px] font-medium text-rose-700">⚠️ تجاوزٌ بـ{fmt(-(bs.remaining ?? 0))} SAR — تحذير لا حظر.</p>}
          </div>
        )}

        {/* المبادرات مع المستوى والتكلفة */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">المبادرات ({inits.length})</span>
            <Link to={`/priority?tab=initiatives&client=${companyId}`} className="text-[10px] text-primary underline-offset-2 hover:underline">إدارة ←</Link>
          </div>
          {inits.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">لا مبادرات بعد — أنشئها من مركز المبادرات.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {inits.slice(0, 6).map((i) => {
                const lvl = i.level ? PLAN_LEVEL_META[i.level as PlanLevel] : null
                const cost = i.cost != null ? Number(i.cost) : 0
                return (
                  <li key={i.id} className="flex items-center gap-2 rounded-md border bg-card/60 px-2 py-1 text-[11px]">
                    <span className="min-w-0 flex-1 truncate">{i.title}</span>
                    {lvl && <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] ${lvl.color}`}>{lvl.icon} {lvl.labelAr}</span>}
                    {cost > 0 && <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[9px] tabular-nums text-amber-800">💰 {fmt(cost)}</span>}
                  </li>
                )
              })}
              {inits.length > 6 && <li className="text-[10px] text-muted-foreground">+{inits.length - 6} أخرى…</li>}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function UnlockedToolsCard({ deptCode, clientQuery }: { deptCode: DeptCode; clientQuery: string }) {
  const user = useAuthStore((s) => s.user)
  const defaultLevel = pathToPlanLevel(user?.strategyPath)
  const [levelFilter, setLevelFilter] = useState<PlanLevel | null>(defaultLevel)
  const _ = deptCode
  void _

  // كل أداة تحمل مستويات الخطّة التي تنتمي إليها + سبب فتحها.
  const tools: {
    icon: string; label: string; to: string; desc: string;
    levels: PlanLevel[]; unlockReason: string;
  }[] = [
    {
      icon: '🎯', label: 'البيئة الداخليّة (7S)', to: `/internal-environment${clientQuery}`,
      desc: 'يُوَلَّد تلقائياً من درجات المحاور.',
      levels: ['tactical', 'strategic'],
      unlockReason: 'التدقيق قدّم درجات ٤ محاور تُغذّي 7S تلقائياً.',
    },
    {
      icon: '🧠', label: 'ذكاء KPIs',              to: `/manager/dept-smart${clientQuery}`,
      desc: 'مقاييس مخصّصة تُنشأ في القاعدة.',
      levels: ['operational', 'tactical'],
      unlockReason: 'التدقيق حدّد الفجوات فأصبحت المقاييس معروفة.',
    },
    {
      icon: '📐', label: 'تحليل الفجوة',            to: `/manager/dept-gap${clientQuery}`,
      desc: 'محاور من التدقيق مع خطة معالجة.',
      levels: ['operational', 'tactical'],
      unlockReason: 'الفجوة تُقاس مباشرة من الفارق بين الحالي والمستهدف.',
    },
    {
      icon: '🌐', label: 'PESTEL للإدارة',          to: `/manager/dept-pestel${clientQuery}`,
      desc: 'العوامل الخارجيّة بمقترحات جاهزة.',
      levels: ['tactical', 'strategic'],
      unlockReason: 'PESTEL يكمّل الصورة الخارجيّة بعد رصد الداخليّة.',
    },
    {
      icon: '⚔️', label: 'قوى بورتر الخمس',         to: `/porter${clientQuery}`,
      desc: 'مُعاد تفسير القوى لتخصّصك.',
      levels: ['strategic'],
      unlockReason: 'بورتر أداة تموضع تنافسي — مطلوبة للتخطيط طويل الأمد.',
    },
    {
      icon: '🗺️', label: 'الخطّة الاستراتيجيّة',   to: `/manager/strategic-plan${clientQuery}`,
      desc: 'مسار موصى به حسب صحّتك.',
      levels: ['operational', 'tactical', 'strategic'],
      unlockReason: 'الخطّة تختار مسارها من صحّة إدارتك المُقاسة الآن.',
    },
  ]

  const inLevel = (t: typeof tools[number]) => !levelFilter || t.levels.includes(levelFilter)
  const inLevelCount = tools.filter(inLevel).length
  const outLevelCount = tools.length - inLevelCount

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span aria-hidden>🎉</span>
              الأدوات التي فُتِحت — ولماذا الآن؟
            </CardTitle>
            <CardDescription className="text-xs">
              كلّها تعتمد على التدقيق الذي أنجزته للتوّ. اختر مستوى خطّتك لتُبرِز ما يناسبها.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      {/* 🎛️ فلتر مستوى الخطّة */}
      <CardContent className="pb-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-2 text-xs">
          <span className="text-muted-foreground">مستوى خطّتك:</span>
          {(['operational', 'tactical', 'strategic'] as PlanLevel[]).map((lvl) => {
            const meta = PLAN_LEVEL_META[lvl]
            const active = levelFilter === lvl
            const isDefault = defaultLevel === lvl
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => setLevelFilter(active ? null : lvl)}
                className={`inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 transition ${
                  active ? `${meta.color} ring-2 ring-primary/40 shadow-sm` : meta.color
                }`}
              >
                <span>{meta.icon}</span>
                <span>{meta.labelAr}</span>
                <span className="opacity-70">({meta.horizonAr})</span>
                {isDefault && !active && <span className="text-[9px] font-bold">⭐</span>}
                {active && <span>✓</span>}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setLevelFilter(null)}
            className={`rounded-full border px-2 py-0.5 transition ${
              !levelFilter ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            عرض الكلّ
          </button>
        </div>
        {defaultLevel && (
          <div className="mt-1.5 text-[10px] text-muted-foreground">
            ⭐ الافتراضي مُشتقّ من مسارك ({PLAN_LEVEL_META[defaultLevel].labelAr}) — يمكنك تغييره من أعلى.
          </div>
        )}
      </CardContent>

      {/* الأدوات — تُبرَز داخل الخطّة، تُبهت خارجها */}
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const matches = inLevel(t)
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`group flex flex-col gap-1 rounded-lg border-2 p-2.5 transition hover:-translate-y-0.5 hover:shadow-md ${
                  matches ? 'bg-card' : 'opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-xl leading-none" aria-hidden>{t.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">{t.desc}</div>
                  </div>
                  <span className="text-xs opacity-0 transition group-hover:opacity-100">←</span>
                </div>
                {/* شارات المستوى + سبب الفتح */}
                <div className="flex flex-wrap items-center gap-1 pt-1 text-[9px]">
                  {t.levels.map((lvl) => {
                    const meta = PLAN_LEVEL_META[lvl]
                    const isCurrent = levelFilter === lvl
                    return (
                      <span
                        key={lvl}
                        className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 ${meta.color} ${
                          isCurrent ? 'ring-2 ring-primary/40 font-bold' : ''
                        }`}
                      >
                        <span>{meta.icon}</span>
                        <span>{meta.labelAr}</span>
                      </span>
                    )
                  })}
                  {!matches && levelFilter && (
                    <span className="rounded-full border border-dashed bg-card px-1.5 py-0.5 text-muted-foreground">
                      خارج خطّتك ({PLAN_LEVEL_META[levelFilter].labelAr})
                    </span>
                  )}
                </div>
                <div className="rounded-md border border-dashed bg-muted/40 p-1.5 text-[10px] text-muted-foreground">
                  <b className="text-foreground">لماذا فُتِحت الآن؟</b> {t.unlockReason}
                </div>
              </Link>
            )
          })}
        </div>
        {levelFilter && outLevelCount > 0 && (
          <div className="mt-2 rounded-lg border border-dashed bg-muted/30 p-2 text-[10px] text-muted-foreground">
            💡 {outLevelCount} أدوات باهتة أعلاه لأنّها خارج مستوى «{PLAN_LEVEL_META[levelFilter].labelAr}» —
            الوصول ممكن، لكنها لا تخدم أهدافك في هذه المرحلة. اضغط «عرض الكلّ» لتُبرِزها.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
