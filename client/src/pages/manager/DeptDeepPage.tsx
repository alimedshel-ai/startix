import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { getMyFirstCompany, type Company } from '@/lib/deptApi'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'

// ─── تحليل عميق للقسم — 4 أسئلة متعدّدة الاختيار + "أخرى" ────────────────
// يُحفَظ في القاعدة كـ StrategicArtifact بنوع 'DEPT_DEEP_ANSWERS' لكل شركة.
// شكل البيانات الجديد: { answers: { "0": { selected: string[], other: string }, ... } }.
// النصوص القديمة (سلاسل) تُهاجَر تلقائياً إلى `other` لحفظ الأمانة العكسية.

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

const PROMPTS: DeepPrompt[] = [
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
    // هجرة عكسية: النص القديم يذهب لخانة "أخرى"، اختيارات فارغة.
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

export function DeptDeepPage() {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [answers, setAnswers] = useState<AnswersState>({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const { company: co } = await getMyFirstCompany()
        if (cancel || !co) return
        setCompany(co)
        const artifact = await getArtifact<DeepAnswers>(co.id, 'DEPT_DEEP_ANSWERS')
        if (cancel) return
        if (artifact) {
          setAnswers(normalize(artifact.data))
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل الإجابات المحفوظة'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

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
    const filled = PROMPTS.reduce(
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
          PROMPTS.map((_, i) => {
            const a = answers[i] ?? emptyAnswer()
            return [String(i), { selected: a.selected, other: a.other.trim() }]
          }).filter(([, v]) => (v as DeepAnswer).selected.length > 0 || (v as DeepAnswer).other.length > 0)
        ),
      }
      const saved = await upsertArtifact<DeepAnswers>(company.id, 'DEPT_DEEP_ANSWERS', payload)
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ ${filled} من ٤ أسئلة في القاعدة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل عميق للقسم" />
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" label="جاري التحميل…" />
        </div>
      </div>
    )
  }

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="تحليل عميق للقسم" />
        <EmptyState
          title="لا توجد شركة مرتبطة بحسابك"
          description="ابدأ من لوحة القيادة بإنشاء شركة قبل حفظ إجاباتك."
          icon={<span className="text-4xl">🏢</span>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تحليل عميق للقسم"
        description={
          savedAt
            ? `آخر حفظ في القاعدة: ${new Date(savedAt).toLocaleString('ar-SA')}`
            : 'اختر ما ينطبق من كل قائمة. أضِف "أخرى" فقط لو لم يغطِّ الخيارات المقترحة حالتك.'
        }
      />

      {PROMPTS.map((p, i) => {
        const current = answers[i] ?? emptyAnswer()
        return (
          <Card
            key={i}
            className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardHeader>
              <CardTitle className="text-base">السؤال {i + 1}</CardTitle>
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
          {saving ? 'جاري الحفظ…' : 'حفظ في القاعدة'}
        </Button>
      </div>
    </div>
  )
}
