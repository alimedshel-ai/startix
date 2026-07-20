import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  HR_LEVEL_META, HR_SECTIONS,
  computeHrOverall, computeHrResults, levelOf,
  type HrAnswers, type HrQuestion, type HrSection,
} from '@/lib/hrMaturity'

// ─── تقييم نضج HR — واجهة التقييم (المرحلة ٢) ───────────────────────
// مكوّن مُتحكَّم فيه (parent يملك الإجابات) ليسهُل حفظها في مسودّة ما قبل
// التسجيل لاحقاً (المرحلة ٤). ١٠ أقسام، كل قسم درجته الحيّة، + شريط النضج.

export function HrMaturityDiagnostic({
  answers, onSelect,
}: {
  answers: HrAnswers
  onSelect: (questionId: string, optionIndex: number) => void
}) {
  const results = computeHrResults(answers)
  const overall = computeHrOverall(answers)
  const overallLevel = HR_LEVEL_META[levelOf(overall.maturityPct)]

  return (
    <div className="flex flex-col gap-5">
      {/* شريط النضج الكلّي الحيّ */}
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold">نضج إدارة الموارد البشريّة</div>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${overallLevel.cls}`}>
              {overallLevel.emoji} {overall.maturityPct}٪ · {overallLevel.labelAr}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-gradient-to-l from-primary to-emerald-500 transition-all" style={{ width: `${overall.maturityPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            أجبت {overall.answeredTotal}/{overall.totalQuestions} سؤالاً
          </div>
        </CardContent>
      </Card>

      {HR_SECTIONS.map((section) => {
        const r = results.find((x) => x.key === section.key)!
        return (
          <SectionCard
            key={section.key}
            section={section}
            answers={answers}
            onSelect={onSelect}
            pct={r.pct}
            answered={r.answered}
          />
        )
      })}
    </div>
  )
}

function SectionCard({
  section, answers, onSelect, pct, answered,
}: {
  section: HrSection
  answers: HrAnswers
  onSelect: (questionId: string, optionIndex: number) => void
  pct: number
  answered: number
}) {
  const level = HR_LEVEL_META[levelOf(pct)]
  const started = answered > 0
  return (
    <Card className={`overflow-hidden border-2 ${started ? level.cls.split(' ')[0] : 'border-border'}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span aria-hidden>{section.icon}</span>
          <span>{section.labelAr}</span>
          <span className="rounded-full border bg-card px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
            {answered}/{section.questions.length}
          </span>
          {started && (
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums ${level.cls}`}>
              {level.emoji} {pct}٪
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {section.questions.map((question, i) => (
          <QuestionRow
            key={question.id}
            index={i}
            question={question}
            selected={answers[question.id] ?? null}
            onSelect={(idx) => onSelect(question.id, idx)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

function QuestionRow({
  question, index, selected, onSelect,
}: {
  question: HrQuestion
  index: number
  selected: number | null
  onSelect: (optionIndex: number) => void
}) {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 text-sm font-medium">
        <span className="text-muted-foreground tabular-nums">{index + 1}.</span> {question.text}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {question.options.map((o, idx) => {
          const active = selected === idx
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(idx)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                active ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:border-primary/40 hover:bg-muted/40'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
