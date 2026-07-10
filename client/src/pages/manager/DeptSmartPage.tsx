import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { OpexHint } from '@/components/OpexHint'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useCompany } from '@/hooks/useCompany'
import { apiErrorMessage } from '@/lib/api'
import {
  DEPT_ICON, DEPT_LABEL,
  listDepartments, type Department,
} from '@/lib/deptApi'
import { generateSmartInsights, generateSmartKPIs, type SmartInsight, type SmartKPISuggestion } from '@/lib/smartKpis'
import { createKPI, listKPIs, type KPI } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'

// ─── مركز ذكاء KPIs الإداري ────────────────────────────────────────
// المستخدم يفتح الصفحة → نُحضّر السياق من (specialty + opex + pains +
// goals + آخر تدقيق) → نُوَلِّد KPIs جاهزة + رؤى مبنيّة على البيانات →
// المستخدم يضغط زر بجوار كل KPI مقترح ليُنشِأه في القاعدة (createKPI).
//
// الفارق عن النسخة القديمة: كل مقترح فيه (rationale + source) واضح،
// ونستخدم البيانات الفعلية لا سؤالاً يدوياً.

const SEVERITY_STYLE: Record<SmartInsight['severity'], { chip: string; icon: string; label: string }> = {
  info:     { chip: 'bg-sky-100 text-sky-800 border-sky-200',       icon: 'ℹ️', label: 'معلومة' },
  positive: { chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '✓', label: 'إيجابي' },
  warning:  { chip: 'bg-amber-100 text-amber-800 border-amber-200', icon: '⚠️', label: 'تحذير' },
  critical: { chip: 'bg-rose-100 text-rose-800 border-rose-200',    icon: '🔥', label: 'حرج' },
}

const SOURCE_LABEL: Record<SmartKPISuggestion['source'], { icon: string; label: string }> = {
  specialty: { icon: '🎯', label: 'تخصّصك' },
  opex:      { icon: '💰', label: 'من OPEX' },
  pain:      { icon: '😤', label: 'من آلامك' },
  goal:      { icon: '🏆', label: 'من أهدافك' },
  audit:     { icon: '🩺', label: 'من التدقيق' },
}

const FREQ_LABEL: Record<SmartKPISuggestion['frequency'], string> = {
  daily: 'يومي', weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربعي', annual: 'سنوي',
}

export function DeptSmartPage() {
  const scope = useCompany()
  const user = useAuthStore((s) => s.user)
  const specialty = user?.specialtyDeptType ?? null

  const [departments, setDepartments] = useState<Department[]>([])
  const [savedKpis, setSavedKpis] = useState<KPI[]>([])
  const [creating, setCreating] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!scope.company) return
    let alive = true
    setLoading(true)
    ;(async () => {
      try {
        const cid = scope.company!.id
        const [deps, ks] = await Promise.allSettled([listDepartments(cid), listKPIs(cid)])
        if (!alive) return
        if (deps.status === 'fulfilled') setDepartments(deps.value)
        if (ks.status === 'fulfilled') setSavedKpis(ks.value)
      } catch (err) {
        toast.error(apiErrorMessage(err, 'تعذّر التحميل'))
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [scope.company])

  // آخر تدقيق للتخصّص (لاستنتاج auditHealthPct).
  const myDept = specialty ? departments.find((d) => d.type === specialty) : null
  const auditHealthPct = myDept?.auditData?.healthPct ?? myDept?.auditScore ?? null

  const context = useMemo(() => ({
    specialty,
    opex: scope.company?.opex ?? {},
    pains: user?.pains ?? [],
    goals: user?.goals ?? [],
    auditHealthPct,
  }), [specialty, scope.company?.opex, user?.pains, user?.goals, auditHealthPct])

  const kpiSuggestions = useMemo(() => generateSmartKPIs(context), [context])
  const insights = useMemo(() => generateSmartInsights(context), [context])

  // معرفة أي مقترح مُنشَأ فعلياً في القاعدة.
  const savedKpiNames = useMemo(() => new Set(savedKpis.map((k) => k.name)), [savedKpis])

  async function addKpi(suggestion: SmartKPISuggestion) {
    if (!scope.company) return
    setCreating(suggestion.key)
    try {
      const k = await createKPI({
        companyId: scope.company.id,
        name: suggestion.name,
        unit: suggestion.unit,
        targetValue: suggestion.targetValue,
        frequency: suggestion.frequency,
      })
      setSavedKpis((prev) => [...prev, k])
      toast.success(`أُضيف "${suggestion.name}" إلى KPIs الشركة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إضافة المؤشر'))
    } finally {
      setCreating(null)
    }
  }

  async function addAllKpisFrom(source: SmartKPISuggestion['source']) {
    if (!scope.company) return
    const list = kpiSuggestions.filter((s) => s.source === source && !savedKpiNames.has(s.name))
    if (list.length === 0) {
      toast.error('لا مقترحات جديدة من هذا المصدر — كلها مُضافة أو غير موجودة.')
      return
    }
    setCreating(`__ALL_${source}__`)
    let added = 0
    for (const s of list) {
      try {
        const k = await createKPI({
          companyId: scope.company.id,
          name: s.name,
          unit: s.unit,
          targetValue: s.targetValue,
          frequency: s.frequency,
        })
        setSavedKpis((prev) => [...prev, k])
        added++
      } catch { /* skip individual failures */ }
    }
    setCreating(null)
    if (added > 0) toast.success(`أُضيف ${added} مؤشراً`)
    else toast.error('تعذّر إضافة أي مؤشر')
  }

  if (scope.loading) return <LoadingSpinner fullPage label="جاري تحميل الشركة…" />
  if (!scope.company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="مركز ذكاء KPIs" />
        <EmptyState title={scope.error ?? 'لا شركة نشطة'} description="اختر عميلاً أو أكمل التسجيل." />
      </div>
    )
  }

  const clientQ = `?client=${scope.company.id}`

  // نُصنّف المقترحات حسب المصدر لعرضها مجموعات.
  const bySource: Record<SmartKPISuggestion['source'], SmartKPISuggestion[]> = {
    specialty: [], opex: [], pain: [], goal: [], audit: [],
  }
  for (const s of kpiSuggestions) bySource[s.source].push(s)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`مركز ذكاء KPIs${specialty ? ' — ' + DEPT_LABEL[specialty] : ''}`}
        description={
          specialty
            ? `${DEPT_ICON[specialty]} توصيات مؤشرات ذكية مبنيّة على تخصّصك + OPEX + آلامك + آخر تدقيق.`
            : 'حدّد تخصّصك من إعدادات الحساب لتحصل على مقترحات مخصّصة.'
        }
      />

      {/* Hero: ملخّص السياق */}
      <div className="grid gap-3 sm:grid-cols-4">
        <ContextChip icon="🎯" label="تخصّص" value={specialty ? DEPT_LABEL[specialty] : 'غير محدّد'} highlight={!specialty} />
        <ContextChip icon="💰" label="مستهدف سنوي" value={scope.company.opex?.target ? `${scope.company.opex.target.toLocaleString('ar-SA')} ر.س` : '—'} highlight={!scope.company.opex?.target} />
        <ContextChip icon="😤" label="آلام مُختارة" value={context.pains.length > 0 ? `${context.pains.length}` : '—'} highlight={context.pains.length === 0} />
        <ContextChip icon="🩺" label="صحة التدقيق" value={auditHealthPct != null ? `${Math.round(auditHealthPct)}%` : 'لم يبدأ'} highlight={auditHealthPct == null} />
      </div>

      {/* رؤى ذكية */}
      {insights.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">💡 رؤى ذكية</CardTitle>
            <CardDescription>مبنيّة على السياق الحالي — عالجها لتحسين جودة المقترحات.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {insights.map((i, idx) => {
              const style = SEVERITY_STYLE[i.severity]
              return (
                <div key={idx} className={`flex items-start gap-3 rounded-lg border p-3 ${style.chip}`}>
                  <div className="text-lg">{style.icon}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <div className="mt-0.5 text-xs opacity-80">{i.detail}</div>
                  </div>
                  <span className="rounded-full border bg-card/60 px-2 py-0.5 text-[10px] font-medium">{style.label}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* OPEX hint (يُظهر تحذير لو نقص) */}
      <OpexHint opex={scope.company.opex} title="OPEX الحالي يُغذّي حسابات KPI" />

      {loading && <LoadingSpinner label="جاري تحميل البيانات…" />}

      {/* المقترحات مقسّمة حسب المصدر */}
      {!loading && kpiSuggestions.length === 0 && (
        <EmptyState title="لا مقترحات بعد" description="حدّد تخصّصك من الحساب أو أكمل onboarding." />
      )}

      {(['specialty', 'opex', 'pain', 'goal', 'audit'] as const).map((source) => {
        const list = bySource[source]
        if (list.length === 0) return null
        const src = SOURCE_LABEL[source]
        const remaining = list.filter((s) => !savedKpiNames.has(s.name)).length
        return (
          <Card key={source}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span aria-hidden>{src.icon}</span>
                  {src.label}
                  <span className="text-xs font-normal text-muted-foreground">({list.length} مقترح)</span>
                </CardTitle>
              </div>
              {remaining > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addAllKpisFrom(source)}
                  disabled={creating !== null}
                >
                  {creating === `__ALL_${source}__` ? 'جاري…' : `＋ أضِف الكل (${remaining})`}
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-2 md:grid-cols-2">
              {list.map((s) => {
                const isSaved = savedKpiNames.has(s.name)
                return (
                  <div
                    key={s.key}
                    className={`rounded-lg border p-3 transition ${
                      isSaved ? 'border-emerald-300 bg-emerald-50/40' : 'bg-card hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="text-sm font-semibold">{s.name}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span>الهدف: <span className="tabular-nums font-medium text-foreground">{s.targetValue.toLocaleString('ar-SA')} {s.unit}</span></span>
                          <span>·</span>
                          <span>{FREQ_LABEL[s.frequency]}</span>
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{s.rationale}</p>
                      </div>
                      {isSaved ? (
                        <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                          ✓ مُنشَأ
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => addKpi(s)}
                          disabled={creating !== null}
                          className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                        >
                          {creating === s.key ? 'جاري…' : '＋ أضِف'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {/* CTA للخطوة التالية */}
      {savedKpis.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div>
              <div className="text-sm font-semibold">لديك {savedKpis.length} مؤشراً محفوظاً — الخطوة التالية</div>
              <div className="text-xs text-muted-foreground">سجّل قراءات دورية لهذه المؤشرات لتراقب الأداء الفعلي.</div>
            </div>
            <Link
              to={`/kpi-entries${clientQ}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90"
            >
              افتح إدخالات المؤشرات ←
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ContextChip({ icon, label, value, highlight }: { icon: string; label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-amber-300 bg-amber-50/40' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
