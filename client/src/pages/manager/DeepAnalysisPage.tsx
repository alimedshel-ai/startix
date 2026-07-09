import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { EmptyState } from '@/components/EmptyState'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { apiErrorMessage } from '@/lib/api'
import { DEPT_LABEL, type DeptCode } from '@/lib/deptApi'
import {
  DEPT_QUESTIONS,
  type CheckboxQuestion,
  type QuestionEntry,
  type RadioQuestion,
  type SectionEntry,
  type TextareaQuestion,
} from '@/lib/deptQuestions'
import { getArtifact, upsertArtifact } from '@/lib/strategicApi'
import { useAuthStore } from '@/store/authStore'
import { useClientScopedCompany } from '@/hooks/useClientScopedCompany'

// ─── A1 — التحليل العميق المخصّص للتخصّص ──────────────────────────────────────
// المسار: /manager/deep-analysis (يقرأ ?client=<id> عبر hook مشترك).
// يستهلك DEPT_QUESTIONS[specialty] من بنك stratix القديم (٦ أقسام × ~٥٠ سؤالاً
// لـ HR حالياً؛ باقي التخصّصات تُنقل تدريجياً في commits لاحقة).
//
// شكل التخزين: StrategicArtifact بنوع 'DEPT_DEEP_FULL' مستقلّ عن
// 'DEPT_DEEP_ANSWERS' القديم (٤ أسئلة عامة) حتى لا تتداخل مسودّتان.
// شكل البيانات: { deptCode, answers: { [questionId]: string | string[] } }.

type QAValue = string | string[]

interface DeepFullData {
  deptCode: DeptCode
  answers: Record<string, QAValue>
}

function ensureQAValue(v: unknown): QAValue | null {
  if (typeof v === 'string') return v
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v as string[]
  return null
}

function normalize(raw: unknown): Record<string, QAValue> {
  const out: Record<string, QAValue> = {}
  if (!raw || typeof raw !== 'object' || !('answers' in raw)) return out
  const a = (raw as DeepFullData).answers
  if (!a || typeof a !== 'object') return out
  for (const [k, v] of Object.entries(a)) {
    const value = ensureQAValue(v)
    if (value != null) out[k] = value
  }
  return out
}

export function DeepAnalysisPage() {
  const user = useAuthStore((s) => s.user)
  const scope = useClientScopedCompany()
  const company = scope.company
  const specialty = (user?.specialtyDeptType ?? null) as DeptCode | null
  const bank = specialty ? DEPT_QUESTIONS[specialty] ?? null : null

  const [answers, setAnswers] = useState<Record<string, QAValue>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // نجمّع الأسئلة حسب القسم لعرضها ضمن بطاقة لكل قسم — أفضل من قائمة مسطّحة
  // بلا تنظيم لبنك يقارب الـ٥٠ سؤالاً.
  const grouped = useMemo(() => {
    if (!bank) return []
    const map = new Map<string, { section: SectionEntry; questions: QuestionEntry[] }>()
    for (const s of bank.sections) map.set(s.id, { section: s, questions: [] })
    for (const q of bank.questions) {
      const bucket = map.get(q.sectionId)
      if (bucket) bucket.questions.push(q)
    }
    return Array.from(map.values())
  }, [bank])

  useEffect(() => {
    if (!company || !specialty || !bank) return
    let cancel = false
    setLoading(true)
    setAnswers({})
    setSavedAt(null)
    ;(async () => {
      try {
        const artifact = await getArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL')
        if (cancel) return
        if (artifact && artifact.data && (artifact.data as DeepFullData).deptCode === specialty) {
          setAnswers(normalize(artifact.data))
          setSavedAt(artifact.updatedAt)
        }
      } catch (err) {
        if (!cancel) toast.error(apiErrorMessage(err, 'تعذّر تحميل إجاباتك السابقة'))
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => { cancel = true }
  }, [company, specialty, bank])

  const answered = Object.keys(answers).length
  const total = bank?.questions.length ?? 0
  const progressPct = total > 0 ? Math.round((answered / total) * 100) : 0

  async function save() {
    if (!company || !specialty) return
    if (answered === 0) {
      toast.error('أجب على سؤال واحد على الأقل قبل الحفظ.')
      return
    }
    setSaving(true)
    try {
      const payload: DeepFullData = { deptCode: specialty, answers }
      const saved = await upsertArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL', payload)
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ ${answered} إجابة في القاعدة`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'تعذّر الحفظ'))
    } finally {
      setSaving(false)
    }
  }

  function setRadio(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  function toggleCheckbox(id: string, value: string) {
    setAnswers((prev) => {
      const current = prev[id]
      const arr = Array.isArray(current) ? current : []
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
      if (next.length === 0) {
        const { [id]: _drop, ...rest } = prev
        return rest
      }
      return { ...prev, [id]: next }
    })
  }

  function setText(id: string, value: string) {
    if (value.trim().length === 0) {
      setAnswers((prev) => {
        const { [id]: _drop, ...rest } = prev
        return rest
      })
      return
    }
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  // ─── حالات الفشل ─────────────────────────────────────────────────────
  if (!specialty) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="التحليل العميق" />
        <EmptyState
          title="لا يوجد تخصّص محدّد على حسابك"
          description="حدّث تخصّصك من إعدادات الحساب لعرض بنك الأسئلة العميقة."
        />
      </div>
    )
  }

  if (!bank) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={`التحليل العميق — ${DEPT_LABEL[specialty]}`}
          description="سؤال ٦٠ تقريباً على ٦ أقسام."
        />
        <EmptyState
          icon={<span className="text-4xl">🚧</span>}
          title={`بنك الأسئلة العميقة لإدارة ${DEPT_LABEL[specialty]} قيد الإعداد`}
          description="يمكنك حالياً استخدام «التحليل العميق» المبسّط بأربعة أسئلة."
          action={
            <Link
              to="/manager/dept-deep"
              className="rounded-md border bg-card px-3 py-1.5 text-sm hover:bg-accent"
            >
              فتح التحليل المبسّط
            </Link>
          }
        />
      </div>
    )
  }

  if (scope.loading) return <LoadingSpinner fullPage label="جاري تحميل الشركة…" />

  if (!company) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={`التحليل العميق — ${DEPT_LABEL[specialty]}`} />
        <EmptyState
          title={scope.error ?? 'لا توجد شركة مرتبطة بحسابك'}
          description="عُد إلى «عملائي» واختر عميلاً قبل بدء التحليل."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`التحليل العميق — ${DEPT_LABEL[specialty]}`}
        description={
          savedAt
            ? `آخر حفظ: ${new Date(savedAt).toLocaleString('ar-SA')} · ${answered}/${total} إجابة`
            : `${bank.sections.length} أقسام · ${total} سؤال. الإجابات تُحفَظ في القاعدة لكل عميل.`
        }
      />

      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">التقدّم على {company.name}</div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{progressPct}%</div>
        </CardContent>
      </Card>

      {loading && <LoadingSpinner label="جاري تحميل إجاباتك…" />}

      {grouped.map(({ section, questions }, sectionIndex) => (
        <Card key={section.id} className="overflow-hidden">
          <div className={`h-1 ${sectionAccent(sectionIndex)}`} />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {section.icon && <span aria-hidden>{section.icon}</span>}
              {section.title}
              {section.priority && (
                <span className={`text-[10px] font-medium ${priorityColor(section.priority)}`}>
                  · {section.priority}
                </span>
              )}
            </CardTitle>
            {section.desc && <CardDescription>{section.desc}</CardDescription>}
          </CardHeader>
          <CardContent className="grid gap-5">
            {questions.map((q) => (
              <QuestionField
                key={q.id}
                q={q}
                value={answers[q.id] ?? null}
                onRadio={(v) => setRadio(q.id, v)}
                onCheckbox={(v) => toggleCheckbox(q.id, v)}
                onText={(v) => setText(q.id, v)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : `حفظ ${answered} إجابة`}
        </Button>
      </div>
    </div>
  )
}

// ─── حقل السؤال — يفرّع حسب النوع (radio/checkbox/textarea) ────────────

function QuestionField({
  q, value, onRadio, onCheckbox, onText,
}: {
  q: QuestionEntry
  value: QAValue | null
  onRadio: (v: string) => void
  onCheckbox: (v: string) => void
  onText: (v: string) => void
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-sm leading-relaxed">{q.label}</Label>
      {q.type === 'radio' && <RadioField q={q} value={typeof value === 'string' ? value : null} onSelect={onRadio} />}
      {q.type === 'checkbox' && <CheckboxField q={q} value={Array.isArray(value) ? value : []} onToggle={onCheckbox} />}
      {q.type === 'textarea' && <TextField q={q} value={typeof value === 'string' ? value : ''} onChange={onText} />}
    </div>
  )
}

function RadioField({ q, value, onSelect }: { q: RadioQuestion; value: string | null; onSelect: (v: string) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {q.opts.map((opt) => {
        const checked = value === opt
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition hover:bg-accent ${
              checked ? 'border-primary bg-primary/5' : 'bg-card'
            }`}
          >
            <input
              type="radio"
              name={q.id}
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={checked}
              onChange={() => onSelect(opt)}
            />
            <span className="flex-1 leading-snug">{opt}</span>
          </label>
        )
      })}
    </div>
  )
}

function CheckboxField({ q, value, onToggle }: { q: CheckboxQuestion; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {q.opts.map((opt) => {
        const checked = value.includes(opt)
        return (
          <label
            key={opt}
            className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 text-sm transition hover:bg-accent ${
              checked ? 'border-primary bg-primary/5' : 'bg-card'
            }`}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-primary"
              checked={checked}
              onChange={() => onToggle(opt)}
            />
            <span className="flex-1 leading-snug">{opt}</span>
          </label>
        )
      })}
    </div>
  )
}

function TextField({ q, value, onChange }: { q: TextareaQuestion; value: string; onChange: (v: string) => void }) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={2}
      placeholder={q.placeholder ?? 'اكتب إجابتك…'}
    />
  )
}

// ─── مساعدات بصرية ────────────────────────────────────────────────────

function sectionAccent(index: number): string {
  // نبدّل الألوان بين الأقسام لتمييز بصري بلا فوضى.
  const palettes = [
    'bg-gradient-to-l from-sky-500 to-indigo-500',
    'bg-gradient-to-l from-emerald-500 to-teal-500',
    'bg-gradient-to-l from-rose-500 to-orange-500',
    'bg-gradient-to-l from-violet-500 to-fuchsia-500',
    'bg-gradient-to-l from-amber-500 to-yellow-500',
    'bg-gradient-to-l from-cyan-500 to-blue-500',
  ]
  return palettes[index % palettes.length]
}

function priorityColor(p: string): string {
  if (p === 'حرج') return 'text-rose-600'
  if (p === 'مهم') return 'text-amber-600'
  return 'text-muted-foreground'
}
