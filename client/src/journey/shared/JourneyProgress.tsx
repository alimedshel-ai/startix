import { Link } from 'react-router-dom'

import { useJourney, type JourneyStepView } from '@/hooks/useJourney'
import { JOURNEY_STAGES } from '@/lib/journeyStages'

// ─── §٣ — شريط التقدّم «أنت هنا» ───────────────────────────────────
// مكوّن محايد (shared) يُثبَّت أعلى كل صفحة مرحلة. يقرأ من useJourney()
// فقط، فيعكس ترتيب الخطة الحاليّة تلقائياً (تشغيلي ≠ استراتيجي) ولا يُظهر
// أي مرحلة خارج مسار الخطة.
//   • السابقة = مكتملة ✓ (قابلة للنقر).
//   • الحاليّة = مُبرَزة + شارة «أنت هنا».
//   • القادمة = رمادية مرئية (مقفلة بصرياً، غير حاجبة) مع رسالة توجيه لطيفة.

const STAGE_ICON: Record<string, string> = Object.fromEntries(
  JOURNEY_STAGES.map((s) => [s.id, s.icon]),
)

// أرقام هنديّة-عربيّة للعدّاد (١ / ٨).
function ar(n: number): string {
  return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
}

interface Props {
  companyId: string | null
  /** لتمرير سياق العميل في الروابط (?client=<id>). */
  clientQuery?: string
}

export function JourneyProgress({ companyId, clientQuery = '' }: Props) {
  const { loading, path, steps, currentIndex, total, currentStage } = useJourney(companyId)
  if (loading && steps.length === 0) return null

  return (
    <div className="mb-4 rounded-xl border bg-card/60 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{path.labelAr}</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
          الخطوة {currentIndex > 0 ? ar(currentIndex) : '—'} / {ar(total)}
        </span>
      </div>
      <ol className="flex flex-wrap items-stretch gap-1.5">
        {steps.map((step, i) => (
          <StepChip
            key={step.stageId}
            step={step}
            icon={STAGE_ICON[step.stageId] ?? '•'}
            isLast={i === steps.length - 1}
            currentLabel={currentStage?.titleAr ?? 'المرحلة الحاليّة'}
            clientQuery={clientQuery}
          />
        ))}
      </ol>
    </div>
  )
}

function StepChip({
  step, icon, isLast, currentLabel, clientQuery,
}: {
  step: JourneyStepView
  icon: string
  isLast: boolean
  currentLabel: string
  clientQuery: string
}) {
  const base = 'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors'
  const connector = isLast ? null : <span aria-hidden className="self-center text-muted-foreground/40">←</span>

  if (step.status === 'current') {
    return (
      <li className="flex items-stretch gap-1.5">
        <div className={`${base} border-primary bg-primary/10 font-semibold text-primary`}>
          <span aria-hidden>{icon}</span>
          <span>{step.titleAr}</span>
          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">أنت هنا</span>
        </div>
        {connector}
      </li>
    )
  }

  if (step.status === 'locked') {
    return (
      <li className="flex items-stretch gap-1.5">
        <div
          className={`${base} cursor-not-allowed border-dashed bg-muted/30 text-muted-foreground/70`}
          title={`تنفتح بعد إكمال «${currentLabel}»`}
        >
          <span aria-hidden>🔒</span>
          <span>{step.titleAr}</span>
        </div>
        {connector}
      </li>
    )
  }

  // done | available → قابلة للنقر (تقدّم للأمام أو رجوع لمرحلة مكتملة).
  const isDone = step.status === 'done'
  return (
    <li className="flex items-stretch gap-1.5">
      <Link
        to={`${step.href}${clientQuery}`}
        className={`${base} ${
          isDone
            ? 'border-emerald-300 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100/60'
            : 'border-muted-foreground/20 bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
        }`}
        title={isDone ? 'مرحلة مكتملة — اضغط للمراجعة' : 'متاحة — اضغط للانتقال'}
      >
        <span aria-hidden>{isDone ? '✓' : icon}</span>
        <span>{step.titleAr}</span>
      </Link>
      {connector}
    </li>
  )
}
