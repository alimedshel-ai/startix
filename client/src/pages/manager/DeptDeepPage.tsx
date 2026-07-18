import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'
import { useAuthStore } from '@/store/authStore'
import type { SpecialtyDeptType } from '@/types/user'
import { NextStepCard } from '@/components/strategic/NextStepCard'

import { DeepAnalysisPage } from './DeepAnalysisPage'

// ─── التحليل العميق للإدارة — الصفحة الموحّدة ──────────────────────
// كل ما يخصّ التحليل في مكان واحد:
//   • التحليل السريع (٤ أسئلة أساسيّة) — لبدء سريع
//   • التحليل الموسّع (٦٠+ سؤال على ٦ محاور) — لتحليل شامل
// التبديل عبر تبويبات في أعلى الصفحة، وكل قسم يحفظ بياناته مستقلاً.

interface DeepOption {
  key: string
  label: string
  icon?: string
}

interface DeepPrompt {
  question: string
  hint?: string
  options: DeepOption[]
}

// الأسئلة الأربعة العامّة — تصلح لأي إدارة كبداية سريعة (fallback).
const GENERIC_PROMPTS: DeepPrompt[] = [
  {
    question: 'ما هو القيد الأكبر الذي يعيق هذا القسم اليوم؟',
    hint: 'اختر كل ما ينطبق — يمكنك إضافة قيد غير مُقترح في خانة "أخرى".',
    options: [
      { key: 'hr_shortage',     icon: '🔴', label: 'نقص الموارد البشرية (فريق صغير أو غير متخصّص)' },
      { key: 'budget',          icon: '💰', label: 'قيود مالية (ميزانية محدودة أو تكاليف مرتفعة)' },
      { key: 'manual_ops',      icon: '⚙️', label: 'عمليات غير مؤتمتة (اعتماد يدوي مفرط)' },
      { key: 'data_gap',        icon: '📊', label: 'نقص البيانات لاتخاذ القرار' },
      { key: 'collab',          icon: '🤝', label: 'ضعف التعاون مع الإدارات الأخرى' },
      { key: 'time_pressure',   icon: '⏱️', label: 'ضغط الوقت والأولويات المتغيّرة' },
      { key: 'regulatory',      icon: '📜', label: 'قيود تنظيمية أو امتثال معقّد' },
    ],
  },
  {
    question: 'أي عملية تبدو هشّة، وكم ستكلّف لو فشلت غداً؟',
    hint: 'حدّد نقاط الخطر الحقيقية — المكلفة إن فشلت — لتعطى الأولوية.',
    options: [
      { key: 'cashflow',        icon: '💸', label: 'التدفق المالي / السيولة اليومية' },
      { key: 'hiring',          icon: '👥', label: 'التعيينات والتوظيف' },
      { key: 'supply_chain',    icon: '📦', label: 'سلسلة التوريد أو الإمداد' },
      { key: 'systems',         icon: '💻', label: 'الأنظمة التقنية / السيرفرات' },
      { key: 'customer_service',icon: '📞', label: 'خدمة العملاء / الدعم' },
      { key: 'sales_marketing', icon: '📈', label: 'المبيعات والتسويق' },
      { key: 'cybersecurity',   icon: '🔐', label: 'الأمن السيبراني والبيانات' },
      { key: 'compliance_docs', icon: '📄', label: 'تجديد التراخيص والاعتمادات' },
    ],
  },
  {
    question: 'لو كنت تستطيع أتمتة مهمة واحدة أو حذفها، فماذا ستكون؟',
    hint: 'حدّد المهام التي تستنزف الوقت بلا قيمة عالية — هي الأولى بالأتمتة.',
    options: [
      { key: 'auto_reports',    icon: '📊', label: 'التقارير الروتينية' },
      { key: 'auto_emails',     icon: '✉️', label: 'الرسائل والإشعارات المتكرّرة' },
      { key: 'auto_data_entry', icon: '📋', label: 'إدخال البيانات اليدوي' },
      { key: 'auto_files',      icon: '🗂️', label: 'الأرشفة وإدارة الملفات' },
      { key: 'auto_approvals',  icon: '🤖', label: 'الموافقات والاعتمادات' },
      { key: 'auto_scheduling', icon: '📅', label: 'جدولة المواعيد والاجتماعات' },
      { key: 'auto_reviews',    icon: '🔍', label: 'المراجعات الدورية' },
      { key: 'auto_invoices',   icon: '🧾', label: 'إعداد الفواتير والمطالبات' },
    ],
  },
  {
    question: 'ما هي الممارسة الجيدة الراسخة هنا والتي تستحق التوسّع؟',
    hint: 'حدّد ما يعمل جيداً بالفعل — التوسّع فيه أرخص من بناء ما هو جديد.',
    options: [
      { key: 'team_culture',    icon: '👥', label: 'ثقافة الفريق والتعاون' },
      { key: 'data_driven',     icon: '📊', label: 'اتخاذ القرار المبني على البيانات' },
      { key: 'customer_focus',  icon: '🎯', label: 'التركيز على العميل' },
      { key: 'innovation',      icon: '💡', label: 'الإبداع والابتكار' },
      { key: 'execution_speed', icon: '⚡', label: 'السرعة في التنفيذ' },
      { key: 'risk_mgmt',       icon: '🛡️', label: 'إدارة المخاطر الاستباقية' },
      { key: 'learning',        icon: '📚', label: 'التعلّم المستمر' },
      { key: 'ownership',       icon: '🏆', label: 'تملّك المسؤولية والنتائج' },
    ],
  },
]

// ─── أسئلة سريعة خاصّة بإدارة المشاريع (PROJECTS) ────────────────
// تحافظ على البنية الرباعيّة (قيد → هشاشة → أتمتة → قوّة) كي يبقى الربط
// بسلسلة القيمة شغّالاً (deepAnalysisToVC)، لكن بلغة إدارة المشاريع الفعليّة:
// أنواع المشاريع، تعثّرها، ما يستحقّ الأتمتة، وما يستحقّ التوسّع.
const PROJECTS_PROMPTS: DeepPrompt[] = [
  {
    question: 'ما أكبر قيد يعيق نجاح مشاريعك اليوم؟',
    hint: 'يختلف باختلاف نوع المشروع (تقني · إنشائي · تطوير منتج · تحوّل رقمي · مشاريع عملاء). اختر ما ينطبق.',
    options: [
      { key: 'proj_scope',            icon: '🔄', label: 'تغيّر النطاق المتكرّر (Scope Creep)' },
      { key: 'proj_resource_conflict',icon: '👥', label: 'تعارض الموارد بين المشاريع المتوازية' },
      { key: 'proj_estimation',       icon: '⏱️', label: 'سوء تقدير الوقت أو الكلفة' },
      { key: 'proj_slow_decisions',   icon: '🐢', label: 'بطء القرارات والموافقات' },
      { key: 'proj_no_methodology',   icon: '🧭', label: 'غياب منهجيّة موحّدة (Agile / PMBOK)' },
      { key: 'proj_stakeholder_comm', icon: '🤝', label: 'ضعف تواصل أصحاب المصلحة' },
    ],
  },
  {
    question: 'أي جانب في مشاريعك هشّ ومكلف لو تعثّر غداً؟',
    hint: 'نقاط الخطر التي إن سقطت تُعطّل التسليم أو تُحرق الميزانية.',
    options: [
      { key: 'proj_critical_path', icon: '📉', label: 'تأخّر المسار الحرج يوقف التسليم' },
      { key: 'proj_budget_overrun',icon: '💸', label: 'تجاوز الميزانية المعتمدة' },
      { key: 'proj_key_person',    icon: '🔑', label: 'الاعتماد على شخص محوري واحد' },
      { key: 'proj_quality',       icon: '✅', label: 'تدهور الجودة تحت ضغط الموعد' },
      { key: 'proj_vendor_dep',    icon: '📦', label: 'الاعتماد على مورّد / طرف ثالث' },
      { key: 'proj_scope_risk',    icon: '🎯', label: 'غموض النطاق أو المتطلّبات' },
    ],
  },
  {
    question: 'أي مهمّة في إدارة المشاريع تستنزف وقتك وتستحقّ الأتمتة؟',
    hint: 'المهام المتكرّرة قليلة القيمة — هي الأولى بالأتمتة.',
    options: [
      { key: 'proj_auto_status',   icon: '📊', label: 'تقارير حالة المشروع' },
      { key: 'proj_auto_tracking', icon: '📋', label: 'تتبّع المهام والتقدّم' },
      { key: 'proj_auto_resource', icon: '🗂️', label: 'تخصيص وجدولة الموارد' },
      { key: 'proj_auto_docs',     icon: '📁', label: 'إدارة وثائق المشروع' },
      { key: 'proj_auto_approvals',icon: '🤖', label: 'الموافقات والاعتمادات' },
      { key: 'proj_auto_schedule', icon: '📅', label: 'جدولة الاجتماعات والمراحل' },
    ],
  },
  {
    question: 'ما أقوى ممارسة راسخة في إدارة مشاريعك وتستحقّ التوسّع؟',
    hint: 'ما يعمل جيداً بالفعل — التوسّع فيه أرخص من بناء الجديد.',
    options: [
      { key: 'proj_methodology',   icon: '🧭', label: 'منهجيّة واضحة ومطبّقة (Agile / PMBOK)' },
      { key: 'proj_risk_register', icon: '🛡️', label: 'سجلّ مخاطر منتظم لكل مشروع' },
      { key: 'proj_lessons',       icon: '📚', label: 'توثيق الدروس المستفادة' },
      { key: 'proj_reporting',     icon: '📈', label: 'تقارير حالة دوريّة منتظمة' },
      { key: 'proj_mature_pmo',    icon: '🏛️', label: 'PMO ناضج بحوكمة وأولويّات' },
      { key: 'proj_resource_plan', icon: '👥', label: 'تخطيط الموارد مسبقاً' },
    ],
  },
]

// خريطة الإدارات ذات الأسئلة المتخصّصة — البقيّة تسقط على العامّة.
const DEPT_PROMPTS: Partial<Record<SpecialtyDeptType, DeepPrompt[]>> = {
  PROJECTS: PROJECTS_PROMPTS,
}

function promptsFor(specialty: SpecialtyDeptType | null | undefined): DeepPrompt[] {
  return (specialty && DEPT_PROMPTS[specialty]) || GENERIC_PROMPTS
}

interface DeepAnswer {
  selected: string[]
  other: string
}

interface DeepAnswers {
  answers: Record<string, DeepAnswer | string>
}

type AnswersState = Record<number, DeepAnswer>

function normalize(raw: unknown): AnswersState {
  const state: AnswersState = {}
  if (!raw || typeof raw !== 'object' || !('answers' in raw)) return state
  const a = (raw as DeepAnswers).answers
  if (!a || typeof a !== 'object') return state
  for (const [k, v] of Object.entries(a)) {
    const idx = Number(k)
    if (!Number.isInteger(idx)) continue
    if (typeof v === 'string') {
      state[idx] = { selected: [], other: v }
      continue
    }
    if (v && typeof v === 'object') {
      const obj = v as Partial<DeepAnswer>
      state[idx] = {
        selected: Array.isArray(obj.selected) ? obj.selected.filter((x) => typeof x === 'string') : [],
        other: typeof obj.other === 'string' ? obj.other : '',
      }
    }
  }
  return state
}

function emptyAnswer(): DeepAnswer {
  return { selected: [], other: '' }
}

function hasContent(a: DeepAnswer | undefined): boolean {
  if (!a) return false
  return a.selected.length > 0 || a.other.trim().length > 0
}

type ViewMode = 'quick' | 'extended' | 'both'

export function DeptDeepPage() {
  const [params, setParams] = useSearchParams()
  const modeParam = params.get('mode') as ViewMode | null
  const mode: ViewMode = modeParam ?? 'both'

  function switchMode(next: ViewMode) {
    const nextParams = new URLSearchParams(params)
    nextParams.set('mode', next)
    setParams(nextParams, { replace: true })
  }

  const clientQuery = params.get('client') ? `?client=${params.get('client')}` : ''
  const companyId = params.get('client') ?? undefined

  return (
    <div className="flex flex-col gap-6">
      <BackToClients />
      <PageHeader
        title="التحليل العميق للإدارة"
        description="أساس كل العمل — سريع (٤ أسئلة) + موسّع (٦٠+ سؤال) في مكان واحد."
      />

      {/* شريط تبديل الوضع */}
      <ModeSwitcher mode={mode} onSwitch={switchMode} />

      {(mode === 'quick' || mode === 'both') && <QuickAnalysisSection />}

      {mode === 'both' && (
        <div className="my-2 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">↓ التحليل الموسّع ↓</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      )}

      {/* embedded — نمرّر embedded لتفادي تكرار بطاقة «الخطوة التالية» */}
      {(mode === 'extended' || mode === 'both') && <DeepAnalysisPage embedded />}

      {/* بطاقة «① التحليل — عدسات اختياريّة»: توضّح أن المسار غير مُجبَر،
          وتعطي «التالي المقترح (سلسلة القيمة)» + «تخطَّ للتوليف SWOT». */}
      <NextStepCard clientQuery={clientQuery} companyId={companyId} />
    </div>
  )
}

// شريط اختيار وضع العرض — سريع / موسّع / كلاهما.
function ModeSwitcher({ mode, onSwitch }: { mode: ViewMode; onSwitch: (m: ViewMode) => void }) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs">
        <span className="text-muted-foreground">
          📚 اختر عمق التحليل:
        </span>
        <div className="flex flex-wrap gap-1.5">
          <ModeButton
            active={mode === 'quick'}
            onClick={() => onSwitch('quick')}
            icon="⚡"
            label="السريع فقط"
            hint="٤ أسئلة أساسيّة — ١٠-١٥ دقيقة"
          />
          <ModeButton
            active={mode === 'both'}
            onClick={() => onSwitch('both')}
            icon="📚"
            label="الاثنان معاً (موصى به)"
            hint="السريع + الموسّع — أساس التحليل الكامل"
          />
          <ModeButton
            active={mode === 'extended'}
            onClick={() => onSwitch('extended')}
            icon="🔬"
            label="الموسّع فقط"
            hint="٦٠+ سؤال على ٦ محاور — ٣٠-٤٥ دقيقة"
          />
        </div>
      </CardContent>
    </Card>
  )
}

function ModeButton({ active, onClick, icon, label, hint }: {
  active: boolean; onClick: () => void; icon: string; label: string; hint: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`inline-flex flex-col items-start gap-0.5 rounded-md border px-3 py-1.5 transition ${
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <span className="flex items-center gap-1 text-xs font-semibold">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <span className={`text-[9px] ${active ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
        {hint}
      </span>
    </button>
  )
}

// ─── التحليل السريع (٤ أسئلة) ──────────────────────────────────
function QuickAnalysisSection() {
  const scope = useClientScopedCompany()
  const company = scope.company
  // أسئلة سريعة متكيّفة حسب تخصّص المدير — إدارة المشاريع لها بنكها الخاصّ.
  const specialty = useAuthStore((s) => s.user?.specialtyDeptType ?? null)
  const prompts = promptsFor(specialty)
  const [answers, setAnswers] = useState<AnswersState>({})
  const [artifactLoading, setArtifactLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!company) return
    let cancel = false
    setArtifactLoading(true)
    setAnswers({})
    setSavedAt(null)
    ;(async () => {
      try {
        const artifact = await getArtifact<DeepAnswers>(company.id, 'DEPT_DEEP_ANSWERS')
        if (cancel) return
        if (artifact) {
          setAnswers(normalize(artifact.data))
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل الإجابات السريعة'))
      } finally {
        if (!cancel) setArtifactLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [company])

  const loading = scope.loading || artifactLoading

  function toggleOption(idx: number, key: string) {
    setAnswers((prev) => {
      const current = prev[idx] ?? emptyAnswer()
      const selected = current.selected.includes(key)
        ? current.selected.filter((k) => k !== key)
        : [...current.selected, key]
      return { ...prev, [idx]: { ...current, selected } }
    })
  }

  function updateOther(idx: number, other: string) {
    setAnswers((prev) => ({
      ...prev,
      [idx]: { ...(prev[idx] ?? emptyAnswer()), other },
    }))
  }

  async function save() {
    if (!company) return
    const filled = prompts.reduce(
      (n, _, i) => (hasContent(answers[i]) ? n + 1 : n),
      0
    )
    if (filled === 0) {
      toast.error('اختر خياراً واحداً على الأقل أو اكتب سبباً في خانة "أخرى" قبل الحفظ.')
      return
    }
    setSaving(true)
    try {
      const payload: DeepAnswers = {
        answers: Object.fromEntries(
          prompts.map((_, i) => {
            const a = answers[i] ?? emptyAnswer()
            return [String(i), { selected: a.selected, other: a.other.trim() }]
          }).filter(([, v]) => (v as DeepAnswer).selected.length > 0 || (v as DeepAnswer).other.length > 0)
        ),
      }
      const saved = await upsertArtifact<DeepAnswers>(company.id, 'DEPT_DEEP_ANSWERS', payload)
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ ${filled} من ٤ أسئلة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner size="lg" label="جاري التحميل…" />
      </div>
    )
  }

  if (!company) {
    return (
      <EmptyState
        title={scope.error ?? 'لا توجد شركة مرتبطة بحسابك'}
        description="عُد إلى «عملائي» أو أنشئ شركة قبل حفظ إجاباتك."
        icon={<span className="text-4xl">🏢</span>}
      />
    )
  }

  const filled = prompts.reduce((n, _, i) => (hasContent(answers[i]) ? n + 1 : n), 0)

  return (
    <>
      <Card className="border-2 border-amber-300 bg-amber-50/40">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <span>⚡</span>
                التحليل السريع — ٤ أسئلة أساسيّة
                <span className="rounded-full border bg-white px-2 py-0.5 text-xs font-medium tabular-nums">
                  {filled}/٤
                </span>
              </CardTitle>
              <CardDescription>
                {savedAt
                  ? `آخر حفظ: ${new Date(savedAt).toLocaleString('ar-SA')}`
                  : 'اختر ما ينطبق من كل قائمة، أو أضِف "أخرى" لو لم يغطِّ الخيارات حالتك.'}
              </CardDescription>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? 'جاري…' : '💾 حفظ التحليل السريع'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {prompts.map((p, i) => {
        const current = answers[i] ?? emptyAnswer()
        return (
          <Card
            key={i}
            className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader>
              <CardTitle className="text-base">السؤال {i + 1} من ٤</CardTitle>
              <CardDescription className="text-foreground">
                {p.question}
              </CardDescription>
              {p.hint && (
                <p className="text-xs text-muted-foreground">{p.hint}</p>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {p.options.map((opt) => {
                  const checked = current.selected.includes(opt.key)
                  return (
                    <label
                      key={opt.key}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border p-2.5 text-sm transition hover:bg-accent ${
                        checked ? 'border-primary bg-primary/5' : 'bg-card'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 accent-primary"
                        checked={checked}
                        onChange={() => toggleOption(i, opt.key)}
                      />
                      <span className="flex-1 leading-snug">
                        {opt.icon && <span className="ml-1" aria-hidden>{opt.icon}</span>}
                        {opt.label}
                      </span>
                    </label>
                  )
                })}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`other_${i}`} className="text-xs text-muted-foreground">
                  أخرى — اكتب سبباً غير مُقترح إن وجد
                </Label>
                <Textarea
                  id={`other_${i}`}
                  value={current.other}
                  onChange={(e) => updateOther(i, e.target.value)}
                  rows={2}
                  placeholder="اترك فارغاً لو الخيارات أعلاه كافية…"
                />
              </div>
            </CardContent>
          </Card>
        )
      })}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'جاري الحفظ…' : '💾 حفظ التحليل السريع'}
        </Button>
      </div>
    </>
  )
}

// ─── زر الرجوع إلى «عملائي» ───────────────────────────────────
function BackToClients({ companyId, companyName }: { companyId?: string; companyName?: string } = {}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-2 border-primary/40 bg-primary/5 p-2">
      <Link
        to="/manager/clients"
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <span>←</span>
        <span>🤝 عملائي</span>
      </Link>
      {companyId && companyName && (
        <Link
          to={`/manager/clients/${companyId}`}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <span>📋</span>
          <span>لوحة {companyName}</span>
        </Link>
      )}
    </div>
  )
}
