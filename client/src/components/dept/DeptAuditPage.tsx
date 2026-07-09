import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DeptAuditWizard } from '@/components/dept/DeptAuditWizard'
import {
  DEPT_ICON,
  DEPT_LABEL,
  createDepartment,
  dangerZoneColor,
  getLatestDeptAudit,
  getMyFirstCompany,
  submitDeptSmart,
  type AuditScore,
  type Company,
  type DeptCode,
} from '@/lib/deptApi'

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
  const [company, setCompany] = useState<Company | null>(null)
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
    let cancel = false
    setMode('loading')
    setError(null)
    setDeptId(null)
    setSavedScore(null)
    setSavedAt(null)
    ;(async () => {
      try {
        const { company } = await getMyFirstCompany()
        if (cancel) return
        if (!company) {
          setError('لم تربط شركة بعد. أكمل تشخيص المدير أولاً.')
          setMode('error')
          return
        }
        setCompany(company)
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
  }, [deptCode, loadLatest])

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
          {afterResult ? afterResult(deptId) : null}
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
