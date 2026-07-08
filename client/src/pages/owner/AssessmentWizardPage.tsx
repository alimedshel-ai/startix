import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { apiErrorMessage, planUpgradeFromError } from '@/lib/api'
import { getMyFirstCompany, type Company } from '@/lib/deptApi'
import {
  buildAssessment,
  generateAssessmentAI,
  listTemplates,
  type AIGeneratedAssessment,
  type AssessmentModelType,
  type TemplateSummary,
  type WizardDimensionDraft,
} from '@/lib/assessmentApi'

// ─── C20 — معالج التقييم بـ 5 خطوات ─────────────────────────────────────────
// scope → model → weights → AI → review & launch
// كل الحسابات على السيرفر. المسوّدة على الكلاينت فقط أثناء المعالج، ثم تُطلَق
// عبر POST /api/assessments/build وتُصبح مصدر الحقيقة في القاعدة.

type WizardStep = 0 | 1 | 2 | 3 | 4

const STEP_LABEL: Record<WizardStep, string> = {
  0: 'النطاق',
  1: 'النموذج',
  2: 'الأوزان',
  3: 'توليد AI',
  4: 'المراجعة والإطلاق',
}

const MODEL_LABEL_FALLBACK: Record<Exclude<AssessmentModelType, 'CUSTOM'>, string> = {
  BSC: 'بطاقة الأداء المتوازن',
  EFQM: 'نموذج الامتياز EFQM',
  PESTEL: 'تحليل PESTEL',
  PORTER: 'قوى بورتر الخمس',
  OKR: 'تقييم منظومة OKR',
}

export function AssessmentWizardPage() {
  return (
    <ErrorBoundary>
      <WizardContent />
    </ErrorBoundary>
  )
}

function WizardContent() {
  const navigate = useNavigate()
  const [step, setStep] = useState<WizardStep>(0)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])

  // مسوّدة المعالج (كلاينت فقط حتى الإطلاق)
  const [name, setName] = useState('')
  const [modelType, setModelType] = useState<Exclude<AssessmentModelType, 'CUSTOM'> | null>(null)
  const [dimensions, setDimensions] = useState<WizardDimensionDraft[]>([])
  const [aiRunning, setAiRunning] = useState(false)
  const [aiApplied, setAiApplied] = useState(false)
  const [launching, setLaunching] = useState(false)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const [{ company: co }, tpls] = await Promise.all([
          getMyFirstCompany(),
          listTemplates(),
        ])
        if (cancel) return
        setCompany(co)
        setTemplates(tpls)
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل بيانات المعالج'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [])

  const dimWeightSum = useMemo(
    () => dimensions.reduce((s, d) => s + d.weight, 0),
    [dimensions]
  )
  const canAdvance = useMemo(() => {
    switch (step) {
      case 0: return Boolean(company && name.trim().length >= 3)
      case 1: return Boolean(modelType && dimensions.length > 0)
      case 2: return Math.abs(dimWeightSum - 100) < 0.01
      case 3: return dimensions.length > 0
      case 4: return true
      default: return false
    }
  }, [step, company, name, modelType, dimensions, dimWeightSum])

  function chooseModel(t: TemplateSummary) {
    // نجلب أبعاد القالب بشكل ضمني عبر توليد AI أو الاعتماد على أوزان القالب:
    // الخطوة 1 تنصّب مسوّدة أوّليّة بأوزان القالب + معايير فارغة، ثم يُتاح للمستخدم:
    // (أ) تعديل الأوزان في الخطوة 2، (ب) توليد المعايير عبر AI في الخطوة 3،
    // أو (ج) تخطّي AI وإدخال المعايير يدوياً لاحقاً من صفحات CRUD القائمة.
    setModelType(t.modelType)
    // مسوّدة قالبية أوّلية — نطلب /generate-assessment للحصول على الأبعاد الحقيقية
    // (نُعيد استخدام نفس القالب على السيرفر لضمان المصدر الواحد).
    setDimensions([])
    setAiApplied(false)
    seedFromTemplate(t.modelType)
  }

  async function seedFromTemplate(mt: Exclude<AssessmentModelType, 'CUSTOM'>) {
    try {
      // نطلب توليد AI فارغ للحصول على الأبعاد وأوزانها بأسمائها الرسمية،
      // ثم نمسح المعايير المولّدة (المستخدم قد يريد Skip AI).
      // نفعل ذلك بدون Claude عبر endpoint from-template (يُنشئ في القاعدة)
      // لذلك نبني الأبعاد محلياً من قائمة القوالب.
      // — بدلاً من ذلك نجلب مقاييس القالب عبر endpoint templates + نبني placeholder.
      // (نستفيد فقط من dimensionsCount).
      // النتيجة: مسوّدة أبعاد فارغة الأسماء يعيد ملؤها generateAI أو المستخدم.
      // للحصول على أسماء الأبعاد الرسمية، نستدعي generate-assessment (يمرّ بالسيرفر)
      // ولكن هذا يتطلّب Claude. البديل: نُحصّل الأسماء من قالب بالكلاينت
      // (نسخة مصغّرة).
      setDimensions(TEMPLATE_SHAPES[mt].map((d, i) => ({
        name: d.name, weight: d.weight, order: i + 1, criteria: [],
      })))
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر تحميل القالب'))
    }
  }

  async function runAI() {
    if (!company || !modelType) return
    setAiRunning(true)
    try {
      const res: AIGeneratedAssessment = await generateAssessmentAI({ companyId: company.id, modelType })
      // ندمج المعايير التي أعادها Claude مع أبعادنا الحالية.
      setDimensions((prev) =>
        prev.map((d) => {
          const match = res.dimensions.find((x) => x.name.trim() === d.name.trim())
          return match ? { ...d, criteria: match.criteria } : d
        })
      )
      setAiApplied(true)
      toast.success('تم توليد المعايير من Claude')
    } catch (err) {
      const upgrade = planUpgradeFromError(err)
      if (upgrade) {
        toast.error('توليد AI متاح في الباقة الاحترافية فأعلى.')
      } else {
        toast.error(apiErrorMessage(err, 'تعذّر توليد المعايير'))
      }
    } finally {
      setAiRunning(false)
    }
  }

  async function launch() {
    if (!company || !modelType) return
    setLaunching(true)
    try {
      await buildAssessment({
        companyId: company.id,
        name: name.trim(),
        modelType,
        dimensions,
      })
      toast.success('تم إطلاق التقييم — تقدر تُدخل الدرجات وتحسب النضج لاحقاً')
      navigate('/ai-center')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر إطلاق التقييم'))
    } finally {
      setLaunching(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="معالج التقييم" />
        <div className="flex justify-center py-16"><LoadingSpinner size="lg" label="جاري التحميل…" /></div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="معالج التقييم" />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          description="أنشئ شركة أوّلاً من لوحة القيادة."
          icon={<span className="text-4xl">🏢</span>}
          action={<Link to="/companies/add" className="underline">إضافة شركة</Link>}
        />
      </div>
    )
  }

  const progress = ((step + 1) / 5) * 100

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="معالج التقييم المهيكل"
        description="بناء تقييم مؤسسي (BSC / EFQM / PESTEL / PORTER / OKR) في 5 خطوات."
      />

      <Card className="overflow-hidden">
        <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-fuchsia-500" />
        <CardHeader>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{`الخطوة ${step + 1} من 5 · ${STEP_LABEL[step]}`}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>

        <CardContent className="grid gap-6">
          {step === 0 && (
            <div className="grid gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                الشركة: <strong>{company.name}</strong> · {company.sector ?? 'قطاع غير محدّد'} · {company.stage ?? 'مرحلة غير محدّدة'}
              </div>
              <div className="space-y-1">
                <Label htmlFor="a_name">اسم التقييم</Label>
                <Input id="a_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: تقييم BSC 2026" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((t) => (
                <button
                  key={t.modelType}
                  onClick={() => chooseModel(t)}
                  className={`text-right rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-md ${
                    modelType === t.modelType ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="font-semibold">{t.displayName}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                  <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                    {t.dimensionsCount} أبعاد · {t.criteriaCount} معايير افتراضية
                  </div>
                </button>
              ))}
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                عدّل أوزان الأبعاد بحيث يكون مجموعها = 100. المجموع الحالي: <strong>{Math.round(dimWeightSum * 100) / 100}%</strong>
              </p>
              <ul className="grid gap-2">
                {dimensions.map((d, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    <span className="flex-1 font-medium">{d.name}</span>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={d.weight}
                      onChange={(e) => {
                        const v = Number(e.target.value) || 0
                        setDimensions((prev) => prev.map((x, idx) => idx === i ? { ...x, weight: v } : x))
                      }}
                      className="w-24 text-center tabular-nums"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </li>
                ))}
              </ul>
              {Math.abs(dimWeightSum - 100) >= 0.01 && (
                <p className="text-sm text-rose-600">مجموع الأوزان يجب أن يساوي 100 بالضبط قبل المتابعة.</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                Claude يقترح 2-3 معايير قطاعية لكل بُعد بناءً على قطاع "{company.sector ?? 'غير محدد'}" ومرحلة "{company.stage ?? 'غير محدّدة'}". ميزة PROFESSIONAL.
              </p>
              <div className="flex gap-2">
                <Button onClick={runAI} disabled={aiRunning}>
                  {aiRunning ? 'جاري التوليد…' : aiApplied ? 'إعادة التوليد' : 'شغّل توليد AI'}
                </Button>
                <Button variant="outline" onClick={() => setStep(4)}>تخطّي — سأدخل يدوياً لاحقاً</Button>
              </div>
              {aiApplied && (
                <ul className="grid gap-2">
                  {dimensions.map((d, i) => (
                    <li key={i} className="rounded-lg border bg-card p-3">
                      <div className="font-medium text-sm">{d.name} <span className="text-xs text-muted-foreground">({d.weight}%)</span></div>
                      {d.criteria.length === 0 ? (
                        <p className="mt-1 text-xs text-muted-foreground">لا اقتراحات — قد يعيدها التوليد التالي.</p>
                      ) : (
                        <ul className="mt-1 grid gap-1 text-xs">
                          {d.criteria.map((c, j) => (
                            <li key={j} className="flex items-center justify-between rounded-md border bg-muted/30 p-2">
                              <span>{c.name}</span>
                              <span className="tabular-nums text-muted-foreground">{c.weight}%</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="font-semibold">{name || '—'}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {modelType ? MODEL_LABEL_FALLBACK[modelType] : '—'} · {dimensions.length} أبعاد ·{' '}
                  {dimensions.reduce((s, d) => s + d.criteria.length, 0)} معيار
                </div>
              </div>
              <ul className="grid gap-2">
                {dimensions.map((d, i) => (
                  <li key={i} className="rounded-lg border bg-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{d.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{d.weight}%</span>
                    </div>
                    {d.criteria.length > 0 && (
                      <ul className="mt-2 grid gap-1 text-xs">
                        {d.criteria.map((c, j) => (
                          <li key={j} className="flex justify-between rounded-md border bg-muted/20 px-2 py-1">
                            <span>{c.name}</span>
                            <span className="tabular-nums text-muted-foreground">{c.weight}%</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                عند الإطلاق، يُحفَظ التقييم في القاعدة كمسوّدة. تقدر تُدخل درجات ومؤشرات وتُشغّل الحساب لاحقاً.
              </p>
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t p-4">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1) as WizardStep)} disabled={step === 0}>
            السابق
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => Math.min(4, s + 1) as WizardStep)} disabled={!canAdvance}>
              التالي
            </Button>
          ) : (
            <Button onClick={launch} disabled={launching || !canAdvance}>
              {launching ? 'جاري الإطلاق…' : 'إطلاق التقييم'}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}

// نسخة كلاينت مصغّرة من قوالب النماذج (أسماء الأبعاد وأوزانها فقط).
// تُبقي مصدر الحقيقة على السيرفر عبر lib/assessmentTemplates.ts — هذه النسخة
// تُستخدم في المعالج فقط لعرض الأبعاد قبل الإطلاق. تُطابَق بالاسم.
const TEMPLATE_SHAPES: Record<Exclude<AssessmentModelType, 'CUSTOM'>, { name: string; weight: number }[]> = {
  BSC: [
    { name: 'المنظور المالي', weight: 25 },
    { name: 'منظور العملاء', weight: 25 },
    { name: 'العمليات الداخلية', weight: 25 },
    { name: 'التعلّم والنمو', weight: 25 },
  ],
  EFQM: [
    { name: 'القيادة', weight: 10 },
    { name: 'الاستراتيجية', weight: 10 },
    { name: 'الأفراد', weight: 10 },
    { name: 'الشراكات والموارد', weight: 10 },
    { name: 'العمليات والمنتجات والخدمات', weight: 10 },
    { name: 'نتائج الأفراد', weight: 10 },
    { name: 'نتائج العملاء', weight: 15 },
    { name: 'نتائج المجتمع', weight: 10 },
    { name: 'نتائج الأعمال', weight: 15 },
  ],
  PESTEL: [
    { name: 'العوامل السياسية', weight: 17 },
    { name: 'العوامل الاقتصادية', weight: 17 },
    { name: 'العوامل الاجتماعية', weight: 17 },
    { name: 'العوامل التقنية', weight: 17 },
    { name: 'العوامل البيئية', weight: 16 },
    { name: 'العوامل القانونية', weight: 16 },
  ],
  PORTER: [
    { name: 'شدّة التنافس بين المنافسين الحاليين', weight: 20 },
    { name: 'قوّة الموردين', weight: 20 },
    { name: 'قوّة العملاء', weight: 20 },
    { name: 'تهديد الداخلين الجدد', weight: 20 },
    { name: 'تهديد البدائل', weight: 20 },
  ],
  OKR: [
    { name: 'صياغة الأهداف (Objectives)', weight: 33 },
    { name: 'جودة النتائج الرئيسية (Key Results)', weight: 34 },
    { name: 'إيقاع التنفيذ والمراجعة', weight: 33 },
  ],
}
