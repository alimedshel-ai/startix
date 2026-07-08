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

// ─── تحليل عميق للقسم — 4 أسئلة نصّية ───────────────────────────────────────
// يُحفَظ في القاعدة كـ StrategicArtifact بنوع 'DEPT_DEEP_ANSWERS' لكل شركة.
// شكل البيانات: { answers: { "0": "...", "1": "...", ... } }.

const PROMPTS = [
  'ما هو القيد الأكبر الذي يعيق هذا القسم اليوم؟',
  'أي عملية تبدو هشّة، وكم ستكلّف لو فشلت غداً؟',
  'لو كنت تستطيع أتمتة مهمة واحدة أو حذفها في هذا القسم، فماذا ستكون؟',
  'ما هي الممارسة الجيدة الراسخة هنا والتي تستحق التوسّع؟',
]

interface DeepAnswers {
  answers: Record<string, string>
}

type AnswersState = Record<number, string>

function toState(raw: unknown): AnswersState {
  const state: AnswersState = {}
  if (raw && typeof raw === 'object' && 'answers' in raw) {
    const a = (raw as DeepAnswers).answers
    if (a && typeof a === 'object') {
      for (const [k, v] of Object.entries(a)) {
        const idx = Number(k)
        if (Number.isInteger(idx) && typeof v === 'string') state[idx] = v
      }
    }
  }
  return state
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
          setAnswers(toState(artifact.data))
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

  async function save() {
    if (!company) return
    const written = Object.values(answers).filter((v) => v.trim().length > 0).length
    if (written === 0) {
      toast.error('اكتب إجابة واحدة على الأقل قبل الحفظ.')
      return
    }
    setSaving(true)
    try {
      const payload: DeepAnswers = {
        answers: Object.fromEntries(
          Object.entries(answers).filter(([, v]) => v.trim().length > 0)
        ),
      }
      const saved = await upsertArtifact<DeepAnswers>(company.id, 'DEPT_DEEP_ANSWERS', payload)
      setSavedAt(saved.updatedAt)
      toast.success(`تم حفظ ${written} إجابة في القاعدة`)
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
            : 'تأمل بنص حر. الإجابات تُحفَظ في قاعدة بيانات الشركة وتظهر لك عند العودة.'
        }
      />

      {PROMPTS.map((p, i) => (
        <Card
          key={i}
          className="bg-gradient-to-br from-indigo-500/10 to-transparent border-indigo-200 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <CardHeader>
            <CardTitle className="text-base">السؤال {i + 1}</CardTitle>
            <CardDescription>{p}</CardDescription>
          </CardHeader>
          <CardContent>
            <Label htmlFor={`p_${i}`} className="sr-only">الإجابة على السؤال {i + 1}</Label>
            <Textarea
              id={`p_${i}`}
              value={answers[i] ?? ''}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
              rows={4}
              placeholder="اكتب إجابتك…"
            />
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? 'جاري الحفظ…' : 'حفظ في القاعدة'}
        </Button>
      </div>
    </div>
  )
}
