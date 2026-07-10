import { Link, useLocation } from 'react-router-dom'

import { JOURNEY_STAGES, type JourneyStage } from '@/lib/journeyStages'

// ─── S1 — شريط تسلسل مرئي أعلى كل أداة استراتيجية ──────────────────
// يعرض المرحلة الحالية، المرحلة السابقة (الاستكمال المُقتَرَح)، والتالية
// (الخطوة القادمة). يستخرج المرحلة من JOURNEY_STAGES بمطابقة الـpathname
// مع toolPaths. لا يعرض شيئاً إذا الأداة لا تنتمي لأي مرحلة (نادر).

function findStage(pathname: string): JourneyStage | null {
  for (const s of JOURNEY_STAGES) {
    if (s.toolPaths.some((p) => pathname === p || pathname.startsWith(p + '/'))) return s
  }
  return null
}

export function StageBanner({ clientQuery = '' }: { clientQuery?: string }) {
  const { pathname } = useLocation()
  const currentStage = findStage(pathname)
  if (!currentStage) return null

  const prevStage = JOURNEY_STAGES.find((s) => s.order === currentStage.order - 1) ?? null
  const nextStage = JOURNEY_STAGES.find((s) => s.order === currentStage.order + 1) ?? null

  const accent = ACCENT_CLASS[currentStage.accent]

  return (
    <div className={`overflow-hidden rounded-xl border ${accent.border} ${accent.bg}`}>
      <div className={`h-1 ${accent.bar}`} />
      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-xs">
        {/* Progress dots */}
        <div className="flex items-center gap-1">
          {JOURNEY_STAGES.map((s) => (
            <span
              key={s.id}
              className={`h-2 w-2 rounded-full ${
                s.order < currentStage.order ? 'bg-emerald-500'
                : s.order === currentStage.order ? ACCENT_CLASS[s.accent].bar
                : 'bg-muted'
              }`}
              title={s.labelAr}
            />
          ))}
        </div>

        {/* Current */}
        <div className="flex items-center gap-1.5">
          <span aria-hidden>{currentStage.icon}</span>
          <span className="font-semibold">{currentStage.labelAr}</span>
        </div>

        {/* Previous hint */}
        {prevStage && (
          <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
            <span>· قبلها:</span>
            <Link
              to={`${prevStage.starredPaths[0] ?? prevStage.toolPaths[0]}${clientQuery}`}
              className="underline-offset-2 hover:underline"
            >
              {prevStage.icon} {shortStageName(prevStage)}
            </Link>
          </div>
        )}

        {/* Next hint */}
        {nextStage && (
          <div className="ml-auto flex items-center gap-1 text-muted-foreground">
            <span>التالي:</span>
            <Link
              to={`${nextStage.starredPaths[0] ?? nextStage.toolPaths[0]}${clientQuery}`}
              className="rounded-md border bg-card px-2 py-0.5 text-[10px] font-medium hover:bg-accent"
            >
              {nextStage.icon} {shortStageName(nextStage)} ←
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

function shortStageName(s: JourneyStage): string {
  // نأخذ ما بعد "① " أو "② " إلخ.
  return s.labelAr.replace(/^[①②③④⑤⑥]\s*—\s*/u, '')
}

const ACCENT_CLASS: Record<JourneyStage['accent'], { border: string; bg: string; bar: string }> = {
  sky:     { border: 'border-sky-200',     bg: 'bg-sky-50/40',     bar: 'bg-sky-500' },
  rose:    { border: 'border-rose-200',    bg: 'bg-rose-50/40',    bar: 'bg-rose-500' },
  amber:   { border: 'border-amber-200',   bg: 'bg-amber-50/40',   bar: 'bg-amber-500' },
  emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50/40', bar: 'bg-emerald-500' },
  violet:  { border: 'border-violet-200',  bg: 'bg-violet-50/40',  bar: 'bg-violet-500' },
  orange:  { border: 'border-orange-200',  bg: 'bg-orange-50/40',  bar: 'bg-orange-500' },
}
