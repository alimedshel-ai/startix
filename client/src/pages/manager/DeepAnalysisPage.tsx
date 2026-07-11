import { useEffect, useMemo, useRef, useState } from 'react'
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

// ─── تصنيف نوع التحليل من عنوان القسم/معرّفه ──────────────────
// ٦ أنواع تحليل مختلفة يجمعها هذا البنك. المدير يفلتر بينها.
type AnalysisType = 'situational' | 'technical' | 'administrative' | 'financial' | 'challenges' | 'goals' | 'other'

const ANALYSIS_TYPE_META: Record<AnalysisType, { labelAr: string; icon: string; color: string; descAr: string }> = {
  situational:    { labelAr: 'الوضع الحالي',   icon: '📊', color: 'border-sky-300 bg-sky-50/50 text-sky-900',           descAr: 'تشخيص الحالة الراهنة — أين نحن اليوم.' },
  technical:      { labelAr: 'فنّي',            icon: '🧪', color: 'border-violet-300 bg-violet-50/50 text-violet-900',    descAr: 'الأنظمة والأدوات والعمليات التقنيّة.' },
  administrative: { labelAr: 'إداري',           icon: '🏛️', color: 'border-amber-300 bg-amber-50/50 text-amber-900',        descAr: 'الهيكل، الأدوار، الحوكمة، السياسات.' },
  financial:      { labelAr: 'مالي',            icon: '💰', color: 'border-emerald-300 bg-emerald-50/50 text-emerald-900',  descAr: 'الميزانيات والتكاليف والعوائد.' },
  challenges:     { labelAr: 'تحدّيات',         icon: '⚠️', color: 'border-rose-300 bg-rose-50/50 text-rose-900',          descAr: 'المشاكل والعقبات والمخاطر.' },
  goals:          { labelAr: 'أهداف',           icon: '🎯', color: 'border-purple-300 bg-purple-50/50 text-purple-900',    descAr: 'المستقبل والطموحات والاتجاه.' },
  other:          { labelAr: 'عام',             icon: '📋', color: 'border-slate-300 bg-slate-50/50 text-slate-900',       descAr: '—' },
}

// نُصنّف كل قسم بمطابقة سياق عنوانه/معرّفه.
function classifySection(section: { id: string; title?: string; desc?: string }): AnalysisType {
  const text = `${section.id} ${section.title ?? ''} ${section.desc ?? ''}`.toLowerCase()
  // تحديات ومشاكل ومخاطر
  if (/(تحدي|مشكل|عقبة|خطر|مخاطر|أزمة|challenge|risk|problem)/.test(text)) return 'challenges'
  // أهداف ومستقبل
  if (/(أهداف|هدف|طموح|رؤية|مستقبل|goal|target|vision|future)/.test(text)) return 'goals'
  // مالي
  if (/(مالي|ميزاني|تكلف|راتب|أجور|إيراد|أرباح|financial|budget|salary|cost|revenue|payroll)/.test(text)) return 'financial'
  // فنّي (أنظمة/أدوات/تقنية)
  if (/(نظام|أنظمة|أدوات|تقنية|رقمي|أتمتة|بيانات|جودة|records|system|tool|tech|automation|digital|data|quality)/.test(text)) return 'technical'
  // إداري (هيكل/حوكمة/أدوار/سياسات/عقود)
  if (/(هيكل|حوكمة|أدوار|سياس|إدار|قيادة|عقود|امتثال|structure|governance|role|policy|admin|contract|compliance)/.test(text)) return 'administrative'
  // الوضع الحالي / التشخيص
  if (/(وضع|حالي|تشخيص|قوة|ضعف|status|current|diagnosis|strength|weakness|sw)/.test(text)) return 'situational'
  return 'other'
}

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
  // فلتر نوع التحليل — null = عرض الكلّ.
  const [typeFilter, setTypeFilter] = useState<AnalysisType | null>(null)
  // R6-fix — حفظ آلي: البنك ٦٠ سؤالاً على ٦ أقسام؛ المدير قد يجيب جزءاً
  // ثم يغلق. هذا يمنع فقد التقدّم. status = idle → saving → saved | error.
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextAutosave = useRef(true) // نتخطّى التشغيل الأوّل بعد تحميل الإجابات

  // نجمّع الأسئلة حسب القسم + نُلحق نوع التحليل بكل قسم.
  const grouped = useMemo(() => {
    if (!bank) return []
    const map = new Map<string, { section: SectionEntry; questions: QuestionEntry[]; type: AnalysisType }>()
    for (const s of bank.sections) map.set(s.id, { section: s, questions: [], type: classifySection(s) })
    for (const q of bank.questions) {
      const bucket = map.get(q.sectionId)
      if (bucket) bucket.questions.push(q)
    }
    return Array.from(map.values())
  }, [bank])

  // إحصائيات لكل نوع تحليل (لبناء الفلاتر مع عدّاد).
  const typeStats = useMemo(() => {
    const stats: Record<AnalysisType, { total: number; answered: number }> = {
      situational: { total: 0, answered: 0 },
      technical:   { total: 0, answered: 0 },
      administrative: { total: 0, answered: 0 },
      financial:   { total: 0, answered: 0 },
      challenges:  { total: 0, answered: 0 },
      goals:       { total: 0, answered: 0 },
      other:       { total: 0, answered: 0 },
    }
    for (const g of grouped) {
      stats[g.type].total += g.questions.length
      stats[g.type].answered += g.questions.filter((q) => answers[q.id] != null).length
    }
    return stats
  }, [grouped, answers])

  // القائمة المفلترة (بحسب نوع التحليل المُختار).
  const visibleGrouped = useMemo(() => {
    if (!typeFilter) return grouped
    return grouped.filter((g) => g.type === typeFilter)
  }, [grouped, typeFilter])

  useEffect(() => {
    if (!company || !specialty || !bank) return
    let cancel = false
    setLoading(true)
    setAnswers({})
    setSavedAt(null)
    skipNextAutosave.current = true // نتخطّى الحفظ الآلي على القراءة الأولى
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

  // ─── R6-fix — حفظ آلي بعد 1200ms من آخر تعديل ──────────────────
  // البنك طويل ومتشعّب (٦٠+ سؤالاً على ٦ أقسام). المدير قد يجيب جزءاً ثم يغادر
  // — الحفظ الآلي يحمي التقدّم دون فعل يدوي. زر «حفظ الآن» يبقى موجوداً كضمانة.
  useEffect(() => {
    if (!company || !specialty || loading) return
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false
      return
    }
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(async () => {
      setAutosaveStatus('saving')
      try {
        const payload: DeepFullData = { deptCode: specialty, answers }
        const saved = await upsertArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL', payload)
        setSavedAt(saved.updatedAt)
        setAutosaveStatus('saved')
      } catch {
        setAutosaveStatus('error')
      }
    }, 1200)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [answers, company, specialty, loading])

  async function save() {
    if (!company || !specialty) return
    // نسمح بحفظ 0 إجابات (لمسح مسودّة قديمة). لا toast خطأ للحفظ اليدوي عند 0.
    setSaving(true)
    setAutosaveStatus('saving')
    try {
      const payload: DeepFullData = { deptCode: specialty, answers }
      const saved = await upsertArtifact<DeepFullData>(company.id, 'DEPT_DEEP_FULL', payload)
      setSavedAt(saved.updatedAt)
      setAutosaveStatus('saved')
      toast.success(`تم حفظ ${answered} إجابة في القاعدة`)
    } catch (err) {
      setAutosaveStatus('error')
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
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>التقدّم على {company.name}</span>
              <AutosaveChip status={autosaveStatus} />
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
          <div className="text-2xl font-bold tabular-nums">{progressPct}%</div>
        </CardContent>
      </Card>

      {/* 🎛️ فلاتر أنواع التحليل — التحليل الفني ظاهر الآن كنوع مستقل */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">🎛️ فلترة حسب نوع التحليل</CardTitle>
          <CardDescription className="text-xs">
            التحليل العميق يجمع ٦ أنواع مختلفة — اختر نوعاً للتركيز عليه، أو اترك «الكلّ» لعرضها بالترتيب.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          <TypeChip
            active={typeFilter === null}
            onClick={() => setTypeFilter(null)}
            icon="🌐"
            labelAr="الكلّ"
            answered={answered}
            total={total}
            colorCls="border-primary/40 bg-primary/5 text-primary"
          />
          {(['situational', 'technical', 'administrative', 'financial', 'challenges', 'goals'] as AnalysisType[]).map((t) => {
            const stats = typeStats[t]
            if (stats.total === 0) return null
            const meta = ANALYSIS_TYPE_META[t]
            return (
              <TypeChip
                key={t}
                active={typeFilter === t}
                onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                icon={meta.icon}
                labelAr={meta.labelAr}
                answered={stats.answered}
                total={stats.total}
                colorCls={meta.color}
              />
            )
          })}
        </CardContent>
        {typeFilter && (
          <CardContent className="pt-0">
            <div className={`rounded-lg border-2 border-dashed p-2 text-xs ${ANALYSIS_TYPE_META[typeFilter].color}`}>
              <b>{ANALYSIS_TYPE_META[typeFilter].icon} {ANALYSIS_TYPE_META[typeFilter].labelAr}</b>:
              <span className="text-muted-foreground"> {ANALYSIS_TYPE_META[typeFilter].descAr}</span>
            </div>
          </CardContent>
        )}
      </Card>

      {loading && <LoadingSpinner label="جاري تحميل إجاباتك…" />}

      {visibleGrouped.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            لا توجد أقسام من نوع «{ANALYSIS_TYPE_META[typeFilter!]?.labelAr}» في بنك تخصّصك — امسح الفلترة لعرض الكلّ.
          </CardContent>
        </Card>
      )}

      {visibleGrouped.map(({ section, questions, type }, sectionIndex) => {
        const typeMeta = ANALYSIS_TYPE_META[type]
        return (
        <Card key={section.id} className={`overflow-hidden border-2 ${typeMeta.color.split(' ')[0]}`}>
          <div className={`h-1 ${sectionAccent(sectionIndex)}`} />
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${typeMeta.color}`}>
                <span>{typeMeta.icon}</span>
                <span>نوع التحليل: {typeMeta.labelAr}</span>
              </span>
              {section.priority && (
                <span className={`text-[10px] font-medium ${priorityColor(section.priority)}`}>
                  · {section.priority}
                </span>
              )}
            </div>
            <CardTitle className="mt-1 flex items-center gap-2 text-base">
              {section.icon && <span aria-hidden>{section.icon}</span>}
              {section.title}
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
        )
      })}

      <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl bg-background/70 p-2 backdrop-blur">
        <span className="text-xs text-muted-foreground">
          الحفظ آلي — يمكنك المغادرة والعودة لاحقاً.
        </span>
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? 'جاري الحفظ…' : `حفظ الآن (${answered} إجابة)`}
        </Button>
      </div>
    </div>
  )
}

// ─── رقيقة فلترة نوع التحليل ───────────────────────────────────
function TypeChip({
  active, onClick, icon, labelAr, answered, total, colorCls,
}: {
  active: boolean
  onClick: () => void
  icon: string
  labelAr: string
  answered: number
  total: number
  colorCls: string
}) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-medium transition ${
        active ? `${colorCls} ring-2 ring-primary shadow-sm` : `${colorCls} hover:shadow`
      }`}
    >
      <span>{icon}</span>
      <span>{labelAr}</span>
      <span className="rounded-full bg-card/70 px-1.5 text-[10px] font-bold tabular-nums">
        {answered}/{total}
      </span>
      {pct > 0 && (
        <span className="text-[9px] opacity-70 tabular-nums">({pct}٪)</span>
      )}
    </button>
  )
}

// ─── R6-fix — مؤشر بصري لحالة الحفظ الآلي ─────────────────────────
function AutosaveChip({ status }: { status: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (status === 'idle') return null
  const meta = {
    saving: { text: '💾 جاري الحفظ…', cls: 'bg-sky-100 text-sky-800 border-sky-200' },
    saved:  { text: '✓ محفوظ',       cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    error:  { text: '⚠️ فشل — سنُعيد المحاولة', cls: 'bg-rose-100 text-rose-800 border-rose-200' },
  }[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${meta.cls}`}>
      {meta.text}
    </span>
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
