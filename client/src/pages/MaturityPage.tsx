import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { MaturityAssessment, MaturityReport } from '@/components/maturity/MaturityAssessment'
import { MATURITY_BY_SPECIALTY } from '@/lib/maturityConfigs'
import type { MaturityAnswers, MaturityConfig } from '@/lib/maturityEngine'

// ─── صفحة تقييم النضج «قبل التسجيل» (معمّمة) ────────────────────────
// الزائر يجرّب التقييم قبل التسجيل، يرى تقريره، ثم يسجّل. مسودّة الإجابات
// محلياً بمفتاح الـconfig (استثناء القانون الأوّل الموثّق لما-قبل-التسجيل).

function loadDraft(key: string): MaturityAnswers {
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object') {
      const clean: MaturityAnswers = {}
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) if (typeof v === 'number') clean[k] = v
      return clean
    }
  } catch { /* تجاهل */ }
  return {}
}

// موجّه المسار العام: /diagnostic/m/:specialty → config المطابق (وإلا /join).
export function MaturityPageRoute() {
  const { specialty } = useParams<{ specialty: string }>()
  const config = specialty ? MATURITY_BY_SPECIALTY[specialty.toUpperCase()] : undefined
  if (!config) return <Navigate to="/join" replace />
  return <MaturityPage config={config} />
}

export function MaturityPage({ config }: { config: MaturityConfig }) {
  const [answers, setAnswers] = useState<MaturityAnswers>(() => loadDraft(config.draftKey))

  useEffect(() => {
    try { localStorage.setItem(config.draftKey, JSON.stringify(answers)) } catch { /* تجاهل */ }
  }, [answers, config.draftKey])

  function onSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="rounded-2xl border-2 border-primary/30 bg-gradient-to-l from-primary/10 to-transparent p-5">
        <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← ستارتكس</Link>
        <h1 className="text-xl font-bold">🔬 {config.titleAr} — جرّبه قبل التسجيل</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {config.descAr} مجّاني وبلا تسجيل — سجّل بعدها لتحفظ نتيجتك وتبدأ خطّة التحسين.
        </p>
      </header>

      <MaturityAssessment config={config} answers={answers} onSelect={onSelect} />
      <MaturityReport config={config} answers={answers} />

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-card p-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          أعجبك التقرير؟ <b className="text-foreground">سجّل لتحفظ نتيجتك وتبني خطّة تحسين لكل قسم.</b>
        </div>
        <Link to="/join" className={buttonVariants({ size: 'lg' })}>سجّل الآن وابدأ ←</Link>
      </div>
    </div>
  )
}
