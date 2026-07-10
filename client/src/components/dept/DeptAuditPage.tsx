import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { NextStepCard } from '@/components/strategic/NextStepCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeptAuditWizard } from '@/components/dept/DeptAuditWizard'
import {
  DEPT_ICON,
  DEPT_LABEL,
  createDepartment,
  dangerZoneColor,
  getLatestDeptAudit,
  submitDeptSmart,
  type AuditScore,
  type DeptCode,
} from '@/lib/deptApi'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'

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

      {/* لماذا التدقيق؟ — بطاقة قيمة (تظهر دائماً قبل النتيجة أو الأسئلة) */}
      <AuditValueCard deptCode={deptCode} />

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
          <SavedAuditCard
            deptCode={deptCode}
            score={savedScore}
            savedAt={savedAt}
            onRetake={() => setMode('wizard')}
          />
          {/* بعد اكتمال التدقيق: بطاقة "الأدوات التي فُتِحت الآن" */}
          <UnlockedToolsCard deptCode={deptCode} clientQuery={company ? `?client=${company.id}` : ''} />
          {afterResult ? afterResult(deptId) : null}
          <NextStepCard clientQuery={company ? `?client=${company.id}` : ''} />
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

// ─── بعد التدقيق: ما الذي فُتِح؟ ───────────────────────────────────
function UnlockedToolsCard({ deptCode, clientQuery }: { deptCode: DeptCode; clientQuery: string }) {
  const _ = deptCode // للاستخدام المستقبلي — عرض روابط مخصّصة لكل تخصّص
  void _
  const tools = [
    { icon: '🎯', label: 'البيئة الداخلية (7S)', to: `/internal-environment${clientQuery}`, desc: 'يُوَلَّد تلقائياً من درجات المحاور' },
    { icon: '🧠', label: 'ذكاء KPIs',             to: `/manager/dept-smart${clientQuery}`,   desc: 'مقاييس مخصّصة تُنشأ في القاعدة' },
    { icon: '📐', label: 'تحليل الفجوة',           to: `/manager/dept-gap${clientQuery}`,    desc: 'محاور من التدقيق مع خطة معالجة' },
    { icon: '🌐', label: 'PESTEL للإدارة',         to: `/manager/dept-pestel${clientQuery}`, desc: 'العوامل الخارجية بمقترحات جاهزة' },
    { icon: '⚔️', label: 'قوى بورتر الخمس',        to: `/porter${clientQuery}`,               desc: 'مُعاد تفسير القوى لتخصّصك' },
    { icon: '🗺️', label: 'الخطة الاستراتيجية',    to: `/manager/strategic-plan${clientQuery}`, desc: 'مسار موصى به حسب صحّتك' },
  ]
  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span aria-hidden>🎉</span>
          الأدوات التي فُتِحت لك الآن
        </CardTitle>
        <CardDescription>
          نتيجة التدقيق تُغذّي كل هذه الأدوات — كل واحدة بضغطة واحدة.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex items-start gap-2 rounded-lg border bg-card p-2.5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="text-xl" aria-hidden>{t.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-[11px] text-muted-foreground">{t.desc}</div>
            </div>
            <span className="text-xs opacity-0 transition group-hover:opacity-100">←</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
