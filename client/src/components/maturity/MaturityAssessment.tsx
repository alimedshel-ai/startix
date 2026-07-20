import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  allAnswered, barBgOf, computeOverall, computeResults, levelOf,
  type MaturityAnswers, type MaturityConfig, type MaturityQuestion, type MaturitySection,
} from '@/lib/maturityEngine'

// ─── واجهة تقييم النضج المعمّمة (config-driven) ─────────────────────
// مكوّن مُتحكَّم فيه لأي تخصّص: يعرض أقسام الـconfig وأسئلتها + درجة حيّة
// لكل قسم + شريط نضج كلّي. يعمل لـ HR والمالية وأي تخصّص لاحق.

export function MaturityAssessment({
  config, answers, onSelect,
}: {
  config: MaturityConfig
  answers: MaturityAnswers
  onSelect: (questionId: string, optionIndex: number) => void
}) {
  const results = computeResults(config, answers)
  const overall = computeOverall(config, answers)
  const overallLevel = levelOf(config, overall.maturityPct)

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/30 bg-gradient-to-l from-primary/5 to-transparent">
        <CardContent className="p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-bold">{config.titleAr}</div>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold tabular-nums ${overallLevel.cls}`}>
              {overallLevel.emoji} {overall.maturityPct}٪ · {overallLevel.labelAr}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className={`h-full ${barBgOf(overallLevel)} transition-all`} style={{ width: `${overall.maturityPct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground tabular-nums">
            أجبت {overall.answeredTotal}/{overall.totalQuestions} سؤالاً
          </div>
        </CardContent>
      </Card>

      {config.sections.map((section) => {
        const r = results.find((x) => x.key === section.key)!
        return <SectionCard key={section.key} config={config} section={section} answers={answers} onSelect={onSelect} pct={r.pct} answered={r.answered} />
      })}
    </div>
  )
}

function SectionCard({
  config, section, answers, onSelect, pct, answered,
}: {
  config: MaturityConfig
  section: MaturitySection
  answers: MaturityAnswers
  onSelect: (questionId: string, optionIndex: number) => void
  pct: number
  answered: number
}) {
  const level = levelOf(config, pct)
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
          <QuestionRow key={question.id} index={i} question={question} selected={answers[question.id] ?? null} onSelect={(idx) => onSelect(question.id, idx)} />
        ))}
      </CardContent>
    </Card>
  )
}

function QuestionRow({
  question, index, selected, onSelect,
}: {
  question: MaturityQuestion
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
            <button key={idx} type="button" onClick={() => onSelect(idx)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${active ? 'border-primary bg-primary/10 font-medium' : 'bg-card hover:border-primary/40 hover:bg-muted/40'}`}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── تقرير النضج المعمّم ────────────────────────────────────────────
export function MaturityReport({ config, answers }: { config: MaturityConfig; answers: MaturityAnswers }) {
  const results = computeResults(config, answers)
  const overall = computeOverall(config, answers)
  if (overall.answeredTotal === 0) return null
  const level = levelOf(config, overall.maturityPct)
  const ranked = [...results].sort((a, b) => a.pct - b.pct)
  const complete = allAnswered(config, answers)
  const weakRecs = ranked.filter((r) => r.pct < 60).slice(0, 3)

  return (
    <Card className="overflow-hidden border-2 border-primary/40">
      <div className="h-1.5 bg-gradient-to-l from-primary via-violet-500 to-emerald-500" />
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          📊 تقرير {config.titleAr}
          <span className={`rounded-full border px-2.5 py-0.5 text-sm font-bold tabular-nums ${level.cls}`}>
            {level.emoji} {overall.maturityPct}٪ · {level.labelAr}
          </span>
        </CardTitle>
        <CardDescription>
          {complete ? 'التقييم مكتمل — الأقسام مرتّبة بالأضعف أوّلاً.' : `أجبت ${overall.answeredTotal}/${overall.totalQuestions} — أكمل لتقرير دقيق.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2 text-xs">
          {overall.strongest && (
            <span className="rounded-lg border border-emerald-300 bg-emerald-50/60 px-3 py-1.5 text-emerald-900">
              💪 الأقوى: <b>{overall.strongest.labelAr}</b> ({overall.strongest.pct}٪)
            </span>
          )}
          {overall.weakest && (
            <span className="rounded-lg border border-rose-300 bg-rose-50/60 px-3 py-1.5 text-rose-900">
              🎯 الأضعف: <b>{overall.weakest.labelAr}</b> ({overall.weakest.pct}٪)
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          {ranked.map((r) => (
            <div key={r.key} className="flex items-center gap-2">
              <span className="w-32 shrink-0 truncate text-xs font-medium">{r.icon} {r.labelAr}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div className={`h-full ${barBgOf(r.level)}`} style={{ width: `${r.pct}%` }} />
              </div>
              <span className={`w-16 shrink-0 rounded border px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums ${r.level.cls}`}>
                {r.level.emoji} {r.pct}٪
              </span>
            </div>
          ))}
        </div>

        {weakRecs.length > 0 && (
          <div className="rounded-lg border border-dashed bg-muted/30 p-3">
            <div className="mb-1.5 text-xs font-bold">💡 توصيات الأولويّة (أضعف الأقسام):</div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {weakRecs.map((r) => (
                <li key={r.key} className="flex items-start gap-2">
                  <span aria-hidden>{r.icon}</span>
                  <span><b className="text-foreground">{r.labelAr} ({r.pct}٪):</b> {r.recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
