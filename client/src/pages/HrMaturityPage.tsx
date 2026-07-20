import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { buttonVariants } from '@/components/ui/button'
import { HrMaturityDiagnostic, HrMaturityReport } from '@/pages/manager/HrMaturityDiagnostic'
import type { HrAnswers } from '@/lib/hrMaturity'

// ─── تقييم نضج HR — صفحة عامّة «قبل التسجيل» (المرحلة ٤) ─────────────
// الزائر (المدير المستقل المتخصّص في HR) يجرّب التقييم قبل التسجيل، يرى
// تقرير نضجه، ثم يسجّل. مسودّة الإجابات تُحفظ محلياً (نفس استثناء القانون
// الأوّل الموثّق لتدفّق ما-قبل-التسجيل: زائر مجهول بلا حساب بعد).
const DRAFT_KEY = 'startix-hr-maturity'

function loadDraft(): HrAnswers {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (parsed && typeof parsed === 'object') return parsed as HrAnswers
  } catch { /* تجاهل */ }
  return {}
}

export function HrMaturityPage() {
  const [answers, setAnswers] = useState<HrAnswers>(() => loadDraft())

  useEffect(() => {
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(answers)) } catch { /* تجاهل */ }
  }, [answers])

  function onSelect(questionId: string, optionIndex: number) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="rounded-2xl border-2 border-primary/30 bg-gradient-to-l from-primary/10 to-transparent p-5">
        <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">← ستارتكس</Link>
        <h1 className="text-xl font-bold">🔬 تقييم نضج الموارد البشريّة — جرّبه قبل التسجيل</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ١٠ أقسام × ١٠ أسئلة سريعة → تقرير نضج فوري لكل قسم مع أقوى وأضعف نقاطك وتوصيات الأولويّة.
          مجّاني وبلا تسجيل — سجّل بعدها لتحفظ نتيجتك وتبدأ التنفيذ.
        </p>
      </header>

      <HrMaturityDiagnostic answers={answers} onSelect={onSelect} />

      <HrMaturityReport answers={answers} />

      {/* دعوة التسجيل — ثابتة أسفل الصفحة */}
      <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-primary/40 bg-card p-3 shadow-lg">
        <div className="text-xs text-muted-foreground">
          أعجبك التقرير؟ <b className="text-foreground">سجّل لتحفظ نتيجتك وتبني خطّة تحسين لكل قسم.</b>
        </div>
        <Link to="/join" className={buttonVariants({ size: 'lg' })}>سجّل الآن وابدأ ←</Link>
      </div>
    </div>
  )
}
